# Aralu AI

**AraluAI** is a website that emphasises menstrual health education for women, men, kids. This period tracker is a small integration surrounding that initiative. 

##  Table of Contents

- [Features](#features)  
- [Tech Stack](#tech-stack)  
- [Project Structure](#project-structure)  
- [Setup & Installation](#setup--installation)  
- [Usage](#usage)  

##  Features

- User signup and login (email/password)  
- Track period start/end and daily moods  
- View predictions for next period start 
- Set custom cycle and period lengths  
- Calendar-based UI built with React

##  Tech Stack

| Layer        | Technology            |
|--------------|------------------------|
| Backend      | Node.js, Express, PostgreSQL |
| Database     | PostgreSQL             |
| Authentication | bcrypt password hashing |
| Prediction   | Python script (`predict.py`) |
| Frontend     | React (Create React App), HTML, CSS |
| Dev Tools    | CORS, dotenv           |

##  Project Structure

aralu-ai/
├── public/ 
├── server/
│ ├── server.js 
│ ├── predict.py 
│ ├── .env 
│ └── package.json
├── src/ 
├── .gitignore 
├── package.json 
└── README.md

##  Setup & Installation

**Prerequisites:**
- Node.js (>=14.x)
- Python 3.x
- PostgreSQL (ensure a database is created)

```bash
# Clone via SSH
git clone git@github.com:notsoujanya/aralu-ai.git
cd aralu-ai

# Install dependencies
npm install               # Installs React & root-level scripts
cd server && npm install  # Installs backend dependencies

# Create .env inside server/:
# DB_USER=your_pg_user
# DB_HOST=your_pg_host
# DB_DATABASE=your_db_name
# DB_PASSWORD=your_pg_password
# DB_PORT=your_pg_port
# PORT=5001

# Run backend
cd server
npm start

# In a new terminal, run frontend
npm run start

# The React app will open at http://localhost:3000,
# and backend APIs are served from http://localhost:5001

# Usage

- Visit the homepage and sign up for an account.  
- Log in with your credentials.  
- Use the calendar to log period starts/ends and track mood.  
- View insights: average cycle/period length, next period prediction, mood stats.  
- Configure custom cycle/period lengths under the **Your Insights** section.  