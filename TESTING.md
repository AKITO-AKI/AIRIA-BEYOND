# Testing Guide for P1: Robust Image Generation

## Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Replicate API token (get from https://replicate.com/account/api-tokens)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env and add your REPLICATE_API_TOKEN
```

## Local Development Testing

### Start the development server
```bash
npm run dev
```

This starts:
- Frontend at http://localhost:5173/AIRIA-BEYOND/
- API at http://localhost:3000/api/*

## P1 Test Scenarios

### Scenario 1: Normal Flow - Success on First Try
**Objective**: Verify successful image generation without retries

1. Navigate to Main room
2. Create a session (select mood and duration, click Start/Stop)
3. Scroll to "外部生成 (Replicate SDXL)" section
4. Select a style preset (e.g., 抽象油絵)
5. Click "外部生成(Replicate)" button
6. Observe:
   - Status changes to "生成待機中..." (queued)
   - Then "生成中... (replicate)" (running)
   - Job ID is displayed
   - Retry count shows 0/3
   - After 30-60 seconds, image appears
7. Verify image is displayed correctly
8. Click "アルバムに保存" to save to album
9. Navigate to Gallery room to verify saved image

**Expected Result**: Job succeeds on first attempt, no retries needed

---

### Scenario 2: Retry Flow - Transient Error Recovery
**Objective**: Verify automatic retry on transient errors

This scenario requires simulating a transient error. In a real environment:
1. Temporarily disrupt network or use an API that occasionally returns 5xx errors
2. Start generation
3. Observe automatic retry with exponential backoff
4. Watch retry count increment: 1/3, 2/3, etc.
5. If recoverable, job eventually succeeds
6. All retry attempts are logged in console

**Expected Result**: Job retries automatically on transient errors with backoff

---

### Scenario 3: Permanent Failure - Max Retries Exceeded
**Objective**: Verify behavior when job fails permanently

1. Use an invalid API token or simulate consistent API errors
2. Start generation
3. Observe:
   - Job attempts up to maxRetries (3) times
   - Each retry is logged with increasing delay
   - After 3 failed attempts, job status shows "failed"
   - Error container displays:
     - "❌ 外部生成に失敗しました"
     - Error code (e.g., [API_ERROR])
     - Error message
     - Retry count: "3回リトライしましたが失敗しました"
4. Two buttons appear:
   - "🔄 再試行" (manual retry)
   - "🎨 ローカル生成に切り替え" (fallback)

**Expected Result**: Job fails after 3 retries, UI shows detailed error and options

---

### Scenario 4: Timeout Handling
**Objective**: Verify timeout after 120 seconds

This requires a slow or stuck generation:
1. Start generation with a configuration that might take >120s
2. Observe timeout after 120 seconds
3. Job marked as failed with errorCode: "TIMEOUT"
4. Error message indicates timeout
5. Retry and fallback options available

**Expected Result**: Job times out at 120s, marked as failed with TIMEOUT error code

---

### Scenario 5: Manual Retry After Failure
**Objective**: Verify manual retry button creates new job

1. Create a failed job (from Scenario 3 or 4)
2. Click "🔄 再試行" button
3. Observe:
   - New job is created with same input parameters
   - New job ID is generated
   - Generation starts fresh with retry count reset to 0/3
   - Status goes through queued → running → succeeded/failed
4. If successful, image displays

**Expected Result**: Manual retry creates new job with same parameters

---

### Scenario 6: Fallback to Local Generation
**Objective**: Verify fallback mechanism works

1. Create a failed external generation job
2. Error container shows fallback option
3. Click "🎨 ローカル生成に切り替え" button
4. Observe:
   - External generation error clears
   - Local PNG generation starts
   - Canvas-based image is generated using session data
   - Image preview appears in "生成された画像 (ローカル)" section
5. Image can be downloaded or saved to album

**Expected Result**: Fallback smoothly transitions from external to local generation

---

### Scenario 7: Job Status Display
**Objective**: Verify all job states are displayed correctly

Test each status:
- **Queued**: Shows "生成待機中..." with spinner
- **Running**: Shows "生成中... (replicate)" with spinner and Job ID
- **Succeeded**: Shows generated image
- **Failed**: Shows error container with detailed info

**Expected Result**: UI clearly communicates each job state

---

### Scenario 8: Error Codes and Messages
**Objective**: Verify error information is displayed

Test different error scenarios:
1. **TIMEOUT**: Generation takes >120s
2. **NETWORK_ERROR**: Network disruption during generation
3. **API_ERROR**: Invalid API response
4. **RATE_LIMIT**: Too many requests (>5 per minute)

For each:
- Error code is displayed in brackets
- Error message explains the issue
- Appropriate recovery options are shown

**Expected Result**: Users receive clear, actionable error information

---

### Scenario 9: Job Cleanup Admin Endpoint
**Objective**: Verify admin endpoints for job management

```bash
# List all jobs
curl http://localhost:3000/api/admin/jobs

# Clear all jobs (for testing)
curl -X DELETE http://localhost:3000/api/admin/jobs
```

**Expected Result**: Admin can view and clear jobs for testing

---

## P0 Test Scenarios (Still Valid)

### Scenario A: Fallback (without API token)
1. Rename/remove .env file or unset REPLICATE_API_TOKEN
2. Restart development server
3. Try to generate external image
4. Verify error message: "REPLICATE_API_TOKEN is not set. Please use local generation instead."
5. Verify local PNG generation still works

#### Scenario B: Rate Limiting
1. Quickly click "外部生成(Replicate)" 6+ times
2. After 5th request, should see: "Too many requests. Please wait a minute and try again."
3. Wait 1 minute and verify requests work again

#### Scenario C: Concurrency Limit
1. Open multiple browser tabs
2. Start external generation in 4+ tabs simultaneously
3. Verify 4th request returns: "Too many images generating. Please wait for one to complete."

---

## API Testing (P0 + P1)

### Test POST /api/image/generate
```bash
curl -X POST http://localhost:3000/api/image/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mood": "穏やか",
    "duration": 60,
    "stylePreset": "abstract-oil",
    "seed": 12345
  }'
```

Expected response:
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "queued",
  "message": "Image generation started"
}
```

### Test GET /api/job/:id
```bash
curl http://localhost:3000/api/job/job_1234567890_abc123
```

Expected response (when running):
```json
{
  "id": "job_1234567890_abc123",
  "status": "running",
  "createdAt": "2026-01-22T02:00:00.000Z",
  "startedAt": "2026-01-22T02:00:01.000Z",
  "retryCount": 0,
  "maxRetries": 3,
  "provider": "replicate",
  "model": "stability-ai/sdxl:...",
  "input": {
    "mood": "穏やか",
    "duration": 60,
    "stylePreset": "abstract-oil",
    "seed": 12345
  },
  "inputSummary": {
    "mood": "穏やか",
    "duration": 60,
    "stylePreset": "abstract-oil",
    "seed": 12345
  }
}
```

Expected response (when succeeded):
```json
{
  "id": "job_1234567890_abc123",
  "status": "succeeded",
  "createdAt": "2026-01-22T02:00:00.000Z",
  "startedAt": "2026-01-22T02:00:01.000Z",
  "finishedAt": "2026-01-22T02:00:45.000Z",
  "retryCount": 0,
  "maxRetries": 3,
  "provider": "replicate",
  "model": "stability-ai/sdxl:...",
  "input": {...},
  "inputSummary": {...},
  "result": "https://replicate.delivery/pbxt/...",
  "resultUrl": "https://replicate.delivery/pbxt/..."
}
```

Expected response (when failed with retries):
```json
{
  "id": "job_1234567890_abc123",
  "status": "failed",
  "createdAt": "2026-01-22T02:00:00.000Z",
  "startedAt": "2026-01-22T02:00:01.000Z",
  "finishedAt": "2026-01-22T02:02:30.000Z",
  "retryCount": 3,
  "maxRetries": 3,
  "provider": "replicate",
  "model": "stability-ai/sdxl:...",
  "input": {...},
  "inputSummary": {...},
  "error": "API Error: Service temporarily unavailable",
  "errorCode": "API_ERROR",
  "errorMessage": "API Error: Service temporarily unavailable"
}
```

### Test GET /api/admin/jobs
```bash
# List all jobs
curl http://localhost:3000/api/admin/jobs
```

Expected response:
```json
{
  "jobs": [
    {
      "id": "job_1234567890_abc123",
      "status": "succeeded",
      ...
    },
    {
      "id": "job_1234567891_def456",
      "status": "failed",
      ...
    }
  ],
  "count": 2
}
```

### Test DELETE /api/admin/jobs
```bash
# Clear all jobs (for testing)
curl -X DELETE http://localhost:3000/api/admin/jobs
```

Expected response:
```json
{
  "message": "All jobs cleared"
}
```

## Build Testing

```bash
npm run build
```

Should complete without errors and create:
- `apps/web/dist/` with static files

## Deployment Testing

### Vercel Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Link project
vercel link

# Add environment variable
vercel env add REPLICATE_API_TOKEN

# Deploy
vercel --prod
```

## Cost Monitoring

Each SDXL generation costs approximately $0.0055 (check current pricing at https://replicate.com/pricing)

Monitor costs:
1. Check Replicate dashboard: https://replicate.com/account/billing
2. Review rate limit logs in browser console
3. Check job counts in development

## Known Limitations

1. **In-memory job store**: Jobs are lost on server restart
2. **No persistent storage**: Images only stored via Replicate URLs
3. **Basic auth**: No user authentication implemented
4. **CORS**: May need CORS configuration for production domains

## Troubleshooting

### "Failed to fetch" error
- Check that API server is running on port 3000
- Verify CORS settings if accessing from different domain

### "Job not found" error
- Job may have expired (1 hour TTL)
- Server may have restarted (in-memory storage)

### Rate limit issues
- Clear rate limits by restarting server
- Wait 1 minute for window to reset

### Image not loading
- Check browser console for CORS errors
- Verify Replicate URL is accessible
- Check if image has crossorigin attribute
