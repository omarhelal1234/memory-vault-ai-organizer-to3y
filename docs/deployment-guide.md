# Memory Vault Deployment Guide

Production deployment instructions for iOS App Store and web hosting.

## Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Environment variables configured for production
- [ ] Supabase production project created
- [ ] OpenAI API usage limits set
- [ ] App icons and splash screens created
- [ ] Privacy policy and terms of service written
- [ ] App Store listing prepared (screenshots, description)

## iOS App Store Deployment

### 1. Configure App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Memory Vault
   - **Primary Language**: English
   - **Bundle ID**: com.yourcompany.memoryvault
   - **SKU**: MEMORYVAULT001
4. Click **Create**

### 2. Prepare App Metadata

#### App Information
- **Category**: Productivity
- **Subtitle**: AI-Powered Life Organizer
- **Keywords**: memory, AI, organize, screenshots, voice memos

#### Privacy Policy
Host at: `https://yourwebsite.com/privacy`

#### App Description
```
Memory Vault automatically organizes your life's memories using AI.

• Capture screenshots, voice memos, photos, and videos
• AI automatically categorizes into smart collections
• Search across all your memories instantly
• Works offline, syncs when connected

Powered by OpenAI's GPT-4 Vision and Whisper APIs.
```

### 3. Create App Screenshots

Required sizes:
- **6.7" (iPhone 14 Pro Max)**: 1290 x 2796 px
- **6.5" (iPhone 11 Pro Max)**: 1242 x 2688 px
- **5.5" (iPhone 8 Plus)**: 1242 x 2208 px

Create 3-5 screenshots showing:
1. Home feed with categorized memories
2. AI analysis in progress
3. Category collections view
4. Search functionality
5. Memory detail view

### 4. Build Production App

#### Using EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios --profile production
```

#### Manual Build (Xcode)

```bash
# Open Xcode project
open ios/MemoryVault.xcworkspace

# In Xcode:
# 1. Select "Any iOS Device" as target
# 2. Product → Archive
# 3. Wait for archive to complete
# 4. Click "Distribute App"
# 5. Select "App Store Connect"
# 6. Upload
```

### 5. Submit for Review

1. Go to App Store Connect
2. Select your app
3. Click **+ Version or Platform**
4. Enter version number (e.g., 1.0.0)
5. Upload build from EAS or Xcode
6. Fill in "What's New in This Version"
7. Add screenshots
8. Set pricing (Free or Paid)
9. Click **Submit for Review**

### 6. TestFlight Beta Testing (Optional)

```bash
# Build for TestFlight
eas build --platform ios --profile preview

# Submit to TestFlight
eas submit --platform ios
```

Invite beta testers:
1. Go to App Store Connect → TestFlight
2. Click **App Store Connect Users** or **External Testers**
3. Add testers by email
4. They'll receive TestFlight invitation

## Web Deployment

### Option 1: Vercel (Recommended)

#### Setup

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

#### Configure Environment Variables

1. Go to Vercel Dashboard
2. Select project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`

#### Custom Domain

1. Go to **Settings** → **Domains**
2. Add domain: `app.memoryvault.com`
3. Configure DNS:
   ```
   CNAME app.memoryvault.com cname.vercel-dns.com
   ```

### Option 2: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Build
npm run build:web

# Deploy
netlify deploy --prod --dir=web-build
```

### Option 3: Self-Hosted (Nginx)

```bash
# Build static files
npm run build:web

# Copy to server
scp -r web-build/* user@server:/var/www/memoryvault
```

**Nginx Configuration**:

```nginx
server {
    listen 80;
    server_name app.memoryvault.com;
    root /var/www/memoryvault;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Enable gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

## Supabase Production Setup

### 1. Create Production Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Create new project: `memory-vault-production`
3. Choose **Pro Plan** for production features

### 2. Run Migrations

```bash
# Link to production project
supabase link --project-ref production-project-ref

# Push migrations
supabase db push
```

### 3. Configure Backups

1. Go to **Settings** → **Database**
2. Enable **Point-in-Time Recovery** (Pro plan)
3. Set backup retention: 7 days

### 4. Set Up Monitoring

1. Go to **Settings** → **API**
2. Enable **API Analytics**
3. Set up alerts for:
   - High error rates
   - Slow queries
   - Storage limits

## Environment Variables

### Production .env

```env
# Supabase Production
SUPABASE_URL=https://production-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...

# OpenAI Production
OPENAI_API_KEY=sk-prod-...

# Environment
NODE_ENV=production

# Analytics (Optional)
SENTRY_DSN=https://...
ANALYTICS_ID=G-...
```

## Post-Deployment

### 1. Verify Deployment

- [ ] iOS app installs from TestFlight/App Store
- [ ] Web app loads at production URL
- [ ] User can sign up and login
- [ ] AI analysis works correctly
- [ ] Search returns results
- [ ] No console errors

### 2. Set Up Monitoring

#### Sentry (Error Tracking)

```bash
npm install @sentry/react-native
```

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
});
```

#### Google Analytics

```bash
npm install @react-native-firebase/analytics
```

### 3. Monitor Costs

#### OpenAI API
- Set usage limits in OpenAI dashboard
- Monitor daily spend
- Set up billing alerts

#### Supabase
- Monitor database size
- Check storage usage
- Review bandwidth consumption

### 4. Performance Monitoring

- **Response Times**: < 2 seconds for AI analysis
- **Uptime**: > 99.9%
- **Error Rate**: < 1%

## Rollback Procedure

If issues occur:

### iOS
1. Go to App Store Connect
2. Remove current version from sale
3. Submit previous version for expedited review

### Web
```bash
# Vercel
vercel rollback

# Netlify
netlify rollback
```

### Database
```bash
# Restore from backup
supabase db restore --backup-id backup-id-here
```

## Maintenance

### Weekly
- Review error logs
- Check API usage and costs
- Monitor user feedback

### Monthly
- Update dependencies
- Review security advisories
- Analyze user metrics

### Quarterly
- Performance optimization
- Feature updates
- Security audit

## Support

For deployment issues:
- [Expo EAS Documentation](https://docs.expo.dev/eas/)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
