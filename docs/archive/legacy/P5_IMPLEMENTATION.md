# P5: Causal Logging and Explainability - Implementation Guide

## Overview

Prototype P5 adds comprehensive causal logging and explainability to AIRIA-BEYOND, making the system transparent and debuggable. Users can understand why they received particular images and music, and developers can trace the entire generation pipeline.

## Architecture

### Data Flow

```
User Input → Create CausalLog
   ↓
Analysis (P2) → Log analysis result + reasoning
   ↓
Image Gen (P3) → Log image result + reasoning
   ↓
Music Gen (P4) → Log music result + reasoning
   ↓
Album Creation → Log album + link to CausalLog
```

### Components

#### 1. CausalLog Data Model (`apps/web/src/types/causalLog.ts`)

Central data structure tracking all stages:
- Input: mood, duration, timestamp
- Analysis: IR values, reasoning, timing, provider
- Image: prompt, style, reasoning, timing, result
- Music: structure, reasoning, timing, result
- Album: final album ID and title
- Metadata: total duration, success status, errors

#### 2. CausalLogContext (`apps/web/src/contexts/CausalLogContext.tsx`)

React context managing logs:
- CRUD operations on logs
- localStorage persistence
- Lifecycle management (30-day retention)
- Privacy sanitization
- Export functionality

#### 3. Logging Helpers (`apps/web/src/utils/causalLogging/loggingHelpers.ts`)

Non-blocking async functions:
- `logAnalysisStage()`: Log P2 analysis completion
- `logImageStage()`: Log P3 image generation
- `logMusicStage()`: Log P4 music generation
- `logAlbumStage()`: Log album creation
- `logError()`: Log errors at any stage

#### 4. ExplainabilityPanel (`apps/web/src/components/ExplainabilityPanel.tsx`)

User-facing UI component showing:
- Timeline of generation stages
- Visual IR gauges (valence, arousal, focus)
- "Why this image?" explanation
- "Why this music?" explanation
- Error display (if any)

#### 5. DebugPanel (`apps/web/src/components/DebugPanel.tsx`)

Developer-facing UI for:
- Viewing all logs
- Exporting logs as JSON
- Deleting individual or all logs
- Inspecting full log details

## Integration Points

### Backend Changes

#### `api/types.ts`
- Added `reasoning` field to `IntermediateRepresentation`
- Added `reasoning` field to `MusicStructure`
- Updated Zod validation schemas

#### `api/llmService.ts`
- Updated system prompt to request reasoning
- LLM now explains valence/arousal/focus choices

Example response:
```json
{
  "valence": 0.6,
  "arousal": 0.2,
  "focus": 0.7,
  "reasoning": "ユーザーの「穏やか」な気分から、快適で落ち着いた感情を検出しました。"
}
```

#### `api/musicLLMService.ts`
- Updated system prompt to request reasoning
- LLM explains key, tempo, form choices

Example response:
```json
{
  "key": "d minor",
  "tempo": 72,
  "reasoning": "短調とゆったりしたテンポで、あなたの感情を音楽的に表現しました。"
}
```

#### `api/promptBuilder.ts`
- Added `generatePromptReasoning()` function
- Explains style and prompt choices

### Frontend Changes

#### `apps/web/src/main.tsx`
- Added `CausalLogProvider` wrapper
- Added `DebugPanel` component

#### `apps/web/src/contexts/AlbumContext.tsx`
- Added `causalLogId` field to `Album` interface

#### `apps/web/src/components/rooms/AlbumRoom.tsx`
- Integrated `ExplainabilityPanel`
- Displays causal log for selected album

#### `apps/web/src/App.tsx`
- Integrated logging throughout generation flow
- Creates log on session start
- Logs each stage completion
- Links album to causal log

## Usage

### For Users

1. **Create a session** in MainRoom
2. **Generate image and music** 
3. **Save to album**
4. **View album in AlbumRoom**
5. **See "説明 (Why?)" section** with:
   - Timeline of generation
   - Analysis values with gauges
   - Image reasoning
   - Music reasoning

### For Developers

1. **Click debug button (🔧)** in bottom-right
2. **View all logs** with success/failure indicators
3. **Expand logs** to see full details
4. **Export logs** as JSON for analysis
5. **Delete logs** as needed

## Privacy & Security

### Data Sanitization

Input is sanitized before logging:
```typescript
{
  mood: "穏やか",              // ✅ Safe
  duration: 60,               // ✅ Safe
  customInput: "[redacted]",  // ❌ Not logged
  onboardingAnswers: "[...]"  // ❌ Not logged
}
```

### Lifecycle Management

- Logs auto-delete after 30 days
- Users can delete their own logs
- No server-side storage (localStorage only)

### Security Measures

- No PII logged
- No API keys logged
- Input sanitization
- Type-safe implementation
- Non-blocking error handling

## Testing

### Manual Testing Steps

1. **Create Session**
   - Start timer
   - Stop timer
   - Verify log created

2. **Run Analysis**
   - Click "解析を実行"
   - Wait for completion
   - Check debug panel for analysis log

3. **Generate Image**
   - Click "外部画像生成"
   - Wait for completion
   - Check debug panel for image log

4. **Generate Music**
   - Music generates in parallel
   - Check debug panel for music log

5. **Save Album**
   - Click "アルバムに保存"
   - Go to Gallery
   - Select album
   - View explainability panel

6. **Test Debug Panel**
   - Click debug button
   - Expand log
   - Export as JSON
   - Delete log

### Build Testing

```bash
npm run build
# Should succeed with no errors
```

### Security Testing

```bash
# CodeQL scan (should find 0 alerts)
```

## Troubleshooting

### Logs Not Appearing

- Check browser console for errors
- Verify localStorage is enabled
- Check if logs were auto-cleaned (>30 days)

### Reasoning Not Showing

- Verify LLM prompts include reasoning field
- Check API responses in network tab
- Ensure `reasoning` field is optional in schemas

### Build Errors

- Run `npm install` to ensure dependencies
- Check TypeScript errors: `npm run build`
- Verify all imports are correct

## Future Enhancements

### Planned (Out of Scope for P5)

1. **Analytics Dashboard**
   - Aggregate statistics
   - Most common motif tags
   - Success/failure rates

2. **A/B Testing**
   - Track different prompts/styles
   - Compare results

3. **User Feedback**
   - Allow users to rate results
   - Link feedback to logs

4. **Server-side Storage**
   - Optional backup to server
   - Cross-device sync

5. **Advanced Export**
   - CSV format
   - Formatted reports
   - Visualization tools

## API Reference

### CausalLogContext Hooks

```typescript
const { 
  createLog,      // Create new log
  getLog,         // Get log by ID
  getLogBySessionId, // Get log by session ID
  updateLog,      // Update log
  deleteLog,      // Delete log
  clearAllLogs,   // Delete all logs
  exportLog,      // Export log as JSON
} = useCausalLog();
```

### Logging Helpers

```typescript
// Log analysis stage
logAnalysisStage(updateLog, logId, {
  ir,
  reasoning,
  duration,
  provider,
  model,
});

// Log image stage
logImageStage(updateLog, logId, {
  prompt,
  negativePrompt,
  stylePreset,
  reasoning,
  jobId,
  provider,
  model,
  resultUrl,
  duration,
  retryCount,
});

// Log music stage
logMusicStage(updateLog, logId, {
  structure,
  reasoning,
  jobId,
  provider,
  model,
  duration,
  retryCount,
});

// Log album creation
logAlbumStage(updateLog, logId, {
  albumId,
  title,
});

// Log error
logError(updateLog, getLog, logId, stage, error);
```

## Summary

P5 successfully implements comprehensive causal logging and explainability for AIRIA-BEYOND. The system is privacy-focused, non-blocking, and provides both user-friendly explanations and developer-oriented debugging tools. All acceptance criteria have been met, code review feedback addressed, and security scans passed.

**Status**: ✅ COMPLETE
**Build**: ✅ SUCCESS  
**Security**: ✅ PASSED (0 alerts)
**Code Review**: ✅ ADDRESSED
