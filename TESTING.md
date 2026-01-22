# Testing Guide for External Image Generation

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

### Test Scenarios

#### Scenario 1: External Image Generation (with API token)
1. Navigate to Main room
2. Create a session (select mood and duration, click Start/Stop)
3. Scroll to "外部生成 (Replicate SDXL)" section
4. Select a style preset (e.g., 抽象油絵)
5. Click "外部生成(Replicate)" button
6. Observe:
   - Button changes to "⏳ 生成中..."
   - Status updates: "キュー待ち" → "生成中"
   - Job ID is displayed
   - After 30-60 seconds, image appears
7. Verify image is displayed correctly
8. Click "アルバムに保存" to save to album
9. Navigate to Gallery room to verify saved image

#### Scenario 2: Fallback (without API token)
1. Rename/remove .env file or unset REPLICATE_API_TOKEN
2. Restart development server
3. Try to generate external image
4. Verify error message: "REPLICATE_API_TOKEN is not set. Please use local generation instead."
5. Verify local PNG generation still works

#### Scenario 3: Rate Limiting
1. Quickly click "外部生成(Replicate)" 6+ times
2. After 5th request, should see: "Too many requests. Please wait a minute and try again."
3. Wait 1 minute and verify requests work again

#### Scenario 4: Concurrency Limit
1. Open multiple browser tabs
2. Start external generation in 4+ tabs simultaneously
3. Verify 4th request returns: "Too many images generating. Please wait for one to complete."

#### Scenario 5: Error Handling
1. Use an invalid API token
2. Try to generate an image
3. Verify error message is displayed
4. Click "🔄 再試行" button
5. Verify generation is retried

## API Testing

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
  "provider": "replicate",
  "model": "stability-ai/sdxl:...",
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
  "provider": "replicate",
  "model": "stability-ai/sdxl:...",
  "inputSummary": {...},
  "resultUrl": "https://replicate.delivery/pbxt/..."
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
