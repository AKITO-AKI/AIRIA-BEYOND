import React, { useState, useEffect } from 'react';
import { generateAbstractImage, canvasToDataURL, downloadCanvasAsPNG } from './utils/canvasRenderer';
import { MAX_SEED } from './utils/prng';
import { useAlbums } from './contexts/AlbumContext';
import { useCausalLog } from './contexts/CausalLogContext';
import { 
  generateImage, 
  pollJobStatus, 
  retryJob, 
  JobStatus,
  analyzeSession,
  pollAnalysisJobStatus,
  AnalysisJobStatus,
  IntermediateRepresentation,
  generateMusic,
  pollMusicJobStatus,
  MusicJobStatus,
} from './api/imageApi';
import {
  logAnalysisStage,
  logImageStage,
  logMusicStage,
  logAlbumStage,
  logError,
} from './utils/causalLogging/loggingHelpers';

// Helper to generate reasoning for image prompt (P5)
function generateImageReasoning(params: {
    valence?: number;
    arousal?: number;
    stylePreset?: string;
    motifTags?: string[];
}): string {
    const reasons: string[] = [];
    
    if (params.valence !== undefined) {
        if (params.valence < -0.3) {
            reasons.push('低いvalence（不快な感情）から暗めの雰囲気を選択');
        } else if (params.valence > 0.3) {
            reasons.push('高いvalence（快適な感情）から明るく希望的な雰囲気を選択');
        }
    }
    
    if (params.arousal !== undefined) {
        if (params.arousal < 0.3) {
            reasons.push('低いarousal（穏やか）から静的で柔らかな表現を選択');
        } else if (params.arousal > 0.7) {
            reasons.push('高いarousal（興奮）からダイナミックで力強い表現を選択');
        }
    }
    
    if (params.stylePreset) {
        const presetName = STYLE_PRESETS.find(p => p.id === params.stylePreset)?.name || params.stylePreset;
        reasons.push(`${presetName}スタイルを選択し、感情に合った芸術的表現を実現`);
    }
    
    if (params.motifTags && params.motifTags.length > 0) {
        reasons.push(`モチーフタグ（${params.motifTags.join('、')}）を使用して具体的なイメージを生成`);
    }
    
    return reasons.length > 0 ? reasons.join('。') + '。' : '画像生成パラメータに基づいて生成しました。';
}

// Preset configurations for image generation
const IMAGE_PRESETS = [
    { name: '標準', width: 800, height: 600 },
    { name: '正方形', width: 600, height: 600 },
    { name: 'ワイド', width: 1200, height: 600 },
    { name: '高解像度', width: 1920, height: 1080 }
];

// Timeout to allow UI to update before heavy image generation
const IMAGE_GENERATION_DELAY_MS = 100;

// Style presets for external generation (P3 updated)
const STYLE_PRESETS = [
    { id: 'oil-painting', name: '油絵' },
    { id: 'watercolor', name: '水彩画' },
    { id: 'impressionism', name: '印象派' },
    { id: 'abstract-minimal', name: '抽象ミニマル' },
    { id: 'romantic-landscape', name: 'ロマン派風景' },
];

const Phase1SessionUI = () => {
    const { addAlbum } = useAlbums();
    const { createLog, updateLog, getLog } = useCausalLog();
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
    const [selectedStylePreset, setSelectedStylePreset] = useState('oil-painting');
    const [externalImageUrl, setExternalImageUrl] = useState<string | null>(null);

    // Analysis state (P2)
    const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
    const [analysisJobStatus, setAnalysisJobStatus] = useState<AnalysisJobStatus | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<IntermediateRepresentation | null>(null);

    // Music generation state (P4)
    const [musicJobId, setMusicJobId] = useState<string | null>(null);
    const [musicJobStatus, setMusicJobStatus] = useState<MusicJobStatus | null>(null);
    const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
    const [musicData, setMusicData] = useState<string | null>(null);

    // P5: Causal logging state
    const [currentLogId, setCurrentLogId] = useState<string | null>(null);
    const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
    const [imageGenStartTime, setImageGenStartTime] = useState<number | null>(null);
    const [musicGenStartTime, setMusicGenStartTime] = useState<number | null>(null);

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
        motif_tags: [] as string[],
        confidence: 0
    });

    useEffect(() => {
        let interval: number | undefined;
        if (isRunning) {
            interval = window.setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        } else if (!isRunning && timer !== 0) {
            if (interval !== undefined) clearInterval(interval);
        }
        return () => {
            if (interval !== undefined) clearInterval(interval);
        };
    }, [isRunning, timer]);

    const startTimer = () => {
        setError(null);
        const newSeed = Math.floor(Math.random() * MAX_SEED);
        const sessionId = 'session_' + Date.now();
        const timestamp = new Date();
        
        setSessionData({ 
            ...sessionData, 
            started_at: timestamp.toISOString(), 
            session_id: sessionId,
            seed: newSeed,
            mood_choice: mood,
            duration_sec: duration
        });
        
        // P5: Create causal log
        const logId = createLog(sessionId, {
            mood,
            duration,
            timestamp,
        });
        setCurrentLogId(logId);
        
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

            // P4: Enhanced album with music data
            const newAlbumData = {
                mood: sessionData.mood_choice,
                duration: sessionData.duration_sec,
                imageDataURL: externalImageUrl || previewImageURL || '',
                sessionData: sessionData,
                metadata: {
                    // IR data from P2 analysis
                    valence: sessionData.valence,
                    arousal: sessionData.arousal,
                    focus: sessionData.focus,
                    motif_tags: sessionData.motif_tags,
                    confidence: sessionData.confidence,
                    // Generation parameters
                    stylePreset: selectedStylePreset,
                    seed: sessionData.seed,
                    provider: externalImageUrl ? 'replicate' : 'local',
                },
                // P4: Music data
                musicData: musicData || undefined,
                musicFormat: musicData ? 'midi' : undefined,
                musicMetadata: musicJobStatus?.result ? {
                    key: musicJobStatus.result.key,
                    tempo: musicJobStatus.result.tempo,
                    timeSignature: musicJobStatus.result.timeSignature,
                    form: musicJobStatus.result.form,
                    character: musicJobStatus.result.character,
                    duration: sessionData.duration_sec,
                    createdAt: musicJobStatus.createdAt,
                    provider: musicJobStatus.provider,
                } : undefined,
                // P5: Link to causal log
                causalLogId: currentLogId || undefined,
            };
            
            addAlbum(newAlbumData as any);

            // P5: Log album creation
            if (currentLogId) {
                // Get the album ID that was just created (it's the last one added)
                // Note: This is a simplification - in production you'd want the addAlbum to return the ID
                logAlbumStage(updateLog, currentLogId, {
                    albumId: `album_${Date.now()}`, // Approximate - real ID is generated in addAlbum
                    title: `${sessionData.mood_choice} - ${sessionData.duration_sec}s`,
                });
            }

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            setError('アルバムへの保存中にエラーが発生しました');
            console.error(err);
        }
    };

    // Helper to format error message with error code
    const formatErrorMessage = (status: JobStatus): string => {
        const errorMsg = status.errorMessage || status.error || '外部画像生成に失敗しました';
        return status.errorCode ? `[${status.errorCode}] ${errorMsg}` : errorMsg;
    };

    // Run analysis before image generation (P2)
    const runAnalysis = async () => {
        try {
            setError(null);
            setIsAnalyzing(true);
            setAnalysisJobId(null);
            setAnalysisJobStatus(null);
            setAnalysisResult(null);

            // P5: Track analysis start time
            const analysisStart = Date.now();
            setAnalysisStartTime(analysisStart);

            console.log('[UI] Starting analysis for session:', sessionData.session_id);

            // Call analysis API
            const response = await analyzeSession({
                mood: sessionData.mood_choice,
                duration: sessionData.duration_sec,
                timestamp: sessionData.ended_at || new Date().toISOString(),
            });

            setAnalysisJobId(response.jobId);

            // Poll for status
            const finalStatus = await pollAnalysisJobStatus(
                response.jobId,
                (status) => {
                    setAnalysisJobStatus(status);
                }
            );

            if (finalStatus.status === 'succeeded' && finalStatus.result) {
                setAnalysisResult(finalStatus.result);
                
                // Update session data with IR
                setSessionData(prev => ({
                    ...prev,
                    valence: finalStatus.result!.valence,
                    arousal: finalStatus.result!.arousal,
                    focus: finalStatus.result!.focus,
                    motif_tags: finalStatus.result!.motif_tags,
                    confidence: finalStatus.result!.confidence,
                }));

                // P5: Log analysis completion
                if (currentLogId) {
                    const analysisDuration = Date.now() - analysisStart;
                    logAnalysisStage(updateLog, currentLogId, {
                        ir: finalStatus.result,
                        reasoning: finalStatus.result.reasoning || 'No reasoning provided by LLM',
                        duration: analysisDuration,
                        provider: finalStatus.provider || 'openai',
                        model: 'gpt-4o-mini',
                    });
                }

                console.log('[UI] Analysis completed successfully:', finalStatus.result);
                return finalStatus.result;
            } else if (finalStatus.status === 'failed') {
                const errorMsg = finalStatus.errorMessage || finalStatus.error || '分析に失敗しました';
                setError(`分析エラー: ${errorMsg}`);
                console.error('[UI] Analysis failed:', errorMsg);
                
                // P5: Log error
                if (currentLogId) {
                    logError(updateLog, getLog, currentLogId, 'analysis', errorMsg);
                }
                
                return null;
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : '分析中にエラーが発生しました';
            setError(errorMsg);
            console.error('[UI] Analysis error:', err);
            
            // P5: Log error
            if (currentLogId) {
                logError(updateLog, getLog, currentLogId, 'analysis', errorMsg);
            }
            
            return null;
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Music generation (P4)
    const runMusicGeneration = async (ir?: IntermediateRepresentation) => {
        try {
            setError(null);
            setIsGeneratingMusic(true);
            setMusicJobId(null);
            setMusicJobStatus(null);
            setMusicData(null);

            // P5: Track music generation start time
            const musicStart = Date.now();
            setMusicGenStartTime(musicStart);

            // Use IR if provided, otherwise use session data
            const effectiveIR = ir || {
                valence: sessionData.valence,
                arousal: sessionData.arousal,
                focus: sessionData.focus,
                motif_tags: sessionData.motif_tags,
                confidence: sessionData.confidence,
            };

            console.log('[UI] Starting music generation with IR:', effectiveIR);

            // Call music generation API
            const response = await generateMusic({
                valence: effectiveIR.valence,
                arousal: effectiveIR.arousal,
                focus: effectiveIR.focus,
                motif_tags: effectiveIR.motif_tags,
                confidence: effectiveIR.confidence,
                duration: sessionData.duration_sec,
                seed: sessionData.seed,
            });

            setMusicJobId(response.jobId);

            // Poll for status
            const finalStatus = await pollMusicJobStatus(
                response.jobId,
                (status) => {
                    setMusicJobStatus(status);
                }
            );

            if (finalStatus.status === 'succeeded' && finalStatus.midiData) {
                setMusicData(finalStatus.midiData);
                
                // P5: Log music generation completion
                if (currentLogId && finalStatus.result) {
                    const musicDuration = Date.now() - musicStart;
                    logMusicStage(updateLog, currentLogId, {
                        structure: finalStatus.result,
                        reasoning: finalStatus.result.reasoning || 'No reasoning provided by LLM',
                        jobId: response.jobId,
                        provider: finalStatus.provider || 'openai',
                        model: 'gpt-4o-mini',
                        duration: musicDuration,
                        retryCount: finalStatus.retryCount || 0,
                    });
                }
                
                console.log('[UI] Music generation completed successfully');
                return finalStatus.midiData;
            } else if (finalStatus.status === 'failed') {
                const errorMsg = finalStatus.errorMessage || finalStatus.error || '音楽生成に失敗しました';
                console.error('[UI] Music generation failed:', errorMsg);
                
                // P5: Log error
                if (currentLogId) {
                    logError(updateLog, getLog, currentLogId, 'music-generation', errorMsg);
                }
                
                // Don't throw - music generation is optional
                return null;
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : '音楽生成中にエラーが発生しました';
            console.error('[UI] Music generation error:', err);
            
            // P5: Log error
            if (currentLogId) {
                logError(updateLog, getLog, currentLogId, 'music-generation', errorMsg);
            }
            
            // Don't throw - music generation is optional
            return null;
        } finally {
            setIsGeneratingMusic(false);
        }
    };

    // External image generation with Replicate (now with analysis and music)
    const generateExternalImage = async () => {
        try {
            setError(null);
            setIsGeneratingExternal(true);
            setExternalJobId(null);
            setExternalJobStatus(null);
            setExternalImageUrl(null);

            // First, run analysis to get IR (P2)
            console.log('[UI] Running analysis before generation...');
            const ir = await runAnalysis();
            
            if (!ir) {
                // Analysis failed, but we can still generate with existing session data
                console.warn('[UI] Analysis failed, using existing session data');
            }

            // P4: Start both image AND music generation in parallel
            console.log('[UI] Starting parallel image + music generation...');
            
            // P5: Track image generation start time
            const imageStart = Date.now();
            setImageGenStartTime(imageStart);
            
            // Start music generation (don't await - run in parallel)
            const musicPromise = runMusicGeneration(ir || undefined);

            // Start image generation with IR data
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

            // Poll for image status
            const finalStatus = await pollJobStatus(
                response.jobId,
                (status) => {
                    setExternalJobStatus(status);
                }
            );

            if (finalStatus.status === 'succeeded' && finalStatus.resultUrl) {
                setExternalImageUrl(finalStatus.resultUrl);
                
                // P5: Log image generation completion
                if (currentLogId) {
                    const imageDuration = Date.now() - imageStart;
                    const reasoning = generateImageReasoning({
                        valence: sessionData.valence,
                        arousal: sessionData.arousal,
                        stylePreset: selectedStylePreset,
                        motifTags: sessionData.motif_tags,
                    });
                    
                    logImageStage(updateLog, currentLogId, {
                        prompt: finalStatus.prompt || '',
                        negativePrompt: finalStatus.negativePrompt || '',
                        stylePreset: selectedStylePreset,
                        seed: sessionData.seed,
                        reasoning,
                        jobId: response.jobId,
                        provider: 'replicate',
                        model: 'sdxl',
                        resultUrl: finalStatus.resultUrl,
                        duration: imageDuration,
                        retryCount: finalStatus.retryCount || 0,
                    });
                }
            } else if (finalStatus.status === 'failed') {
                const errorMsg = formatErrorMessage(finalStatus);
                setError(errorMsg);
                
                // P5: Log error
                if (currentLogId) {
                    logError(updateLog, getLog, currentLogId, 'image-generation', errorMsg);
                }
            }

            // Wait for music generation to complete (if still running)
            await musicPromise;

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : '外部画像生成中にエラーが発生しました';
            setError(errorMsg);
            console.error(err);
            
            // P5: Log error
            if (currentLogId) {
                logError(updateLog, getLog, currentLogId, 'image-generation', errorMsg);
            }
        } finally {
            setIsGeneratingExternal(false);
        }
    };

    // Retry external generation
    const retryExternalGeneration = async () => {
        try {
            setError(null);
            
            if (!externalJobStatus) {
                // If no previous job, just start fresh
                await generateExternalImage();
                return;
            }
            
            setIsGeneratingExternal(true);
            setExternalJobId(null);
            setExternalImageUrl(null);
            
            // Retry by creating new job with same input
            const response = await retryJob(externalJobStatus.id);
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
                setError(formatErrorMessage(finalStatus));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'リトライ中にエラーが発生しました');
            console.error(err);
        } finally {
            setIsGeneratingExternal(false);
        }
    };
    
    // Fallback to local generation
    const fallbackToLocal = () => {
        setError(null);
        setExternalJobStatus(null);
        setExternalJobId(null);
        setExternalImageUrl(null);
        // Trigger local PNG generation
        generatePNG();
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
                    
                    {/* P4: Updated progress flow with music generation */}
                    {(isAnalyzing || isGeneratingExternal || isGeneratingMusic || externalImageUrl || musicData) && (
                        <div className="progress-flow">
                            <div className={`progress-step ${isAnalyzing ? 'active' : analysisResult ? 'completed' : ''}`}>
                                <div className="step-icon">
                                    {analysisResult ? '✓' : isAnalyzing ? '⏳' : '1'}
                                </div>
                                <div className="step-label">解析中...</div>
                            </div>
                            <div className="progress-arrow">→</div>
                            <div className={`progress-step ${isGeneratingExternal ? 'active' : externalImageUrl ? 'completed' : ''}`}>
                                <div className="step-icon">
                                    {externalImageUrl ? '✓' : isGeneratingExternal ? '⏳' : '2'}
                                </div>
                                <div className="step-label">画像生成中...</div>
                            </div>
                            <div className="progress-arrow">→</div>
                            <div className={`progress-step ${isGeneratingMusic ? 'active' : musicData ? 'completed' : ''}`}>
                                <div className="step-icon">
                                    {musicData ? '✓' : isGeneratingMusic ? '⏳' : '3'}
                                </div>
                                <div className="step-label">音楽生成中...</div>
                            </div>
                            <div className="progress-arrow">→</div>
                            <div className={`progress-step ${externalImageUrl && musicData && !isGeneratingExternal && !isGeneratingMusic ? 'completed' : ''}`}>
                                <div className="step-icon">
                                    {externalImageUrl && musicData && !isGeneratingExternal && !isGeneratingMusic ? '✓' : '4'}
                                </div>
                                <div className="step-label">完了</div>
                            </div>
                        </div>
                    )}
                    
                    {/* Analysis status display (P2) */}
                    {isAnalyzing && analysisJobStatus && (
                        <div className="analysis-status" role="status" aria-live="polite">
                            <div className="spinner"></div>
                            <p>
                                🔍 分析中: {
                                    analysisJobStatus.status === 'queued' ? '待機中...' : 
                                    analysisJobStatus.status === 'running' ? `実行中... (${analysisJobStatus.provider})` : 
                                    analysisJobStatus.status
                                }
                            </p>
                        </div>
                    )}

                    {/* Display analysis result */}
                    {analysisResult && !isAnalyzing && (
                        <div className="analysis-result">
                            <h3>📊 分析結果</h3>
                            <div className="analysis-details">
                                <p><strong>感情価:</strong> {analysisResult.valence.toFixed(2)} (-1～+1)</p>
                                <p><strong>興奮度:</strong> {analysisResult.arousal.toFixed(2)} (0～1)</p>
                                <p><strong>集中度:</strong> {analysisResult.focus.toFixed(2)} (0～1)</p>
                                <p><strong>モチーフ:</strong> {analysisResult.motif_tags.join(', ')}</p>
                                <p><strong>確信度:</strong> {(analysisResult.confidence * 100).toFixed(0)}%</p>
                            </div>
                        </div>
                    )}
                    
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
                                ステータス: {
                                    externalJobStatus.status === 'queued' ? '生成待機中...' : 
                                    externalJobStatus.status === 'running' ? `生成中... (${externalJobStatus.provider})` : 
                                    externalJobStatus.status
                                }
                            </p>
                            {externalJobId && <p className="job-id">Job ID: {externalJobId}</p>}
                            {externalJobStatus.retryCount > 0 && (
                                <p className="retry-info">
                                    リトライ回数: {externalJobStatus.retryCount}/{externalJobStatus.maxRetries}
                                </p>
                            )}
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

                    {externalJobStatus?.status === 'failed' && !isGeneratingExternal && (
                        <div className="error-container" role="alert">
                            <div className="error-details">
                                <p className="error-title">❌ 外部生成に失敗しました</p>
                                {externalJobStatus.errorCode && (
                                    <p className="error-code">エラーコード: {externalJobStatus.errorCode}</p>
                                )}
                                <p className="error-message">
                                    {externalJobStatus.errorMessage || externalJobStatus.error || '不明なエラー'}
                                </p>
                                {externalJobStatus.retryCount > 0 && (
                                    <p className="retry-count">
                                        {externalJobStatus.retryCount}回リトライしましたが失敗しました
                                    </p>
                                )}
                            </div>
                            <div className="button-group error-actions">
                                <button 
                                    onClick={retryExternalGeneration}
                                    className="btn btn-secondary"
                                    aria-label="再試行"
                                >
                                    🔄 再試行
                                </button>
                                <button 
                                    onClick={fallbackToLocal}
                                    className="btn btn-outline"
                                    aria-label="ローカル生成に切り替え"
                                >
                                    🎨 ローカル生成に切り替え
                                </button>
                            </div>
                            <p className="fallback-help">
                                外部生成がうまくいかない場合は、ローカル生成をお試しください。
                            </p>
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