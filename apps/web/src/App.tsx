import React, { useState, useEffect } from 'react';
import { generateAbstractImage, canvasToDataURL, downloadCanvasAsPNG } from './utils/canvasRenderer';
import { MAX_SEED } from './utils/prng';
import { useAlbums } from './contexts/AlbumContext';
import { generateImage, pollJobStatus, JobStatus } from './api/imageApi';

// Preset configurations for image generation
const IMAGE_PRESETS = [
    { name: '標準', width: 800, height: 600 },
    { name: '正方形', width: 600, height: 600 },
    { name: 'ワイド', width: 1200, height: 600 },
    { name: '高解像度', width: 1920, height: 1080 }
];

// Timeout to allow UI to update before heavy image generation
const IMAGE_GENERATION_DELAY_MS = 100;

// Style presets for external generation
const STYLE_PRESETS = [
    { id: 'abstract-oil', name: '抽象油絵' },
    { id: 'impressionist', name: '印象派風景' },
    { id: 'romantic-landscape', name: 'ロマン派風景' },
    { id: 'minimal-abstract', name: 'ミニマル抽象' },
];

const Phase1SessionUI = () => {
    const { addAlbum } = useAlbums();
    const [mood, setMood] = useState('穏やか');
    const [duration, setDuration] = useState(30);
    const [isRunning, setIsRunning] = useState(false);
    const [timer, setTimer] = useState(0);
    const [previewImageURL, setPreviewImageURL] = useState<string | null>(null);
    const [currentCanvas, setCurrentCanvas] = useState<HTMLCanvasElement | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedPreset, setSelectedPreset] = useState(0);
    const [saveSuccess, setSaveSuccess] = useState(false);
    
    // External image generation state
    const [externalJobId, setExternalJobId] = useState<string | null>(null);
    const [externalJobStatus, setExternalJobStatus] = useState<JobStatus | null>(null);
    const [isGeneratingExternal, setIsGeneratingExternal] = useState(false);
    const [selectedStylePreset, setSelectedStylePreset] = useState('abstract-oil');
    const [externalImageUrl, setExternalImageUrl] = useState<string | null>(null);

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
        let interval: NodeJS.Timeout | null = null;
        if (isRunning) {
            interval = setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        } else if (!isRunning && timer !== 0) {
            if (interval) clearInterval(interval);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRunning, timer]);

    const startTimer = () => {
        setError(null);
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
        setTimer(0);
        // Clear previous preview when starting new session
        setPreviewImageURL(null);
        setCurrentCanvas(null);
    };

    const stopTimer = () => {
        setSessionData({ ...sessionData, ended_at: new Date().toISOString(), duration_sec: timer });
        setIsRunning(false);
    };

    const downloadJSON = () => {
        try {
            setError(null);
            const dataStr = JSON.stringify(sessionData);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session_${sessionData.session_id}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError('JSONのダウンロード中にエラーが発生しました');
            console.error(err);
        }
    };

    const generatePNG = () => {
        try {
            setError(null);
            setIsGenerating(true);
            const preset = IMAGE_PRESETS[selectedPreset];
            // Use setTimeout to allow UI to update before heavy computation
            setTimeout(() => {
                try {
                    const canvas = generateAbstractImage(sessionData, preset.width, preset.height);
                    const dataURL = canvasToDataURL(canvas);
                    setPreviewImageURL(dataURL);
                    setCurrentCanvas(canvas);
                } catch (err) {
                    setError('画像生成中にエラーが発生しました');
                    console.error(err);
                } finally {
                    setIsGenerating(false);
                }
            }, IMAGE_GENERATION_DELAY_MS);
        } catch (err) {
            setError('画像生成中にエラーが発生しました');
            console.error(err);
            setIsGenerating(false);
        }
    };

    const downloadPNG = () => {
        try {
            setError(null);
            if (currentCanvas) {
                downloadCanvasAsPNG(currentCanvas, `session_${sessionData.session_id}.png`);
            }
        } catch (err) {
            setError('PNGのダウンロード中にエラーが発生しました');
            console.error(err);
        }
    };

    const saveToAlbum = () => {
        try {
            setError(null);
            setSaveSuccess(false);
            
            if (!previewImageURL && !externalImageUrl) {
                setError('画像を先に生成してください');
                return;
            }

            addAlbum({
                mood: sessionData.mood_choice,
                duration: sessionData.duration_sec,
                imageDataURL: externalImageUrl || previewImageURL || '',
                sessionData: sessionData,
            });

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            setError('アルバムへの保存中にエラーが発生しました');
            console.error(err);
        }
    };

    // External image generation with Replicate
    const generateExternalImage = async () => {
        try {
            setError(null);
            setIsGeneratingExternal(true);
            setExternalJobId(null);
            setExternalJobStatus(null);
            setExternalImageUrl(null);

            // Start generation
            const response = await generateImage({
                mood: sessionData.mood_choice,
                duration: sessionData.duration_sec,
                motifTags: sessionData.motif_tags,
                stylePreset: selectedStylePreset,
                seed: sessionData.seed,
                valence: sessionData.valence,
                arousal: sessionData.arousal,
                focus: sessionData.focus,
                confidence: sessionData.confidence,
            });

            setExternalJobId(response.jobId);

            // Poll for status
            const finalStatus = await pollJobStatus(
                response.jobId,
                (status) => {
                    setExternalJobStatus(status);
                }
            );

            if (finalStatus.status === 'succeeded' && finalStatus.resultUrl) {
                setExternalImageUrl(finalStatus.resultUrl);
            } else if (finalStatus.status === 'failed') {
                setError(finalStatus.error || '外部画像生成に失敗しました');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '外部画像生成中にエラーが発生しました');
            console.error(err);
        } finally {
            setIsGeneratingExternal(false);
        }
    };

    // Retry external generation
    const retryExternalGeneration = () => {
        generateExternalImage();
    };

    return (
        <div className="app-container">
            <header>
                <h1>AIRIA BEYOND</h1>
                <p className="subtitle">セッション管理とムード記録アプリケーション</p>
            </header>

            {error && (
                <div className="error-message" role="alert" aria-live="polite">
                    ⚠️ {error}
                </div>
            )}

            {saveSuccess && (
                <div className="success-message" role="alert" aria-live="polite">
                    ✓ アルバムに保存しました！ Galleryルームで確認できます。
                </div>
            )}

            <main>
                <section className="session-controls" aria-label="セッション設定">
                    <h2>セッション設定</h2>
                    
                    <div className="control-group">
                        <label htmlFor="mood-select">気分を選択</label>
                        <select 
                            id="mood-select"
                            value={mood}
                            onChange={(e) => setMood(e.target.value)}
                            disabled={isRunning}
                            aria-label="気分選択"
                        >
                            <option value="穏やか">😌 穏やか</option>
                            <option value="嬉しい">😊 嬉しい</option>
                            <option value="不安">😰 不安</option>
                            <option value="疲れ">😫 疲れ</option>
                        </select>
                    </div>

                    <div className="control-group">
                        <label htmlFor="duration-select">時間を選択</label>
                        <select 
                            id="duration-select"
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            disabled={isRunning}
                            aria-label="セッション時間選択"
                        >
                            <option value="30">30秒</option>
                            <option value="60">1分</option>
                            <option value="120">2分</option>
                            <option value="180">3分</option>
                        </select>
                    </div>

                    <div className="timer-display" aria-live="polite" aria-atomic="true">
                        <span className="timer-label">経過時間:</span>
                        <span className="timer-value">{timer}秒</span>
                    </div>

                    <div className="button-group">
                        <button 
                            onClick={startTimer} 
                            disabled={isRunning}
                            className="btn btn-primary"
                            aria-label="セッション開始"
                        >
                            {isRunning ? '実行中...' : '開始'}
                        </button>
                        <button 
                            onClick={stopTimer} 
                            disabled={!isRunning}
                            className="btn btn-secondary"
                            aria-label="セッション停止"
                        >
                            停止
                        </button>
                        <button 
                            onClick={downloadJSON} 
                            disabled={!sessionData.session_id}
                            className="btn btn-outline"
                            aria-label="JSONダウンロード"
                        >
                            📄 JSONダウンロード
                        </button>
                    </div>
                </section>

                <section className="image-generation" aria-label="画像生成">
                    <h2>画像生成</h2>
                    
                    <div className="control-group">
                        <label htmlFor="preset-select">画像サイズ</label>
                        <select 
                            id="preset-select"
                            value={selectedPreset}
                            onChange={(e) => setSelectedPreset(Number(e.target.value))}
                            disabled={isGenerating}
                            aria-label="画像サイズプリセット選択"
                        >
                            {IMAGE_PRESETS.map((preset, index) => (
                                <option key={index} value={index}>
                                    {preset.name} ({preset.width}×{preset.height}px)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="button-group">
                        <button 
                            onClick={generatePNG} 
                            disabled={!sessionData.session_id || isGenerating}
                            className="btn btn-primary"
                            aria-label="PNG生成"
                        >
                            {isGenerating ? '⏳ 生成中...' : '🎨 PNG生成'}
                        </button>
                        {previewImageURL && (
                            <>
                                <button 
                                    onClick={downloadPNG}
                                    className="btn btn-success"
                                    aria-label="PNGダウンロード"
                                >
                                    💾 PNGダウンロード
                                </button>
                                <button 
                                    onClick={saveToAlbum}
                                    className="btn btn-primary"
                                    aria-label="アルバムに保存"
                                >
                                    📚 アルバムに保存
                                </button>
                            </>
                        )}
                    </div>

                    {isGenerating && (
                        <div className="loading-indicator" role="status" aria-live="polite">
                            <div className="spinner"></div>
                            <p>画像を生成しています...</p>
                        </div>
                    )}

                    {previewImageURL && !isGenerating && (
                        <div className="preview-container">
                            <h3>生成された画像 (ローカル)</h3>
                            <img 
                                src={previewImageURL} 
                                alt="セッションデータから生成された抽象アート" 
                                className="preview-image"
                            />
                        </div>
                    )}
                </section>

                <section className="external-generation" aria-label="外部画像生成">
                    <h2>外部生成 (Replicate SDXL)</h2>
                    <p className="section-description">高品質なAI画像生成 - 完了まで30-60秒かかります</p>
                    
                    <div className="control-group">
                        <label htmlFor="style-preset-select">スタイルプリセット</label>
                        <select 
                            id="style-preset-select"
                            value={selectedStylePreset}
                            onChange={(e) => setSelectedStylePreset(e.target.value)}
                            disabled={isGeneratingExternal}
                            aria-label="スタイルプリセット選択"
                        >
                            {STYLE_PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="button-group">
                        <button 
                            onClick={generateExternalImage} 
                            disabled={!sessionData.session_id || isGeneratingExternal}
                            className="btn btn-primary"
                            aria-label="外部生成"
                        >
                            {isGeneratingExternal ? '⏳ 生成中...' : '🌐 外部生成(Replicate)'}
                        </button>
                        {externalImageUrl && (
                            <button 
                                onClick={saveToAlbum}
                                className="btn btn-primary"
                                aria-label="アルバムに保存"
                            >
                                📚 アルバムに保存
                            </button>
                        )}
                    </div>

                    {isGeneratingExternal && externalJobStatus && (
                        <div className="loading-indicator" role="status" aria-live="polite">
                            <div className="spinner"></div>
                            <p>
                                ステータス: {externalJobStatus.status === 'queued' ? 'キュー待ち' : 
                                            externalJobStatus.status === 'running' ? '生成中' : 
                                            externalJobStatus.status}
                            </p>
                            {externalJobId && <p className="job-id">Job ID: {externalJobId}</p>}
                        </div>
                    )}

                    {externalImageUrl && !isGeneratingExternal && (
                        <div className="preview-container">
                            <h3>生成された画像 (Replicate SDXL)</h3>
                            <img 
                                src={externalImageUrl} 
                                alt="Replicate SDXLで生成された画像" 
                                className="preview-image"
                                crossOrigin="anonymous"
                            />
                        </div>
                    )}

                    {externalJobStatus?.status === 'failed' && (
                        <div className="error-message" role="alert">
                            <p>❌ 生成失敗: {externalJobStatus.error || '不明なエラー'}</p>
                            <button 
                                onClick={retryExternalGeneration}
                                className="btn btn-secondary"
                            >
                                🔄 再試行
                            </button>
                        </div>
                    )}
                </section>
            </main>

            <footer>
                <p>セッションデータは決定論的に画像へ変換されます</p>
            </footer>
        </div>
    );
};

export default Phase1SessionUI;