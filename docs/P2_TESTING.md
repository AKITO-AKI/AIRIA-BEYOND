# Testing Guide for Prototype P2

## Prerequisites

1. Set up OpenAI API key (optional - fallback works without it):
   ```bash
   export OPENAI_API_KEY=sk-...
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Test Cases

### Test 1: Normal LLM Analysis Flow

**Setup**: Set valid `OPENAI_API_KEY` in environment

**Steps**:
1. Start the dev server: `npm run dev`
2. Open the app in browser
3. Select mood: "穏やか"
4. Select duration: "2分"
5. Click "開始" to start session
6. Wait for timer to run (or click "停止" immediately)
7. Click "🌐 外部生成(Replicate)"

**Expected Result**:
- ✅ Shows "🔍 分析中..." status
- ✅ Analysis completes in ~2-5 seconds
- ✅ Displays analysis result card with:
  - Valence value (-1 to +1)
  - Arousal value (0 to 1)
  - Focus value (0 to 1)
  - 3-5 motif tags in Japanese
  - Confidence percentage
- ✅ Provider shows "openai"
- ✅ Image generation starts with IR data

**Console Logs to Check**:
```
[UI] Starting analysis for session: ...
[LLM] Calling OpenAI API for analysis
[LLM] Raw response: {...}
[LLM] Successfully validated IR
[Analysis] Job ... completed successfully with provider: openai
```

---

### Test 2: Rule-based Fallback (No API Key)

**Setup**: Remove or unset `OPENAI_API_KEY`

**Steps**:
1. Unset API key: `unset OPENAI_API_KEY`
2. Start dev server: `npm run dev`
3. Complete a session with mood "嬉しい"
4. Click "🌐 外部生成(Replicate)"

**Expected Result**:
- ✅ Analysis completes immediately (no LLM call)
- ✅ Provider shows "rule-based"
- ✅ Results match mood mapping:
  - Valence: 0.8
  - Arousal: 0.7
  - Motif tags: ['光','希望','朝焼け','アレグロ']
  - Confidence: 50%
- ✅ Image generation proceeds normally

**Console Logs to Check**:
```
[Analysis] Using rule-based fallback (forced or no API key)
[RuleBased] Generating IR using rules
```

---

### Test 3: Rule-based Fallback (Force Flag)

**Setup**: Set `DISABLE_LLM_ANALYSIS=true` in environment

**Steps**:
1. Export flag: `export DISABLE_LLM_ANALYSIS=true`
2. Start dev server with valid API key
3. Complete session and generate

**Expected Result**:
- ✅ Uses rule-based despite having API key
- ✅ No OpenAI API calls made
- ✅ Provider shows "rule-based"

---

### Test 4: Rate Limiting

**Setup**: Normal setup with API key

**Steps**:
1. Rapidly click "🌐 外部生成" 6+ times
2. Observe rate limit behavior

**Expected Result**:
- ✅ First 5 requests succeed
- ✅ 6th request returns 429 error
- ✅ Error message: "Rate limit exceeded"
- ✅ After 60 seconds, can make requests again

---

### Test 5: Different Moods

**Setup**: Normal setup

**Test each mood**:
1. 穏やか (Calm)
2. 嬉しい (Happy)
3. 不安 (Anxious)
4. 疲れ (Tired)

**Expected Results**:

**穏やか**:
- Positive valence (~0.4 to 0.8)
- Low arousal (~0.1 to 0.3)
- Calming motif tags: 静寂, 水面, 凪, etc.

**嬉しい**:
- High positive valence (~0.6 to 0.9)
- Moderate-high arousal (~0.5 to 0.8)
- Uplifting motif tags: 光, 希望, 朝焼け, etc.

**不安**:
- Negative valence (~-0.6 to -0.2)
- Moderate-high arousal (~0.5 to 0.7)
- Tense motif tags: 緊張, 暗雲, 嵐, etc.

**疲れ**:
- Slightly negative valence (~-0.3 to 0)
- Very low arousal (~0 to 0.2)
- Subdued motif tags: 憂鬱, 影, 夕暮れ, etc.

---

### Test 6: Duration Impact on Focus

**Setup**: Normal setup

**Steps**:
1. Test 30-second session
2. Test 60-second session
3. Test 120-second session
4. Test 180-second session

**Expected Result**:
- ✅ Focus increases with duration
- ✅ 30s: focus ~0.4-0.5
- ✅ 60s: focus ~0.5-0.6
- ✅ 120s: focus ~0.7-0.8
- ✅ 180s: focus ~0.8-0.9
- ✅ Never exceeds 0.9

---

### Test 7: Concurrency Limiting

**Setup**: Normal setup

**Steps**:
1. Open 4 browser tabs
2. Start sessions in all tabs
3. Click "外部生成" simultaneously in all tabs

**Expected Result**:
- ✅ First 3 analyses start
- ✅ 4th returns 429 "Too many concurrent jobs"
- ✅ Once one completes, next can start

---

### Test 8: Analysis with Free Text (Optional)

**Setup**: Modify request to include freeText

**Steps**:
1. In browser console, call API directly:
   ```javascript
   fetch('/api/analyze', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       mood: '不安',
       duration: 60,
       freeText: '今日は心配事が多い'
     })
   }).then(r => r.json()).then(console.log)
   ```

**Expected Result**:
- ✅ LLM considers freeText in analysis
- ✅ Results may be more personalized
- ✅ Motif tags reflect text context

---

### Test 9: JSON Validation Failure Handling

**Setup**: Mock invalid LLM response (requires code modification for testing)

**Expected Result**:
- ✅ Validation error logged
- ✅ Retries once
- ✅ Falls back to rule-based if retry fails
- ✅ System never crashes

---

### Test 10: End-to-End Flow

**Setup**: Complete setup with Replicate API key

**Steps**:
1. Set both API keys:
   ```bash
   export OPENAI_API_KEY=sk-...
   export REPLICATE_API_TOKEN=r8_...
   ```
2. Start dev server
3. Complete full session:
   - Select mood
   - Run timer
   - Generate external image

**Expected Result**:
- ✅ Analysis runs automatically
- ✅ IR displayed to user
- ✅ motif_tags passed to image generation
- ✅ valence/arousal/focus in job data
- ✅ Image reflects emotional analysis
- ✅ Full pipeline completes successfully

---

## API Testing with curl

### Test Analysis Endpoint

```bash
# Basic analysis request
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "mood": "穏やか",
    "duration": 120
  }'

# Response: { "jobId": "analysis_...", "status": "queued", "message": "Analysis started" }
```

### Check Analysis Status

```bash
# Replace JOB_ID with actual job ID from above
curl http://localhost:3000/api/analyze/JOB_ID
```

### Test with Free Text

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "mood": "不安",
    "duration": 60,
    "freeText": "今日は仕事が大変でした"
  }'
```

---

## Monitoring and Debugging

### Check Console Logs

Important log patterns:
- `[LLM] Calling OpenAI API` - LLM request started
- `[LLM] Successfully validated IR` - LLM response valid
- `[RuleBased] Generating IR` - Fallback triggered
- `[Analysis] Job ... completed successfully` - Analysis succeeded
- `[AnalysisJobStore]` - Job lifecycle events

### Verify API Key

```bash
# Check if API key is set
echo $OPENAI_API_KEY

# Should start with "sk-" for OpenAI
```

### Test Rule-based Fallback Explicitly

```javascript
// In browser console, test rule-based generation
const result = {
  mood: '穏やか',
  duration: 120,
  // Expected output based on rules
};
```

---

## Known Limitations (Prototype)

1. **In-memory storage**: Jobs cleared after 1 hour or server restart
2. **No persistence**: Analysis results not saved to database
3. **Basic rate limiting**: IP-based, no user sessions
4. **No analytics**: Token usage not tracked yet
5. **No caching**: Same input analyzed fresh each time

These are acceptable for P2 prototype phase.

---

## Success Criteria Verification

- ✅ `/api/analyze` endpoint works with LLM
- ✅ Returns valid intermediate representation
- ✅ Fallback to rule-based works when LLM fails
- ✅ Client can call analysis and use result
- ✅ Privacy: no raw media sent to LLM
- ✅ Proper error handling and logging
- ✅ Build passes
- ✅ App runs end-to-end

## Troubleshooting

### "Empty response from OpenAI"
- Check API key is valid
- Check OpenAI account has credits
- Check network connectivity

### "Rate limit exceeded"
- Wait 60 seconds
- Or use `DISABLE_LLM_ANALYSIS=true` for testing

### Build errors
- Run `npm install` to ensure dependencies
- Clear cache: `rm -rf node_modules package-lock.json && npm install`

### Analysis not starting
- Check browser console for errors
- Verify session has been completed (session_id exists)
- Check network tab for API calls
