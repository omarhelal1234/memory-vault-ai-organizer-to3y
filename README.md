# Memory Vault - AI-Powered Life Organizer

> Automatically organize your life's memories with AI-powered categorization. Capture screenshots, voice memos, videos, and notes—Memory Vault uses OpenAI's GPT-4 Vision and Whisper APIs to intelligently sort everything into smart collections like 'Movies to Watch', 'GitHub Repos', and 'AI News'.

[![React Native](https://img.shields.io/badge/React%20Native-0.73-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-50-black.svg)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green.svg)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

## ⚠️ Project Status

**Current Phase**: Specification & Architecture Complete  
**Implementation Status**: Not Started  
**Estimated Development Time**: 8-12 weeks for MVP

This repository contains complete technical specifications, architecture documentation, and design system for the Memory Vault application. **No implementation code exists yet**—this is a comprehensive blueprint ready for development.

## 🎯 What Memory Vault Does

- **Capture Anywhere**: iOS share extension + in-app capture for screenshots, voice memos, photos, videos, and links
- **AI Categorization**: Automatic tagging using GPT-4 Vision (images) and Whisper (audio transcription)
- **Smart Collections**: Auto-generated categories like "Movies to Watch", "GitHub Repos", "Recipes", "Travel Ideas"
- **Instant Search**: Full-text search across all captured content, transcripts, and extracted text
- **Cross-Platform**: Native iOS app + responsive web dashboard
- **Offline-First**: Queue captures offline, sync when connected

## 🏗️ Architecture Overview

```
React Native App (iOS + Web)
  ↓
Supabase Backend
  ├── PostgreSQL Database (memories, categories, tags)
  ├── Storage (media files with CDN)
  ├── Auth (user sessions)
  └── Edge Functions (AI processing pipeline)
      ↓
OpenAI APIs
  ├── GPT-4 Vision (screenshot/photo analysis)
  └── Whisper (voice memo transcription)
```

## 📋 Prerequisites

Before starting development, you'll need:

- **Node.js** 18+ and npm/yarn
- **Expo CLI**: `npm install -g expo-cli`
- **iOS Development**: Xcode 15+ (macOS required for iOS builds)
- **Supabase Account**: [Create free account](https://supabase.com/)
- **OpenAI API Key**: [Get API key](https://platform.openai.com/api-keys)
- **Apple Developer Account**: Required for iOS share extension (native build)

## 🚀 Setup Instructions

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/memory-vault-ai-organizer.git
cd memory-vault-ai-organizer
npm install
```

### 2. Configure Environment Variables

Create `.env` file in project root:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-key-here

# Optional: Environment
NODE_ENV=development
```

### 3. Set Up Supabase Backend

#### Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click "New Project"
3. Copy your project URL and anon key to `.env`

#### Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

#### Deploy Edge Functions

```bash
# Deploy AI processing function
supabase functions deploy analyze-memory

# Set environment secrets
supabase secrets set OPENAI_API_KEY=sk-your-key-here
```

#### Configure Storage Buckets

```bash
# Create storage bucket for media files
supabase storage create memories --public

# Set CORS policy (see docs/setup-guide.md for details)
```

### 4. Start Development Server

```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run web version
npm run web
```

### 5. Build iOS Share Extension (Native Build Required)

**Note**: Share extension requires ejecting from Expo Go to bare workflow.

```bash
# Eject to bare React Native
expro eject

# Open iOS project in Xcode
open ios/MemoryVault.xcworkspace

# Follow docs/ios-share-extension-setup.md for detailed steps
```

## 📱 Development Workflow

### iOS Development

```bash
# Run on physical device (requires Apple Developer account)
npm run ios -- --device "Your iPhone"

# Run on simulator
npm run ios

# Build for TestFlight
eas build --platform ios --profile preview
```

### Web Development

```bash
# Start web dev server
npm run web

# Build for production
npm run build:web

# Deploy to Vercel/Netlify
npm run deploy:web
```

### Testing

```bash
# Run unit tests
npm test

# Run integration tests (requires test Supabase project)
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## 📚 Documentation

- **[Setup Guide](docs/setup-guide.md)**: Detailed environment setup
- **[Architecture](docs/architecture.md)**: System design and data flows
- **[API Documentation](docs/api-documentation.md)**: Supabase and OpenAI integration
- **[User Guide](docs/user-guide.md)**: Feature documentation
- **[iOS Share Extension Setup](docs/ios-share-extension-setup.md)**: Native iOS configuration
- **[Deployment Guide](docs/deployment-guide.md)**: Production deployment steps

## 🎨 Design System

Complete design specifications available in:

- `docs/design_system.md` - Colors, typography, spacing
- `src/styles/design-system.css` - CSS variables and utilities
- `docs/component-library.md` - UI component specifications

## 🔑 Key Features to Implement

### Phase 1: MVP (Weeks 1-6)
- [ ] React Native app structure with Expo
- [ ] Supabase authentication
- [ ] Basic iOS share extension (text only)
- [ ] OpenAI GPT-4 text categorization
- [ ] Web interface for viewing memories
- [ ] TestFlight deployment

### Phase 2: Enhanced Features (Weeks 7-12)
- [ ] GPT-4 Vision for image analysis
- [ ] Whisper API for audio transcription
- [ ] Custom categorization rules
- [ ] Storage quota management
- [ ] Comprehensive error handling
- [ ] UI/UX refinements

### Phase 3: Production Hardening (Weeks 13-16)
- [ ] Integration testing suite
- [ ] Performance optimization
- [ ] Security audit
- [ ] Edge case handling
- [ ] Production deployment
- [ ] Monitoring and analytics

## 🧪 Testing Strategy

See `docs/testing-strategy.md` for comprehensive testing approach:

- Unit tests for business logic
- Integration tests for API interactions
- E2E tests for critical user flows
- Manual testing checklist for iOS share extension
- Performance benchmarks for AI processing

## 🚢 Deployment

### iOS App Store

```bash
# Build production iOS app
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

### Web Deployment (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

See `docs/deployment-guide.md` for detailed instructions.

## 💰 Cost Estimates

### OpenAI API Costs (Monthly)
- **GPT-4 Vision**: ~$0.01-0.03 per image analysis
- **Whisper**: ~$0.006 per minute of audio
- **Estimated for 100 users**: $50-150/month

### Supabase Costs
- **Free Tier**: 500MB database, 1GB storage, 2GB bandwidth
- **Pro Tier ($25/month)**: 8GB database, 100GB storage, 250GB bandwidth

### Infrastructure Total
- **MVP**: $0-50/month (free tiers)
- **Production (1000 users)**: $200-500/month

## 🤝 Contributing

This project is currently in specification phase. Once implementation begins:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

See `CONTRIBUTING.md` for detailed guidelines.

## 📄 License

MIT License - see `LICENSE` file for details.

## 🙏 Acknowledgments

- **OpenAI** for GPT-4 Vision and Whisper APIs
- **Supabase** for backend infrastructure
- **Expo** for React Native development platform
- **React Native Community** for cross-platform mobile development

## 📞 Support

- **Documentation**: See `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/yourusername/memory-vault-ai-organizer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/memory-vault-ai-organizer/discussions)

---

**Built with ❤️ using React Native, Supabase, and OpenAI**


---

_Built by [The Agency](https://github.com/msitarzewski/agency-agents) — orchestrator run on 2026-06-01T22:01:45.559Z._
