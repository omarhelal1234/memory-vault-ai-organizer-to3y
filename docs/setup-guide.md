# Memory Vault Setup Guide

Complete step-by-step instructions for setting up the Memory Vault development environment.

## Prerequisites

### Required Software

1. **Node.js 18+**
   ```bash
   node --version  # Should be 18.0.0 or higher
   ```

2. **Expo CLI**
   ```bash
   npm install -g expo-cli
   expo --version
   ```

3. **Xcode 15+** (macOS only, for iOS development)
   - Download from Mac App Store
   - Install Command Line Tools: `xcode-select --install`

4. **Git**
   ```bash
   git --version
   ```

### Required Accounts

1. **Supabase Account**: [Sign up](https://supabase.com/)
2. **OpenAI Account**: [Sign up](https://platform.openai.com/)
3. **Apple Developer Account** (for iOS share extension): [Enroll](https://developer.apple.com/programs/)

## Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/memory-vault-ai-organizer.git
cd memory-vault-ai-organizer
npm install
```

## Step 2: Supabase Setup

### Create Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click "New Project"
3. Fill in:
   - **Name**: memory-vault-production
   - **Database Password**: (generate strong password)
   - **Region**: Choose closest to your users
4. Click "Create new project"

### Get API Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...`
3. Paste into `.env` file

### Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

Verify migrations:
```bash
supabase db diff
```

### Configure Storage

1. Go to **Storage** in Supabase Dashboard
2. Click "Create bucket"
3. Name: `memories`
4. Set to **Public**
5. Click "Create bucket"

#### Set CORS Policy

```sql
-- Run in SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('memories', 'memories', true);

CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'memories');
```

### Deploy Edge Functions

```bash
# Deploy analyze-memory function
supabase functions deploy analyze-memory

# Set OpenAI API key as secret
supabase secrets set OPENAI_API_KEY=sk-your-key-here

# Verify deployment
supabase functions list
```

## Step 3: OpenAI Setup

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Name: `memory-vault-production`
4. Copy key (starts with `sk-`)
5. Add to `.env`:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```

### Set Usage Limits (Recommended)

1. Go to **Settings** → **Billing** → **Usage limits**
2. Set monthly limit (e.g., $50)
3. Enable email notifications at 75% and 90%

## Step 4: Environment Configuration

### Create .env File

```bash
cp .env.example .env
```

### Edit .env

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Environment
NODE_ENV=development
```

## Step 5: Start Development Server

```bash
# Start Expo dev server
npm start

# In separate terminals:
npm run ios      # iOS simulator
npm run web      # Web browser
```

### Verify Setup

1. App should load without errors
2. Check Expo DevTools at `http://localhost:19002`
3. Verify Supabase connection in app logs

## Step 6: iOS Share Extension Setup

**Note**: Requires ejecting from Expo managed workflow.

### Eject to Bare Workflow

```bash
expo eject
```

### Configure Xcode Project

1. Open `ios/MemoryVault.xcworkspace` in Xcode
2. Select project in navigator
3. Go to **Signing & Capabilities**
4. Select your Team
5. Enable **App Groups**:
   - Add: `group.com.yourcompany.memoryvault`

### Add Share Extension Target

1. **File** → **New** → **Target**
2. Select **Share Extension**
3. Name: `MemoryVaultShare`
4. Language: Swift
5. Click **Finish**

### Configure Share Extension

See detailed instructions in `docs/ios-share-extension-setup.md`

## Step 7: Testing

### Run Tests

```bash
# Unit tests
npm test

# Integration tests (requires test Supabase project)
npm run test:integration

# E2E tests
npm run test:e2e
```

### Manual Testing Checklist

- [ ] User can sign up/login
- [ ] User can upload screenshot
- [ ] AI analysis completes successfully
- [ ] Category is auto-assigned
- [ ] Memory appears in category view
- [ ] Search returns correct results
- [ ] iOS share extension works (if configured)

## Troubleshooting

### Expo Won't Start

```bash
# Clear cache
expo start -c

# Reset Metro bundler
rm -rf node_modules
npm install
```

### Supabase Connection Fails

1. Verify `.env` credentials are correct
2. Check Supabase project is active (not paused)
3. Verify RLS policies are enabled
4. Check network connectivity

### OpenAI API Errors

1. Verify API key is valid
2. Check usage limits not exceeded
3. Ensure billing is set up
4. Review error messages in Edge Function logs:
   ```bash
   supabase functions logs analyze-memory
   ```

### iOS Build Fails

1. Clean build folder: **Product** → **Clean Build Folder**
2. Update CocoaPods:
   ```bash
   cd ios
   pod install
   cd ..
   ```
3. Verify provisioning profiles are valid

## Next Steps

- Read [Architecture Documentation](architecture.md)
- Review [API Documentation](api-documentation.md)
- Check [User Guide](user-guide.md)
- See [Deployment Guide](deployment-guide.md) for production setup

## Support

If you encounter issues:

1. Check [GitHub Issues](https://github.com/yourusername/memory-vault-ai-organizer/issues)
2. Review [Troubleshooting Guide](troubleshooting.md)
3. Ask in [GitHub Discussions](https://github.com/yourusername/memory-vault-ai-organizer/discussions)
