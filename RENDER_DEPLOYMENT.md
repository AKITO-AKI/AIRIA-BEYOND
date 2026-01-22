# Render Deployment Guide

## Overview

This guide explains how to deploy the AIRIA BEYOND backend API to Render's free tier.

## Architecture

```
┌─────────────────────────────┐
│  GitHub Pages               │
│  (Frontend Static Files)    │
│  https://akito-aki.github.io│
│  /AIRIA-BEYOND/             │
└──────────┬──────────────────┘
           │
           │ API Calls (CORS enabled)
           ▼
┌─────────────────────────────┐
│  Render Web Service         │
│  (Express.js Backend)       │
│  https://airia-beyond.      │
│  onrender.com               │
│  /api/*                     │
└─────────────────────────────┘
```

## Prerequisites

- Render account (free): https://render.com
- GitHub repository connected to Render
- API keys for OpenAI and Replicate

## Setup Steps

### 1. Create Web Service on Render

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repository: `AKITO-AKI/AIRIA-BEYOND`
4. Configure the service:
   - **Name**: `airia-beyond-api`
   - **Environment**: `Node`
   - **Branch**: `main` (or your deployment branch)
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`

### 2. Set Environment Variables

In the Render dashboard, go to your service → "Environment" tab and add:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `REPLICATE_API_TOKEN` | `<your-token>` | Replicate API token for image generation |
| `OPENAI_API_KEY` | `<your-key>` | OpenAI API key for LLM analysis |
| `ADMIN_TOKEN` | Auto-generated | Secret token for admin endpoints |
| `DISABLE_LLM_ANALYSIS` | `false` | Enable LLM-based analysis |

**Note**: Render can auto-generate the `ADMIN_TOKEN` value for you.

### 3. Deploy

Click "Create Web Service" and Render will:

1. Clone your repository
2. Run `npm install` to install dependencies
3. Start the server with `node server.js`
4. Assign a URL like `https://airia-beyond.onrender.com`

The deployment typically takes 2-5 minutes.

### 4. Verify Deployment

Once deployed, test the health check endpoint:

```bash
curl https://airia-beyond.onrender.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "replicate": { "available": true, "configured": true },
    "openai": { "available": true, "configured": true }
  }
}
```

### 5. Update Frontend Configuration

After deployment, update the frontend to use the Render API URL:

1. The production environment variable is already set in `apps/web/.env.production`:
   ```
   VITE_API_BASE_URL=https://airia-beyond.onrender.com
   ```

2. Rebuild the frontend:
   ```bash
   npm run build
   ```

3. Deploy the updated frontend to GitHub Pages.

## Render Free Tier Limitations

### Cold Starts
- **Behavior**: Service sleeps after 15 minutes of inactivity
- **Wake-up time**: ~30 seconds on first request
- **Impact**: Users may experience a delay on the first API call after inactivity

### Monthly Hours
- **Limit**: 750 hours/month (enough for ~31 days of continuous operation)
- **Recommendation**: For a personal project with moderate traffic, this is sufficient

### Keep-Alive Strategy (Optional)

To prevent cold starts, you can ping the health endpoint periodically:

```bash
# Cron job (every 10 minutes)
*/10 * * * * curl https://airia-beyond.onrender.com/api/health > /dev/null 2>&1
```

**Note**: This uses more free tier hours but improves user experience.

## Monitoring

### Health Check

The service includes a health check endpoint at `/api/health`:
- Monitored automatically by Render
- Returns service status and API availability

### Logs

View logs in the Render dashboard:
1. Go to your service
2. Click "Logs" tab
3. View real-time logs and errors

### Metrics

View performance metrics in the Render dashboard:
1. Go to your service
2. Click "Metrics" tab
3. View CPU, memory, and request metrics

## Troubleshooting

### Service Won't Start

1. Check logs in Render dashboard
2. Verify all environment variables are set correctly
3. Ensure `package.json` has correct dependencies

### API Returns 500 Errors

1. Check logs for error details
2. Verify API keys (OpenAI, Replicate) are valid
3. Check service environment variables

### CORS Errors

The server is configured to allow requests from:
- `https://akito-aki.github.io`
- `http://localhost:5173` (development)
- `http://localhost:3000` (development)

If you need to add more origins, edit `server.js`:

```javascript
const allowedOrigins = [
  'https://akito-aki.github.io',
  'http://localhost:5173',
  'http://localhost:3000',
  // Add more origins here
];
```

### Cold Start Performance

If cold starts are problematic:
1. Consider upgrading to a paid Render plan
2. Implement a keep-alive strategy
3. Add loading states in the frontend for better UX

## Cost Comparison

| Service | Plan | Cost | Notes |
|---------|------|------|-------|
| Vercel | Pro | $20/month | Required for serverless functions |
| Render | Free | $0/month | 750 hours/month, cold starts |
| Render | Starter | $7/month | Always-on, no cold starts |

## Local Development

To run the backend locally:

```bash
# Terminal 1: Start API server
npm run server:dev

# Terminal 2: Start frontend
npm run dev:web

# Test API
curl http://localhost:3000/api/health
```

## Updating Deployment

Render automatically redeploys when you push to the configured branch:

1. Make changes locally
2. Commit and push to `main` (or your deployment branch)
3. Render detects the push and redeploys automatically

You can also trigger manual deploys from the Render dashboard.

## Support

- Render Documentation: https://render.com/docs
- Render Community: https://community.render.com
- GitHub Issues: https://github.com/AKITO-AKI/AIRIA-BEYOND/issues
