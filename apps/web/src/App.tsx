import React, { useState, useEffect } from 'react';
import { generateAbstractImage, canvasToDataURL, downloadCanvasAsPNG } from './utils/canvasRenderer';
import { MAX_SEED } from './utils/prng';

const Phase1SessionUI = () => {
    const [mood, setMood] = useState('穏やか');
    const [duration, setDuration] = useState(30);
    const [isRunning, setIsRunning] = useState(false);
    const [timer, setTimer] = useState(0);
    const [previewImageURL, setPreviewImageURL] = useState<string | null>(null);
    const [currentCanvas, setCurrentCanvas] = useState<HTMLCanvasElement | null>(null);

    const [sessionData, setSessionData] = useState({
        session_id: '',
        started_at: '',
        ended_at: '',
        duration_sec: duration,
        mood_choice: mood,
        seed: Math.floor(Math.random() * MAX_SEED),
        valence: 0,
        arousal: 0,
        focus: 0,
        motif_tags: [],
        confidence: 0
    });

    useEffect(() => {
        let interval = null;
        if (isRunning) {
            interval = setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        } else if (!isRunning && timer !== 0) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isRunning, timer]);

    const startTimer = () => {
        const newSeed = Math.floor(Math.random() * MAX_SEED);
        setSessionData({ 
            ...sessionData, 
            started_at: new Date().toISOString(), 
            session_id: 'session_' + Date.now(),
            seed: newSeed,
            mood_choice: mood,
            duration_sec: duration
        });
        setIsRunning(true);
        // Clear previous preview when starting new session
        setPreviewImageURL(null);
        setCurrentCanvas(null);
    };

    const stopTimer = () => {
        setSessionData({ ...sessionData, ended_at: new Date().toISOString(), duration_sec: timer });
        setIsRunning(false);
    };

    const downloadJSON = () => {
        const dataStr = JSON.stringify(sessionData);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'session_data.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const generatePNG = () => {
        const canvas = generateAbstractImage(sessionData, 800, 600);
        const dataURL = canvasToDataURL(canvas);
        setPreviewImageURL(dataURL);
        setCurrentCanvas(canvas);
    };

    const downloadPNG = () => {
        if (currentCanvas) {
            downloadCanvasAsPNG(currentCanvas, `session_${sessionData.session_id}.png`);
        }
    };

    return (
        <div>
            <h1>Phase1 Session Mood Selection</h1>
            <select onChange={(e) => setMood(e.target.value)}>
                <option value="穏やか">穏やか</option>
                <option value="嬉しい">嬉しい</option>
                <option value="不安">不安</option>
                <option value="疲れ">疲れ</option>
            </select>
            <select onChange={(e) => setDuration(Number(e.target.value))}>
                <option value="30">30 seconds</option>
                <option value="60">60 seconds</option>
                <option value="120">120 seconds</option>
                <option value="180">180 seconds</option>
            </select>
            <button onClick={startTimer}>Start</button>
            <button onClick={stopTimer}>Stop</button>
            <button onClick={downloadJSON}>Download JSON</button>
            <button onClick={generatePNG} disabled={!sessionData.session_id}>PNG生成</button>
            {previewImageURL && <button onClick={downloadPNG}>Download PNG</button>}
            <div>Timer: {timer}s</div>
            {previewImageURL && (
                <div style={{ marginTop: '20px' }}>
                    <h2>Generated Image Preview:</h2>
                    <img src={previewImageURL} alt="Generated abstract art" style={{ maxWidth: '100%', border: '1px solid #2a395f' }} />
                </div>
            )}
        </div>
    );
};

export default Phase1SessionUI;