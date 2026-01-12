# API Security & Key Management

## Overview

This document outlines security best practices for managing API keys and external service integrations in the WOT (Wealth on Track) application.

## Environment Variables

### Required Variables
- `DATABASE_URL`: PostgreSQL connection string (Neon, Supabase, etc.)
- `AUTH_SECRET`: NextAuth secret for JWT signing (generate with `openssl rand -base64 32`)

### Optional but Recommended
- `ALPHA_VANTAGE_API_KEY`: For US stock market data fallback
- `FINNHUB_API_KEY`: For global stock market data fallback
- `CRON_SECRET`: For authenticating automated cron jobs

### Setup
1. Copy `.env.example` to `.env.local` for development
2. Copy `.env.example` to `.env.production` for production (Vercel)
3. Never commit `.env` files to version control

## API Key Rotation

### When to Rotate Keys

Rotate API keys in these scenarios:
- **Scheduled**: Every 90 days as a best practice
- **Breach**: Immediately if keys are exposed in logs, repos, or public
- **Suspicious Activity**: If you notice unusual API usage patterns
- **Team Changes**: When developers leave the project

### How to Rotate Keys

#### Alpha Vantage & Finnhub

1. **Generate New Key**
   - Alpha Vantage: https://www.alphavantage.co/support/#api-key
   - Finnhub: https://finnhub.io/dashboard

2. **Update Environment Variables**
   ```bash
   # Local
   # Update .env.local with new key

   # Vercel Production
   vercel env add ALPHA_VANTAGE_API_KEY
   # or update via Vercel Dashboard → Settings → Environment Variables
   ```

3. **Redeploy** (if needed)
   ```bash
   vercel --prod
   ```

4. **Verify**
   - Check `/admin/health` endpoint
   - Monitor `/admin/requests` for API errors

5. **Revoke Old Key**
   - Wait 24-48 hours to ensure no cached requests
   - Revoke old key from provider dashboard

#### Database URL

**⚠️ CRITICAL**: Database credential rotation requires coordination

1. **Create New Database User** (or rotate password)
2. **Update `DATABASE_URL` in Vercel**
3. **Deploy Changes**
4. **Verify Connection** via health check
5. **Revoke Old Credentials** after 48 hours

#### AUTH_SECRET

**⚠️ WARNING**: Rotating AUTH_SECRET invalidates all user sessions

1. **Generate New Secret**
   ```bash
   openssl rand -base64 32
   ```

2. **Update in Vercel Environment Variables**

3. **Redeploy**

4. **Notify Users** that they'll need to log in again

## Rate Limit Management

### Current Limits

| Provider | Free Tier Limit | Current Strategy |
|----------|----------------|------------------|
| Yahoo Finance | No official limit | Primary source, respectful usage |
| Alpha Vantage | 25 requests/day | Fallback only |
| Finnhub | 60 requests/minute | Fallback only |

### Rate Limit Protection

The application implements:
- **Database Caching**: 1-hour cache for prices (reduces API calls by 95%)
- **Batch Processing**: Groups requests to minimize API calls
- **Fallback Chain**: Yahoo → Alpha Vantage → Finnhub → Cached data
- **Telemetry**: Tracks API usage in `/admin/requests`

### Monitoring

Check API health:
```bash
curl https://mpt1.vercel.app/admin/health
```

View API usage:
- Dashboard: https://mpt1.vercel.app/admin
- Requests log: https://mpt1.vercel.app/admin/requests

## Security Best Practices

### 1. Never Expose Keys in Client-Side Code
✅ **Correct**: Use Server Actions or API routes
```typescript
// src/app/actions/marketData.ts
"use server";
export async function fetchPrice() {
  // API key accessed server-side only
}
```

❌ **Incorrect**: Accessing env vars in client components
```typescript
// Don't do this!
const key = process.env.ALPHA_VANTAGE_API_KEY;
```

### 2. Use Environment-Specific Configs

- Development: `.env.local` (gitignored)
- Production: Vercel Environment Variables
- Never use production keys in development

### 3. Implement Request Authentication

Cron jobs use bearer token authentication:
```typescript
// src/app/api/cron/update-prices/route.ts
const authHeader = request.headers.get('authorization');
if (!validateCronRequest(authHeader)) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 4. Monitor API Usage

Use Admin Panel to track:
- Daily request counts
- Error rates
- Provider performance
- Suspicious patterns

### 5. Implement Graceful Degradation

Application works even if external APIs fail:
- Primary: Yahoo Finance (no key required)
- Fallback 1: Cached prices (1-hour stale acceptable)
- Fallback 2: Alpha Vantage
- Fallback 3: Finnhub
- Final: Display last known price with warning

## Incident Response

### If Keys are Exposed

1. **Immediately Rotate Keys** (follow rotation guide above)
2. **Check Provider Dashboard** for unauthorized usage
3. **Review Application Logs** for suspicious activity
4. **Update Git History** if committed (use BFG Repo-Cleaner)
5. **Document Incident** and lessons learned

### If Database is Compromised

1. **Rotate Database Credentials** immediately
2. **Check for Data Exfiltration** in database logs
3. **Review User Activity** for anomalies
4. **Notify Users** if personal data is affected (GDPR compliance)
5. **Enable Database Audit Logging**

## Compliance

### GDPR (EU)
- User data is encrypted at rest (PostgreSQL with TLS)
- Users can export their portfolio data
- Users can delete their account and all data

### API Provider Terms
- **Yahoo Finance**: No commercial use without license
- **Alpha Vantage**: Free tier is non-commercial use
- **Finnhub**: Attribution required for free tier

## Useful Commands

```bash
# Generate new AUTH_SECRET
openssl rand -base64 32

# Test environment variables locally
npm run build

# Check Vercel environment variables
vercel env ls

# Add new environment variable to Vercel
vercel env add VARIABLE_NAME

# View production logs
vercel logs

# Redeploy with new environment variables
vercel --prod
```

## Contact & Support

For security issues, contact the maintainer immediately:
- Create a private GitHub security advisory
- Do NOT open public issues for security vulnerabilities

---

**Last Updated**: January 2026
**Review Schedule**: Quarterly
