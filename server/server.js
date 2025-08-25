const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { spawn } = require('child_process'); 
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// PostgreSQL Database Connection Pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Centralized error handling
const handleError = (res, err, type) => {
  console.error(`${type} error:`, err);
  if (err.code === '23505') {
    return res.status(409).json({ error: 'User with this email already exists.' });
  }
  res.status(500).json({ error: `An unexpected error occurred during ${type}.` });
};

app.use(express.json());
app.use(cors());

// --- User Authentication Endpoints ---

// Signup
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING user_id",
      [email, passwordHash]
    );
    res.status(201).json({ message: 'Signup successful!', userId: result.rows[0].user_id });
  } catch (err) {
    handleError(res, err, 'signup');
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query(
      "SELECT user_id, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }

    const user = result.rows[0];
    const passwordsMatch = await bcrypt.compare(password, user.password_hash);

    if (passwordsMatch) {
      res.status(200).json({ message: 'Login successful!', userId: user.user_id });
    } else {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

// --- Tracker Data Endpoints ---

app.get('/api/tracker/data', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }
  try {
    const [events, moods, user] = await Promise.all([
      pool.query("SELECT event_date, event_type FROM events WHERE user_id = $1 ORDER BY event_date ASC", [userId]),
      pool.query("SELECT mood_date, mood FROM moods WHERE user_id = $1 ORDER BY mood_date ASC", [userId]),
      pool.query("SELECT custom_cycle_length, custom_period_length FROM users WHERE user_id = $1", [userId])
    ]);

    let predictedCycleLength = null;
    const periodStarts = events.rows.filter(e => e.event_type === 'start');

    if (periodStarts.length >= 2) {
      const pythonProcess = spawn('python3', ['predict.py']);
      const dataToSend = { events: events.rows };
      pythonProcess.stdin.write(JSON.stringify(dataToSend));
      pythonProcess.stdin.end();

      let pythonOutput = '';
      let pythonError = '';

      pythonProcess.stdout.on('data', (data) => {
        pythonOutput += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        pythonError += data.toString();
      });

      await new Promise((resolve, reject) => {
        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            console.error(`Python script stderr: ${pythonError}`);
            return reject(new Error(`Prediction failed: ${pythonError}`));
          }
          try {
            const result = JSON.parse(pythonOutput);
            predictedCycleLength = result.predicted_cycle_length;
            resolve();
          } catch (e) {
            console.error("Failed to parse Python output:", pythonOutput);
            reject(new Error("Prediction failed due to invalid output"));
          }
        });
        pythonProcess.on('error', (err) => {
          console.error("Failed to start Python process:", err);
          reject(new Error("Prediction process failed"));
        });
      });
    }

    res.status(200).json({
      events: events.rows,
      moods: moods.rows,
      profile: user.rows[0] || {},
      predictedCycleLength: predictedCycleLength
    });
  } catch (err) {
    handleError(res, err, 'data fetch');
  }
});

// Add an event
app.post('/api/tracker/event', async (req, res) => {
  const { userId, event_date, event_type } = req.body;
  if (!userId || !event_date || !event_type) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  try {
    const result = await pool.query(
      "INSERT INTO events (user_id, event_date, event_type) VALUES ($1, $2, $3) RETURNING *",
      [userId, event_date, event_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleError(res, err, 'event add');
  }
});

// Add or update a mood
app.post('/api/tracker/mood', async (req, res) => {
  const { userId, mood_date, mood } = req.body;
  if (!userId || !mood_date || !mood) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  try {
    const result = await pool.query(
      "INSERT INTO moods (user_id, mood_date, mood) VALUES ($1, $2, $3) ON CONFLICT (user_id, mood_date) DO UPDATE SET mood = $3 RETURNING *",
      [userId, mood_date, mood]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleError(res, err, 'mood upsert');
  }
});

// Delete a mood
app.delete('/api/tracker/mood', async (req, res) => {
  const { userId, mood_date } = req.body;
  if (!userId || !mood_date) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  try {
    const result = await pool.query(
      "DELETE FROM moods WHERE user_id = $1 AND mood_date = $2 RETURNING *",
      [userId, mood_date]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Mood not found.' });
    }
    res.status(200).json({ message: 'Mood deleted successfully.', deletedMood: result.rows[0] });
  } catch (err) {
    handleError(res, err, 'mood delete');
  }
});

// Update profile settings
app.post('/api/tracker/profile', async (req, res) => {
  const { userId, custom_cycle_length, custom_period_length } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user ID.' });
  }
  try {
    const result = await pool.query(
      "UPDATE users SET custom_cycle_length = $2, custom_period_length = $3 WHERE user_id = $1 RETURNING *",
      [userId, custom_cycle_length, custom_period_length]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    handleError(res, err, 'profile update');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
