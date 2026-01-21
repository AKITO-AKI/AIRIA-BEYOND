import React, { useState } from 'react';
import { saveAs } from 'file-saver';

const App = () => {
  const [mood, setMood] = useState('');
  const [duration, setDuration] = useState(30);
  const [sessionActive, setSessionActive] = useState(false);

  const handleStartSession = () => {
    const sessionData = {
      mood,
      duration,
      startTime: new Date().toISOString()
    };
    console.log(sessionData);
    // More logic to handle session
    setSessionActive(true);
  };

  const handleStopSession = () => {
    // Logic to stop session
    setSessionActive(false);
  };

  const downloadSessionData = () => {
    const sessionData = {
      mood,
      duration,
      startTime: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    saveAs(blob, 'session-data.json');
  };

  return (
    <div>
      <h1>セッション開始/停止</h1>
      {!sessionActive ? (
        <div>
          <label>気分:</label>
          <select value={mood} onChange={(e) => setMood(e.target.value)}>
            <option value="happy">楽しい</option>
            <option value="neutral">普通</option>
            <option value="sad">悲しい</option>
            <option value="anxious">不安</option>
          </select>
          <br />
          <label>持続時間:</label>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            <option value={30}>30秒</option>
            <option value={60}>1分</option>
            <option value={120}>2分</option>
            <option value={180}>3分</option>
          </select>
          <br />
          <button onClick={handleStartSession}>開始する</button>
        </div>
      ) : (
        <div>
          <button onClick={handleStopSession}>停止する</button>
        </div>
      )}
      <button onClick={downloadSessionData}>ダウンロードデータ</button>
    </div>
  );
};

export default App;