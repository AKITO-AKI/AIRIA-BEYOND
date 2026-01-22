# Operations Guide

## Overview

This guide covers daily operations, monitoring, and incident response for AIRIA BEYOND in production.

## Daily Operations

### Morning Checklist

1. **Check Health Status**
   ```bash
   curl https://airia-beyond.vercel.app/api/health
   ```
   Verify all services are available.

2. **Review Vercel Analytics**
   - Go to Vercel Dashboard → Analytics
   - Check visitor count and traffic patterns
   - Review Web Vitals (LCP, FID, CLS)

3. **Check Error Logs** (if Sentry configured)
   - Go to Sentry Dashboard
   - Review new errors in last 24 hours
   - Prioritize errors affecting multiple users

4. **Monitor API Usage**
   ```bash
   curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     https://airia-beyond.vercel.app/api/admin/usage
   ```
   Review Replicate and OpenAI usage.

### Weekly Tasks

1. **Review Performance Metrics**
   - Vercel Analytics → Performance
   - Identify slow pages or API endpoints
   - Check Core Web Vitals trends

2. **Check Deployment History**
   - Vercel Dashboard → Deployments
   - Review recent deployments and their status
   - Identify any failed builds

3. **Review Security**
   - Check for dependency vulnerabilities: `npm audit`
   - Review rate limiting logs
   - Check for unusual traffic patterns

4. **Cost Analysis**
   - Review Replicate usage and costs
   - Review OpenAI token usage
   - Check Vercel bandwidth and function usage

### Monthly Tasks

1. **Update Dependencies**
   ```bash
   npm outdated
   npm update
   npm audit fix
   ```

2. **Review User Feedback**
   - Check GitHub Issues
   - Review error patterns in Sentry
   - Identify feature requests

3. **Backup Configuration**
   - Export environment variables from Vercel
   - Document any configuration changes
   - Update DEPLOYMENT.md if needed

## Monitoring

### Key Metrics

**Performance:**
- Largest Contentful Paint (LCP): Target < 2.5s
- First Input Delay (FID): Target < 100ms
- Cumulative Layout Shift (CLS): Target < 0.1

**Availability:**
- Health check: Should always return 200
- API success rate: Target > 99%
- Average response time: Target < 500ms

**Usage:**
- Daily active users
- Image generation requests
- Analysis requests
- Error rate: Target < 1%

**Costs:**
- Replicate: ~$0.0055 per image
- OpenAI: ~$0.15 per 1M tokens
- Track daily spending

### Monitoring Tools

**Vercel Dashboard:**
- Real-time analytics
- Function logs
- Deployment status
- Usage metrics

**Vercel Analytics (Built-in):**
- Visitor analytics
- Web Vitals
- Page performance
- Geographic distribution

**Sentry (Optional):**
- Error tracking
- Performance monitoring
- User impact analysis
- Release tracking

**Browser DevTools:**
- Check console for client errors
- Network tab for API latency
- Performance tab for bottlenecks

### Setting Up Alerts

**Vercel:**
- Configure deployment notifications in Settings
- Enable email alerts for deployment failures
- Set up Slack integration (optional)

**Sentry:**
- Configure alert rules for error thresholds
- Set up email notifications
- Create Slack/Discord webhooks

## Incident Response

### Step 1: Assess Impact

1. **Check Health Endpoint**
   ```bash
   curl https://airia-beyond.vercel.app/api/health
   ```

2. **Review Recent Deployments**
   - Vercel Dashboard → Deployments
   - Check if issue started after recent deployment

3. **Check Error Logs**
   - Vercel Dashboard → Functions → Logs
   - Sentry Dashboard (if configured)

4. **Determine Scope**
   - All users affected or specific subset?
   - All features broken or specific functionality?
   - Frontend issue or API issue?

### Step 2: Immediate Actions

**If Deployment Caused Issue:**
```bash
# Rollback to previous working deployment
vercel ls  # List deployments
vercel promote <previous-deployment-url>
```

**If API Service Down:**
- Check Replicate status: [status.replicate.com](https://status.replicate.com)
- Check OpenAI status: [status.openai.com](https://status.openai.com)
- Consider enabling fallback modes

**If Rate Limits Hit:**
- Review traffic patterns in Vercel Analytics
- Check for unusual spikes or abuse
- Adjust rate limits if needed (in `api/lib/rate-limit.ts`)

**If Environment Variables Missing:**
```bash
# Verify environment variables
vercel env ls

# Add missing variables
vercel env add VARIABLE_NAME
```

### Step 3: Investigation

1. **Review Function Logs**
   - Vercel Dashboard → Functions
   - Filter by time period of incident
   - Look for error patterns

2. **Check Client-Side Errors**
   - Sentry Dashboard (if configured)
   - Browser console logs
   - Network tab for failed requests

3. **Reproduce Issue**
   - Try to reproduce in production
   - Test in local environment
   - Check preview deployments

4. **Identify Root Cause**
   - Code bug?
   - Configuration issue?
   - External service outage?
   - Resource limits exceeded?

### Step 4: Resolution

**Code Fix Required:**
1. Create hotfix branch
2. Fix issue and test locally
3. Deploy to preview environment
4. Test thoroughly
5. Merge and deploy to production

**Configuration Fix:**
```bash
# Update environment variable
vercel env rm VARIABLE_NAME
vercel env add VARIABLE_NAME

# Redeploy to apply changes
vercel --prod
```

**External Service Outage:**
- Enable fallback mechanisms
- Communicate status to users
- Monitor service status pages

### Step 5: Post-Incident

1. **Document Incident**
   - What happened?
   - When did it occur?
   - What was the impact?
   - How was it resolved?
   - Time to resolution?

2. **Update Monitoring**
   - Add alerts for similar issues
   - Improve logging if needed
   - Update health checks

3. **Communicate**
   - Update GitHub Issues if related
   - Document lessons learned
   - Update runbooks

## Common Issues

### Issue: Build Failing

**Symptoms:**
- Deployment fails in Vercel
- Build logs show errors

**Solutions:**
1. Check Node.js version compatibility
2. Verify all dependencies are installed
3. Run `npm install` and `npm run build` locally
4. Check for TypeScript errors
5. Review recent code changes

**Prevention:**
- Test builds locally before pushing
- Use GitHub Actions for CI
- Lock dependency versions

### Issue: API Functions Timing Out

**Symptoms:**
- 504 Gateway Timeout errors
- Long-running requests

**Solutions:**
1. Check Replicate/OpenAI service status
2. Review function logs for bottlenecks
3. Optimize API calls (parallel requests)
4. Increase timeout if needed (max 60s on Vercel Hobby)

**Prevention:**
- Implement proper timeout handling
- Use webhooks for long operations
- Add retry logic with exponential backoff

### Issue: High API Costs

**Symptoms:**
- Unexpected Replicate/OpenAI charges
- High request volume

**Solutions:**
1. Review usage with `/api/admin/usage` endpoint
2. Check for abuse or bot traffic
3. Tighten rate limits temporarily
4. Enable fallback modes
5. Set `DISABLE_EXTERNAL_GENERATION=true` or `DISABLE_LLM_ANALYSIS=true`

**Prevention:**
- Monitor daily costs
- Set up budget alerts
- Implement stricter rate limiting
- Add CAPTCHA for high-value operations

### Issue: Poor Performance

**Symptoms:**
- Slow page loads
- High Web Vitals scores
- User complaints

**Solutions:**
1. Check Vercel Analytics for bottlenecks
2. Review bundle size with `npm run analyze`
3. Optimize images and assets
4. Enable lazy loading for heavy components
5. Review database queries (if applicable)

**Prevention:**
- Regular performance audits
- Monitor Web Vitals
- Optimize bundle size
- Use code splitting

### Issue: Error Rate Spike

**Symptoms:**
- Many errors in Sentry
- Failed API requests

**Solutions:**
1. Identify error pattern (frontend vs backend)
2. Check for recent deployments
3. Review error messages and stack traces
4. Rollback if deployment caused spike
5. Fix underlying issue

**Prevention:**
- Comprehensive error handling
- Automated testing
- Staged rollouts
- Feature flags

## Maintenance Windows

### Planned Maintenance

1. **Schedule During Low Traffic**
   - Check Vercel Analytics for traffic patterns
   - Typically late night/early morning

2. **Communicate in Advance**
   - Update GitHub README
   - Post notice in relevant channels

3. **Prepare Rollback Plan**
   - Document current configuration
   - Test rollback procedure

4. **Execute Maintenance**
   - Follow planned steps
   - Monitor closely
   - Be ready to rollback

5. **Verify Success**
   - Run health checks
   - Test key features
   - Monitor for errors

### Emergency Maintenance

If critical security fix or major bug:
1. Assess urgency and impact
2. Skip preview if truly critical
3. Deploy fix immediately
4. Monitor closely post-deployment
5. Document for post-mortem

## Contact Information

**Primary:**
- GitHub Repository: [github.com/AKITO-AKI/AIRIA-BEYOND](https://github.com/AKITO-AKI/AIRIA-BEYOND)
- GitHub Issues: For bug reports and feature requests

**External Services:**
- Vercel Support: [vercel.com/support](https://vercel.com/support)
- Replicate Support: [replicate.com/docs](https://replicate.com/docs)
- OpenAI Support: [help.openai.com](https://help.openai.com)
- Sentry Support: [sentry.io/support](https://sentry.io/support)

## Runbook Templates

### Template: Deploy to Production

```bash
# 1. Verify local build
npm run build
npm run preview

# 2. Check current production status
curl https://airia-beyond.vercel.app/api/health

# 3. Deploy
vercel --prod

# 4. Verify deployment
curl https://airia-beyond.vercel.app/api/health

# 5. Test key features
# - Visit main page
# - Create a session
# - Generate an image
# - Check gallery

# 6. Monitor for 15 minutes
# - Check Vercel Analytics
# - Check error logs
# - Check function logs
```

### Template: Rollback Deployment

```bash
# 1. List recent deployments
vercel ls

# 2. Identify last working deployment
# Look for deployment before the issue started

# 3. Promote to production
vercel promote <deployment-url>

# 4. Verify
curl https://airia-beyond.vercel.app/api/health

# 5. Test key features

# 6. Document incident
```

### Template: Update Environment Variables

```bash
# 1. List current variables
vercel env ls

# 2. Remove old value (if updating)
vercel env rm VARIABLE_NAME

# 3. Add new value
vercel env add VARIABLE_NAME
# Select environments: Production, Preview, Development

# 4. Redeploy to apply
vercel --prod

# 5. Verify
curl https://airia-beyond.vercel.app/api/health
```

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Web.dev Performance Guide](https://web.dev/performance/)
