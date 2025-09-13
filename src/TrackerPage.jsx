import React, { useEffect, useMemo, useState } from "react";
import "./TrackerPage.css";

// --- helpers ---
const fmt = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const parse = (s) => {
  if (!s) return null;
  const [year, month, day] = s.split('-').map((x) => parseInt(x, 10));
  return new Date(year, month - 1, day);
};
const today = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate()); // normalize to midnight
};
const diffDays = (a, b) => Math.round((a - b) / 86400000);

const meanRound = (arr) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
const asNumOrNull = (v) => (v !== null && v !== undefined && `${v}`.trim() !== "" ? Number(v) : null);

const MOODS = [
  { key: "awful", label: "Awful", icon: "🙁" },
  { key: "bad", label: "Bad", icon: "☹️" },
  { key: "okay", label: "Okay", icon: "😐" },
  { key: "good", label: "Good", icon: "🙂" },
  { key: "great", label: "Great", icon: "💖" },
];

function buildMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startDay = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, monthIndex, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function buildCycles(sortedEvents) {
  const cycles = [];
  const starts = sortedEvents.filter(e => e.event_type === 'start');
  const ends = sortedEvents.filter(e => e.event_type === 'end');

  for (let i = 0; i < starts.length; i++) {
    const currentStartDate = parse(starts[i].event_date);
    const nextStartDate = (i + 1 < starts.length) ? parse(starts[i + 1].event_date) : null;

    const correspondingEndEvent = ends.find(endEvent => {
      const endDate = parse(endEvent.event_date);
      const isAfterCurrentStart = endDate >= currentStartDate;
      const isBeforeNextStart = nextStartDate ? endDate < nextStartDate : true;
      return isAfterCurrentStart && isBeforeNextStart;
    });

    if (correspondingEndEvent) {
      cycles.push({ start: currentStartDate, end: parse(correspondingEndEvent.event_date) });
    } else {
      cycles.push({ start: currentStartDate, end: null });
    }
  }
  return cycles;
}

export default function TrackerPage({ userId }) {
  const t = today();
  const [viewYear, setViewYear] = useState(t.getFullYear());
  const [viewMonth, setViewMonth] = useState(t.getMonth());
  const [selectedDate, setSelectedDate] = useState(fmt(t));

  // ✅ States are now empty by default, ready to be filled by the API call.
  const [events, setEvents] = useState([]);
  const [moods, setMoods] = useState([]);
  const [profile, setProfile] = useState({});
  const [statusMsg, setStatusMsg] = useState("");
  // ✅ State to hold the prediction from your Python model
  const [predictionFromApi, setPredictionFromApi] = useState(null);

  useEffect(() => {
    async function loadData() {
        if (!userId) return;
        try {
          const response = await fetch(`http://localhost:5001/api/tracker/data?userId=${userId}`);
          if (!response.ok) throw new Error("Failed to fetch data.");
          
          // ✅ Destructure ALL data from the backend, including the prediction
          const data = await response.json();
          setEvents(data.events || []);
          setMoods(data.moods || []);
          setProfile({
              custom_cycle_length: data.profile?.custom_cycle_length ?? null,
              custom_period_length: data.profile?.custom_period_length ?? null,
          });
          // ✅ Set the prediction from the API into state
          setPredictionFromApi(data.predictedCycleLength || null);
          setStatusMsg("");
        } catch (err) {
          setStatusMsg(err.message);
        }
    }
    loadData();
  }, [userId]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => parse(a.event_date) - parse(b.event_date));
  }, [events]);

  const cycles = useMemo(() => buildCycles(sortedEvents), [sortedEvents]);

  const isSelectedDateInCycle = useMemo(() => {
    const d = parse(selectedDate);
    if (!d) return false;
    return cycles.some(c => {
        const start = c.start;
        const end = c.end ?? new Date(8640000000000000); 
        return d >= start && d <= end;
    });
  }, [selectedDate, cycles]);
  
  const relevantOpenCycleForDate = useMemo(() => {
    const d = parse(selectedDate);
    if (!d) return null;
    const relevantCycle = [...cycles].reverse().find(c => d >= c.start);
    if (relevantCycle && relevantCycle.end === null) {
      return relevantCycle;
    }
    return null;
  }, [selectedDate, cycles]);

  const startDates = useMemo(() => sortedEvents.filter(e => e.event_type === "start").map(e => parse(e.event_date)), [sortedEvents]);
  const currentlyMenstruating = useMemo(() => cycles.some(c => t >= c.start && (c.end === null || t <= c.end)), [cycles, t]);

  const predicted = useMemo(() => {
    const closedCycles = cycles.filter((c) => c.end);
    const periodLensFiltered = [];
    for (const c of closedCycles) {
        if (c.end) {
            const len = Math.max(1, diffDays(c.end, c.start) + 1);
            if (len <= 15) periodLensFiltered.push(len);
        }
    }
    const avgPeriodFiltered = periodLensFiltered.length > 0 ? meanRound(periodLensFiltered) : null;
    
    // ✅ Prediction logic now prioritizes your Python model's output
    const chosenCycle = asNumOrNull(profile.custom_cycle_length) ?? predictionFromApi ?? 28;
    const chosenPeriod = asNumOrNull(profile.custom_period_length) ?? avgPeriodFiltered ?? 5;

    if (startDates.length === 0) {
        return { nextStart: null, avgCycle: chosenCycle, avgPeriod: chosenPeriod };
    }

    const lastStart = startDates[startDates.length - 1];
    const nextStart = new Date(lastStart.getFullYear(), lastStart.getMonth(), lastStart.getDate() + chosenCycle);

    return { nextStart, avgCycle: chosenCycle, avgPeriod: chosenPeriod };
  }, [cycles, profile, startDates, predictionFromApi]);

  // ✅ --- "MINI WRAPPED" CALCULATION ADDED --- ✅
  const monthlyWrappedData = useMemo(() => {
    const moodsThisMonth = moods.filter(m => {
      const d = parse(m.mood_date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });

    let mostCommonMood = null;
    if (moodsThisMonth.length > 0) {
      const moodCounts = moodsThisMonth.reduce((counts, m) => {
        counts[m.mood] = (counts[m.mood] || 0) + 1;
        return counts;
      }, {});
      mostCommonMood = Object.keys(moodCounts).reduce((a, b) => moodCounts[a] > moodCounts[b] ? a : b);
    }
    
    const cyclesStartedThisMonth = cycles.filter(c => {
        const d = c.start;
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth && c.end;
    });
    
    const periodLengths = cyclesStartedThisMonth.map(c => diffDays(c.end, c.start) + 1);
    const avgPeriodLength = meanRound(periodLengths);

    return {
      moodLogCount: moodsThisMonth.length,
      mostCommonMood,
      avgPeriodLength,
    };
  }, [moods, cycles, viewYear, viewMonth]);

  const eventByDate = useMemo(() => new Map(events.map(e => [e.event_date, e.event_type])), [events]);
  const moodByDate = useMemo(() => new Map(moods.map(m => [m.mood_date, m.mood])), [moods]);

  async function addEvent(type, dateStr) {
    if (!userId) return;
    setStatusMsg("");
    try {
      if (type === 'end') {
          if (!relevantOpenCycleForDate) {
              setStatusMsg("Cannot end a period here.");
              return;
          }
          if (parse(dateStr) < relevantOpenCycleForDate.start) {
              setStatusMsg("End date cannot be before the start date.");
              return;
          }
      }
      const response = await fetch("http://localhost:5001/api/tracker/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, event_date: dateStr, event_type: type }),
      });
      if (!response.ok) throw new Error("Failed to add event.");
      const newEvent = await response.json();
      setEvents(prevEvents => [...prevEvents, newEvent]);
      setStatusMsg(`Period ${type === "start" ? "started" : "ended"} on ${dateStr}.`);
    } catch (err) {
      console.error("Error in addEvent:", err);
      setStatusMsg(err.message);
    }
  }

  async function setMood(moodKey, dateStr = selectedDate) {
    if (!userId) return;
    setStatusMsg("");
    try {
      const existingMood = moodByDate.get(dateStr);
      if (existingMood && existingMood === moodKey) {
        await fetch("http://localhost:5001/api/tracker/mood", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, mood_date: dateStr }),
        });
        setMoods(prevMoods => prevMoods.filter(m => m.mood_date !== dateStr));
        setStatusMsg(`Mood removed for ${dateStr}.`);
      } else {
        const response = await fetch("http://localhost:5001/api/tracker/mood", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, mood_date: dateStr, mood: moodKey }),
        });
        if (!response.ok) throw new Error("Failed to set mood.");
        const newOrUpdatedMood = await response.json();
        setMoods(prevMoods => [...prevMoods.filter(m => m.mood_date !== dateStr), newOrUpdatedMood]);
        setStatusMsg(`Mood "${moodKey}" logged for ${dateStr}.`);
      }
    } catch (err) {
      console.error("Error in setMood:", err);
      setStatusMsg(err.message);
    }
  }
  
  async function updateCustomSetting(key, value) {
    if (!userId) return;
    const currentProfile = {
        custom_cycle_length: asNumOrNull(profile.custom_cycle_length),
        custom_period_length: asNumOrNull(profile.custom_period_length),
    };
    const newProfile = { ...currentProfile, [key]: asNumOrNull(value) };
    try {
      await fetch("http://localhost:5001/api/tracker/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...newProfile }),
      });
      setProfile(newProfile);
      setStatusMsg("Settings updated successfully.");
    } catch (err) {
      setStatusMsg("Failed to update settings.");
    }
  }

  const handleProfileInputChange = (key, value) => {
    setProfile(prev => ({...prev, [key]: value}));
  };

  const grid = buildMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  
  function goMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }
  
  return (
    // The JSX structure is the same as your provided file, but now the `wrapped` div will be dynamic
    <div className="tracker-wrap">
       <div className="logout-btn-wrap">
        <button className="text-btn" onClick={() => { localStorage.removeItem("userId"); window.location.reload(); }}>Log out</button>
      </div>
      <div className="card calendar-card">
        <div className="cal-header">
          <h2 className="cal-title">{monthLabel}</h2>
          <div className="cal-controls">
            <button onClick={() => goMonth(-1)}>&lt;</button>
            <button onClick={() => { 
              const now = today();
              setViewYear(now.getFullYear()); 
              setViewMonth(now.getMonth()); 
              setSelectedDate(fmt(now)); 
            }}>Today</button>
            <button onClick={() => goMonth(1)}>&gt;</button>
          </div>
        </div>
        <div className="weekday-row">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d=><div key={d}>{d}</div>)}</div>
        <div className="grid">
          {grid.map((d, i) => {
            if (!d) return <div key={i} className="cell empty" />;
            const key = fmt(d);
            const isToday = fmt(t) === key;
            const isSelected = selectedDate === key;
            const evt = eventByDate.get(key);
            const mood = moodByDate.get(key);
            return (
              <div 
                key={i} 
                className={["cell", isToday ? "today" : "", isSelected ? "selected" : ""].join(" ")}
                onClick={() => setSelectedDate(key)}
                title={evt ? `Period ${evt}` : mood ? `Mood: ${mood}` : ""}
              >
                <span className="daynum">{d.getDate()}</span>
                {evt && <span className={`dot ${evt}`}></span>}
                {mood && <span className={`moodchip ${mood}`}></span>}
              </div>
            );
          })}
        </div>
        <div className="actions">
          <button 
            className="primary" 
            onClick={() => addEvent("start", selectedDate)}
            disabled={isSelectedDateInCycle}
            title={isSelectedDateInCycle ? "This date is already part of a period." : "Log period started"}
          >
            Period Started
          </button>
          <button 
            className="outline" 
            onClick={() => addEvent("end", selectedDate)}
            disabled={!relevantOpenCycleForDate}
            title={!relevantOpenCycleForDate ? "Can only end a period on a date after it has started." : "Log period ended"}
          >
            Period Ended
          </button>
        </div>
        {statusMsg && <p className="status">{statusMsg}</p>}
      </div>
      <div className="right-col">
        <div className="card mood-card">
          <h3>How are you feeling today?</h3>
          <div className="mood-row">
            {MOODS.map((m) => (
              <button 
                key={m.key} 
                className={`mood-btn ${m.key} ${moodByDate.get(selectedDate) === m.key ? "active" : ""}`} 
                onClick={() => setMood(m.key, selectedDate)}
              >
                <div className="icon">{m.icon}</div>
                <div className="label">{m.label}</div>
              </button>
            ))}
          </div>
          <p className="hint">Selected date: <b>{selectedDate}</b></p>
        </div>
        <div className="card stats-card">
          <h3>Your Insights</h3>
          <ul>
            <li><span className="k">Next period:</span> <span className="v">{predicted.nextStart ? predicted.nextStart.toLocaleDateString() : "Need more data"}</span></li>
            <li>
              <span className="k">Avg cycle length:</span>
              <span className="v stat-edit">
                <input 
                  type="number" 
                  value={profile.custom_cycle_length ?? ''} 
                  onChange={e => handleProfileInputChange('custom_cycle_length', e.target.value)} 
                  onBlur={e => updateCustomSetting('custom_cycle_length', e.target.value)} 
                  placeholder={predicted.avgCycle ? `${predicted.avgCycle} days` : "—"} 
                  min="1" 
                />
              </span>
            </li>
            <li>
              <span className="k">Avg period length:</span>
              <span className="v stat-edit">
                <input 
                  type="number" 
                  value={profile.custom_period_length ?? ''} 
                  onChange={e => handleProfileInputChange('custom_period_length', e.target.value)} 
                  onBlur={e => updateCustomSetting('custom_period_length', e.target.value)} 
                  placeholder={predicted.avgPeriod ? `${predicted.avgPeriod} days` : "—"} 
                  min="1" 
                />
              </span>
            </li>
            <li><span className="k">Currently on period:</span> <span className="v">{currentlyMenstruating ? "Yes" : "No"}</span></li>
            <li><span className="k">Mood on selected day:</span> <span className="v">{moodByDate.get(selectedDate) || "not logged"}</span></li>
          </ul>
          
          {/* ✅ --- DYNAMIC "MINI WRAPPED" DISPLAY --- ✅ */}
          <div className="wrapped">
            <p className="wrapped-title">Mini Wrapped</p>
            {monthlyWrappedData.moodLogCount > 0 || monthlyWrappedData.avgPeriodLength > 0 ? (
              <ul className="wrapped-stats">
                {monthlyWrappedData.mostCommonMood && (
                  <li>Your most frequent mood was <b>{monthlyWrappedData.mostCommonMood}</b>.</li>
                )}
                {monthlyWrappedData.avgPeriodLength > 0 && (
                  <li>Your average period length was <b>{monthlyWrappedData.avgPeriodLength} days</b>.</li>
                )}
                {monthlyWrappedData.moodLogCount > 0 && (
                  <li>You logged your mood <b>{monthlyWrappedData.moodLogCount}</b> {monthlyWrappedData.moodLogCount === 1 ? 'time' : 'times'}.</li>
                )}
              </ul>
            ) : (
              <p className="wrapped-note">Keep logging to unlock your monthly recap ✨</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}




