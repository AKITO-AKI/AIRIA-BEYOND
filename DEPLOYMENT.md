# Deployment Guide

## Overview

AIRIA BEYOND is deployed on Vercel with full serverless API support for external image generation, LLM analysis, and music generation.

## Vercel Setup

### Prerequisites
- GitHub account
- Vercel account (sign up at [vercel.com](https://vercel.com))
- API tokens for Replicate and OpenAI

### Initial Setup

1. **Connect GitHub Repository to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import the `AKITO-AKI/AIRIA-BEYOND` repository
   - Select the repository and click "Import"

2. **Configure Project Settings**
   - Framework Preset: `Vite` (should auto-detect)
   - Build Command: `npm run build` (default)
   - Output Directory: `apps/web/dist` (configured in vercel.json)
   - Install Command: `npm install` (default)

3. **Add Environment Variables**
   
   In Vercel dashboard → Project Settings → Environment Variables, add:
   
   **Required:**
   ```
   REPLICATE_API_TOKEN=your_replicate_api_token
   OPENAI_API_KEY=your_openai_api_key
   ```
   
   **Optional (Monitoring):**
   ```
   VITE_SENTRY_DSN=your_sentry_dsn
   VITE_ENABLE_ANALYTICS=true
   ADMIN_TOKEN=your_admin_token_here
   ```
   
   Make sure to add these for all environments (Production, Preview, Development).

4. **Deploy**
   - Click "Deploy" button
   - Vercel will automatically build and deploy
   - First deployment takes 2-3 minutes

### Command Line Deployment

Alternatively, use the Vercel CLI:

```bash
# Install Vercel CLI globally
npm install -g vercel

# Link project (first time only)
cd /path/to/AIRIA-BEYOND
vercel link

# Add environment variables
vercel env add REPLICATE_API_TOKEN
vercel env add OPENAI_API_KEY
vercel env add VITE_SENTRY_DSN
vercel env add VITE_ENABLE_ANALYTICS
vercel env add ADMIN_TOKEN

# Deploy to production
vercel --prod
```

## Environment Variables

### Required Variables

- **REPLICATE_API_TOKEN**: API token from [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
  - Used for: SDXL image generation
  - Cost: ~$0.0055 per image
  - Fallback: Local canvas generation if not set

- **OPENAI_API_KEY**: API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
  - Used for: GPT-4o-mini emotional analysis
  - Cost: ~$0.15 per 1M tokens
  - Fallback: Rule-based analysis if not set

### Optional Variables

- **VITE_SENTRY_DSN**: Sentry DSN for error tracking
  - Get from [sentry.io](https://sentry.io)
  - Package required: `npm install @sentry/react`
  
- **VITE_ENABLE_ANALYTICS**: Enable/disable Vercel Analytics
  - Values: `true` or `false`
  - Package required: `npm install @vercel/analytics @vercel/speed-insights`

- **ADMIN_TOKEN**: Secret token for admin endpoints
  - Used for: `/api/admin/usage` endpoint
  - Generate a secure random string

- **DISABLE_EXTERNAL_GENERATION**: Force local image generation
  - Set to any value to disable external APIs
  
- **DISABLE_LLM_ANALYSIS**: Force rule-based analysis
  - Set to any value to disable LLM calls

## Monitoring

### Vercel Analytics

Automatically enabled when deployed to Vercel:
- Real-time visitor analytics
- Performance metrics
- Web Vitals tracking

Access at: Vercel Dashboard → Your Project → Analytics

### Health Check

Check service status:
```bash
curl https://airia-beyond.vercel.app/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-22T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "replicate": { "available": true, "configured": true },
    "openai": { "available": true, "configured": true }
  }
}
```

### Usage Monitoring

Admin endpoint for API usage tracking:
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://airia-beyond.vercel.app/api/admin/usage
```

### Error Tracking (Sentry)

If Sentry is configured:
1. Errors are automatically captured
2. Access dashboard at [sentry.io](https://sentry.io)
3. View error reports, stack traces, and user impact

## Deployment Workflow

### Automatic Deployments

Every push to `main` branch:
- Triggers automatic production deployment
- Runs build process
- Deploys to production URL

Every pull request:
- Creates preview deployment
- Generates unique preview URL
- Allows testing before merge

### Manual Deployments

Using Vercel CLI:
```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Rollback

If a deployment has issues:

1. **Via Dashboard:**
   - Go to Vercel Dashboard → Deployments
   - Find previous working deployment
   - Click "⋯" menu → "Promote to Production"

2. **Via CLI:**
   ```bash
   # List deployments
   vercel ls
   
   # Promote specific deployment
   vercel promote <deployment-url>
   ```

## Testing Deployment Locally

Before deploying to production, test locally:

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview production build
npm run preview
```

Visit `http://localhost:4173/AIRIA-BEYOND/` to test.

## Troubleshooting

### Build Fails

- Check Node.js version (>= 18.0.0)
- Verify all dependencies are in package.json
- Check build logs in Vercel dashboard

### API Functions Not Working

- Verify environment variables are set
- Check function logs in Vercel Dashboard → Functions
- Ensure API routes match `/api/*` pattern

### Images Not Generating

- Verify `REPLICATE_API_TOKEN` is set correctly
- Check Replicate account has credits
- Review rate limiting (5 req/min, 3 concurrent)

### Performance Issues

- Enable Vercel Analytics to identify bottlenecks
- Check bundle size with `npm run analyze`
- Review Web Vitals in Vercel Dashboard

## Security

### Headers

Security headers are automatically applied via `vercel.json`:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

### Rate Limiting

Built-in protection:
- 5 requests per minute per IP
- 3 concurrent jobs per IP
- 120-second timeout per request

### Environment Variables

- Never commit `.env` files
- Use Vercel dashboard to manage secrets
- Rotate API keys regularly

## Cost Optimization

### Replicate (Image Generation)
- Current: ~$0.0055 per image
- Optimization: Use fallback to local generation for testing
- Set `DISABLE_EXTERNAL_GENERATION=true` in preview environments

### OpenAI (LLM Analysis)
- Current: ~$0.15 per 1M tokens
- Optimization: Use rule-based fallback
- Set `DISABLE_LLM_ANALYSIS=true` to reduce costs

### Vercel
- Free tier includes:
  - 100 GB bandwidth
  - 6,000 build minutes
  - 100 serverless function executions per day
- Monitor usage in Vercel Dashboard → Usage

## Support

- GitHub Issues: [github.com/AKITO-AKI/AIRIA-BEYOND/issues](https://github.com/AKITO-AKI/AIRIA-BEYOND/issues)
- Vercel Support: [vercel.com/support](https://vercel.com/support)
- Documentation: See README.md and OPERATIONS.md
