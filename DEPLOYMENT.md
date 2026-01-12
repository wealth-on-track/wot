# 🚀 Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Fill in all required environment variables
- [ ] Ensure `DATABASE_URL` points to production database
- [ ] Generate secure `AUTH_SECRET`: `openssl rand -base64 32`
- [ ] Set `NEXT_PUBLIC_APP_URL` to your production domain

### 2. Database
- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Verify database connection
- [ ] Set up automated backups
- [ ] Configure connection pooling (recommended: PgBouncer)

### 3. Build & Test
```bash
# Install dependencies
npm ci

# Run production build
npm run build

# Test production build locally
npm start
```

### 4. Security
- [x] Security headers configured (HSTS, CSP, etc.)
- [x] Error boundary implemented
- [ ] Rate limiting configured (optional)
- [ ] CORS policies reviewed
- [ ] API keys secured in environment variables

### 5. Performance
- [ ] Enable caching strategy
- [ ] Configure CDN (Cloudflare, Vercel Edge, etc.)
- [ ] Optimize images (already configured with Next.js Image)
- [ ] Enable compression (gzip/brotli)

### 6. Monitoring
- [ ] Set up error tracking (Sentry recommended)
- [ ] Configure analytics (Google Analytics, Plausible, etc.)
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Configure logging (Datadog, LogRocket, etc.)

## Deployment Options

### Option 1: Vercel (Recommended - Easiest)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Vercel Configuration:**
- Auto-deploys from Git
- Environment variables in dashboard
- Edge functions for API routes
- Built-in analytics

### Option 2: Docker + VPS
```bash
# Build Docker image
docker build -t portfolio-tracker .

# Run container
docker run -p 3000:3000 --env-file .env.production portfolio-tracker
```

**Create `Dockerfile`:**
```dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

### Option 3: Traditional VPS (Ubuntu/Debian)
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone and setup
git clone <your-repo>
cd portfolio-tracker
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

# Start with PM2
pm2 start npm --name "portfolio-tracker" -- start
pm2 save
pm2 startup
```

## Post-Deployment

### 1. Verify Deployment
- [ ] Test login/registration
- [ ] Test portfolio creation
- [ ] Test asset search and addition
- [ ] Test currency conversion
- [ ] Test Top Performers widget
- [ ] Test all major features

### 2. Performance Check
- [ ] Run Lighthouse audit (aim for 90+ scores)
- [ ] Check Core Web Vitals
- [ ] Test on mobile devices
- [ ] Verify API response times

### 3. Security Audit
- [ ] Run security headers check: https://securityheaders.com
- [ ] Verify SSL/TLS configuration
- [ ] Test authentication flows
- [ ] Review CORS policies

## Maintenance

### Database Backups
```bash
# Automated daily backup (cron)
0 2 * * * pg_dump $DATABASE_URL > /backups/portfolio_$(date +\%Y\%m\%d).sql
```

### Monitoring
- Set up alerts for:
  - Server downtime
  - High error rates
  - Slow response times
  - Database connection issues

### Updates
```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm ci

# Run migrations
npx prisma migrate deploy

# Rebuild
npm run build

# Restart (PM2)
pm2 restart portfolio-tracker

# Or (Docker)
docker-compose up -d --build
```

## Troubleshooting

### Build Fails
- Check Node.js version (requires 18+)
- Clear `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm ci`

### Database Connection Issues
- Verify `DATABASE_URL` format
- Check firewall rules
- Ensure database is accessible from deployment server
- Use connection pooling for production

### Performance Issues
- Enable Redis caching
- Configure CDN
- Optimize database queries
- Use database indexes

## Support
For issues, check:
- GitHub Issues
- Next.js Documentation: https://nextjs.org/docs
- Prisma Documentation: https://www.prisma.io/docs
