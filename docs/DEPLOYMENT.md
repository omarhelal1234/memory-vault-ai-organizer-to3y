# Deployment Guide - Memory Vault

## Prerequisites

### Required Accounts
- **Supabase**: Create project at https://app.supabase.com
- **OpenAI**: Get API key at https://platform.openai.com/api-keys
- **Apple Developer**: Required for iOS App Store submission ($99/year)
- **Expo**: Create account at https://expo.dev

### Required Tools
- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- Supabase CLI: `npm install -g supabase`
- EAS CLI: `npm install -g eas-cli`

## Step 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in:
   - Name: `memory-vault-production`
   - Database Password: (generate strong password)
   - Region: (choose closest to your users)
4. Wait for project to provision (~2 minutes)

### 1.2 Run Database Migrations

```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Verify tables created
supabase db diff
```

### 1.3 Configure Storage

1. Go to Storage in Supabase dashboard
2. Create bucket: `memories`
3. Set policies:
   - Allow authenticated users to upload
   - Allow users to read their own files

```sql
-- Storage policies (run in SQL Editor)
CREATE POLICY "Users can upload own memories"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'memories' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read own memories"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'memories' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 1.4 Deploy Edge Functions

```bash
# Set OpenAI API key as secret
supabase secrets set OPENAI_API_KEY=sk-your-key-here

# Deploy function
supabase functions deploy analyze-memory

# Verify deployment
supabase functions list
```

### 1.5 Configure Cron Job

```sql
-- Run in SQL Editor to process memories every 30 seconds
SELECT cron.schedule(
  'process-pending-memories',
  '*/30 * * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/analyze-memory',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
  );
  $$
);
```

## Step 2: Environment Configuration

### 2.1 Get Supabase Credentials

1. Go to Project Settings → API
2. Copy:
   - Project URL: `https://your-project-ref.supabase.co`
   - Anon/Public Key: `eyJhbGc...`

### 2.2 Create Environment Files

```bash
# Production environment
cp .env.example .env.production

# Edit .env.production
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=sk-your-openai-key-here
NODE_ENV=production
```

## Step 3: iOS App Deployment

### 3.1 Configure EAS Build

```bash
# Login to Expo
eas login

# Configure project
eas build:configure
```

Edit `eas.json`:

```json
{
  "build": {
    "production": {
      "ios": {
        "bundleIdentifier": "com.yourcompany.memoryvault",
        "buildConfiguration": "Release"
      }
    },
    "preview": {
      "ios": {
        "simulator": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-id"
      }
    }
  }
}
```

### 3.2 Build for TestFlight

```bash
# Build iOS app
eas build --platform ios --profile production

# Wait for build to complete (~15-20 minutes)
# Download IPA or submit directly to TestFlight
eas submit --platform ios --latest
```

### 3.3 App Store Submission

1. Go to App Store Connect
2. Create new app:
   - Name: Memory Vault
   - Bundle ID: com.yourcompany.memoryvault
   - SKU: memory-vault-001
3. Upload screenshots (required sizes: 6.5", 5.5")
4. Fill in app description and metadata
5. Submit for review

## Step 4: Web App Deployment

### 4.1 Build Web App

```bash
# Build for production
npm run build:web

# Output will be in web-build/
```

### 4.2 Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# Project Settings → Environment Variables
```

### 4.3 Deploy to Netlify (Alternative)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=web-build

# Set environment variables in Netlify dashboard
```

## Step 5: Monitoring & Analytics

### 5.1 Supabase Monitoring

1. Go to Supabase Dashboard → Database → Logs
2. Monitor:
   - Query performance
   - Error rates
   - Storage usage

### 5.2 OpenAI Usage Tracking

1. Go to https://platform.openai.com/usage
2. Monitor:
   - API calls per day
   - Token usage
   - Costs

### 5.3 Set Up Alerts

```sql
-- Create alert for failed processing
CREATE OR REPLACE FUNCTION notify_failed_processing()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.processing_status = 'failed' THEN
    PERFORM net.http_post(
      url := 'https://your-webhook-url.com/alert',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'memory_id', NEW.id,
        'user_id', NEW.user_id,
        'type', NEW.type
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alert_on_failed_processing
AFTER UPDATE ON memories
FOR EACH ROW
EXECUTE FUNCTION notify_failed_processing();
```

## Step 6: Post-Deployment Checklist

- [ ] Database migrations applied successfully
- [ ] Storage bucket configured with correct policies
- [ ] Edge Functions deployed and responding
- [ ] Cron job running (check logs)
- [ ] Environment variables set correctly
- [ ] iOS app submitted to TestFlight
- [ ] Web app deployed and accessible
- [ ] OpenAI API key working (test with sample upload)
- [ ] Monitoring dashboards configured
- [ ] Backup strategy in place
- [ ] Error alerting configured

## Rollback Procedures

### Database Rollback

```bash
# Revert last migration
supabase db reset

# Or restore from backup
supabase db dump > backup.sql
supabase db restore backup.sql
```

### App Rollback

```bash
# iOS: Revert to previous build in App Store Connect
# Web: Revert deployment in Vercel/Netlify dashboard
```

## Troubleshooting

### Edge Function Not Processing

```bash
# Check function logs
supabase functions logs analyze-memory

# Test function manually
curl -X POST https://your-project-ref.supabase.co/functions/v1/analyze-memory \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### OpenAI API Errors

- Check API key is valid
- Verify billing is active
- Check rate limits: https://platform.openai.com/account/limits

### Storage Upload Failures

- Verify storage policies are correct
- Check file size limits (default 50MB)
- Ensure bucket exists and is public

## Cost Optimization

### Reduce OpenAI Costs

1. Implement caching for similar images
2. Batch process during off-peak hours
3. Use GPT-3.5 for simple categorization
4. Set max_tokens limits

### Reduce Supabase Costs

1. Enable database connection pooling
2. Optimize queries with indexes
3. Archive old memories to cold storage
4. Use CDN for static assets

## Security Hardening

### Enable Additional RLS Policies

```sql
-- Prevent users from viewing other users' data
CREATE POLICY "Strict user isolation" ON memories
FOR ALL USING (auth.uid() = user_id);

-- Rate limit uploads
CREATE POLICY "Upload rate limit" ON memories
FOR INSERT WITH CHECK (
  (SELECT COUNT(*) FROM memories 
   WHERE user_id = auth.uid() 
   AND created_at > NOW() - INTERVAL '1 hour') < 100
);
```

### API Key Rotation

1. Generate new OpenAI API key
2. Update Supabase secret: `supabase secrets set OPENAI_API_KEY=new-key`
3. Redeploy Edge Functions
4. Revoke old key after 24 hours

---

**Deployment Complete!** 🎉

Your Memory Vault instance is now live. Monitor the dashboards and respond to any alerts promptly.