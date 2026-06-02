# Memory Vault - AI-Powered Life Organizer

> **✅ PROJECT STATUS: FUNCTIONAL MVP**
> A working web app is wired to a live Supabase backend: email/password auth, capture (notes / links / reels / images → Storage), AI filing into a dynamic `category › subcategory` taxonomy, a drill-down browser (Home dashboard → subcategories → item list → detail), priority/done triage, an auto-organize merge pass, search, and rich per-kind detail cards.
>
> **Run it:** `npm install` → `npm run web` → open http://localhost:8081. Set `OPENAI_API_KEY` as a Supabase Edge Function secret for AI categorization to run, and (for instant testing) disable "Confirm email" in Supabase → Authentication → Providers → Email.

## Overview

Memory Vault is a cross-platform AI memory assistant for the things you screenshot or send yourself "to check later" and then lose. It auto-files screenshots, voice memos, notes, and pasted TikTok/Instagram/YouTube links into a **fully dynamic two-level taxonomy** — the AI reuses your existing categories/subcategories when one fits and only invents a new one when nothing does (a one-tap auto-organize pass merges near-duplicates). Each item gets typed structured data, a triage priority, and a done checkbox so the pile becomes an actually-doable, well-sorted library. Built on OpenAI Vision + Whisper, invoked only from Edge Functions.

**Tech Stack:**
- **Frontend**: React Native (iOS + Web) with Expo
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions)
- **AI**: OpenAI GPT-4 Vision API, OpenAI Whisper API
- **Language**: TypeScript
- **Styling**: Tailwind CSS (via NativeWind)

## Project Status

**Current Phase**: Architecture & Specification Complete  
**Next Phase**: Implementation (Estimated 8-12 weeks)

### What Exists
- ✅ Complete product requirements (see `docs/product_requirements.md`)
- ✅ System architecture design (see `docs/architecture/`)
- ✅ Database schema and migrations (see `supabase/migrations/`)
- ✅ UI/UX design system (see `docs/design_system.md`)
- ✅ API integration specifications (see `docs/SPEC.md`)

### What's Required
- ❌ React Native app implementation
- ❌ iOS share extension (native code)
- ❌ Supabase Edge Functions deployment
- ❌ OpenAI API integration
- ❌ UI component library
- ❌ State management (Zustand)
- ❌ Offline sync logic
- ❌ End-to-end testing

## Quick Start (Post-Implementation)

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account
- OpenAI API key
- iOS development environment (Xcode for iOS builds)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/memory-vault-ai-organizer.git
cd memory-vault-ai-organizer

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - OPENAI_API_KEY

# Run type checking
npm run type-check

# Start development server
npm run web          # Web app
npm run ios          # iOS simulator (macOS only)
npm run android      # Android emulator
```

### Database Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy analyze-memory
```

## Project Structure

```
memory-vault-ai-organizer/
├── src/
│   ├── screens/              # React Native screens
│   │   ├── HomeScreen.tsx        # Category dashboard
│   │   ├── SubcategoryScreen.tsx # Subcategories within a category
│   │   ├── ItemListScreen.tsx    # Items (chips + done toggle; also "inbox" mode)
│   │   ├── CaptureScreen.tsx
│   │   ├── MemoryDetailScreen.tsx
│   │   └── SearchScreen.tsx
│   ├── components/           # Reusable UI components
│   ├── lib/                  # Utilities and clients
│   │   └── supabase.ts       # Supabase client config
│   ├── store/                # Zustand state management
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts
│   └── App.tsx               # Root component
├── supabase/
│   ├── migrations/           # Database schema migrations
│   │   └── 20240101000000_initial_schema.sql
│   └── functions/            # Edge Functions (Deno)
│       └── analyze-memory/
│           └── index.ts
├── docs/
│   ├── product_requirements.md
│   ├── design_system.md
│   ├── architecture/
│   │   ├── adr/              # Architecture Decision Records
│   │   └── schema.sql
│   ├── SPEC.md               # AI processing specification
│   └── HANDOFF.md            # Implementation handoff notes
├── .env.example              # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Key Features (Planned)

### 1. Intelligent Capture
- **iOS Share Extension**: Capture screenshots, photos, links from any app
- **Voice Memos**: Record and auto-transcribe ideas
- **Offline Support**: Queue uploads when offline, sync when connected

### 2. AI-Powered Organization
- **Dynamic taxonomy**: the AI files each capture under `category › subcategory`, reusing existing names and only inventing new ones when nothing fits
- **Auto-organize**: a one-tap LLM reconcile pass merges near-duplicate categories/subcategories
- **Reel ingestion**: pasted TikTok/Instagram/YouTube links are enriched from oEmbed/Open-Graph metadata (caption, author, thumbnail) before classification
- **Triage**: per-item priority (1–3) and a done checkbox turn the vault into a doable to-do list

### 3. Drill-down navigation
- **Home**: dashboard of categories with item + to-do counts
- **Subcategories**: the second level under any category
- **Item list**: classification/priority chips, done toggles, and an "inbox" lane for items still being analyzed

### 4. Powerful Search
- **Full-Text Search**: Search across extracted text, transcripts, titles
- **Filter by Category**: Browse specific collections
- **Date Range**: Find memories from specific time periods

## Architecture Highlights

### Offline-First Design
- Optimistic UI updates (instant feedback)
- Background sync with retry logic
- AsyncStorage queue for failed uploads

### Async AI Processing
- Upload completes immediately (no waiting for AI)
- Background job queue processes memories
- Real-time status updates via Supabase Realtime

### Cost Optimization
- Batch processing for efficiency
- Smart caching of AI results
- Incremental processing (only new content)

## Environment Variables

Create a `.env` file with:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-key-here
```

**Security Notes:**
- Never commit `.env` to version control
- Use Supabase Row Level Security (RLS) for data protection
- Rotate API keys regularly
- Use environment-specific keys (dev/staging/prod)

## Development Roadmap

### Phase 1: MVP (Weeks 1-6)
- [ ] React Native app shell with navigation
- [ ] Supabase auth integration
- [ ] Basic iOS share extension (text only)
- [ ] OpenAI GPT-4 text categorization
- [ ] Simple web interface for viewing memories
- [ ] TestFlight deployment

### Phase 2: Enhanced Features (Weeks 7-12)
- [ ] Image analysis with GPT-4 Vision
- [ ] Audio transcription with Whisper
- [ ] Advanced categorization rules
- [ ] UI/UX improvements
- [ ] Storage quota management
- [ ] Comprehensive error handling

### Phase 3: Production Hardening (Weeks 13-16)
- [ ] Integration testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Edge case handling
- [ ] Production deployment prep
- [ ] User acceptance testing

### Phase 4: Launch (Weeks 17-20)
- [ ] Beta testing program
- [ ] Bug fixes and refinements
- [ ] App Store submission
- [ ] Web deployment (Vercel/Netlify)
- [ ] Monitoring and analytics
- [ ] Post-launch support

## Testing Strategy

### Unit Tests
- AI processing functions
- Category assignment logic
- Supabase client utilities

### Integration Tests
- OpenAI API interactions
- Supabase database operations
- Storage upload/download flows

### E2E Tests
- iOS share extension flow
- Web search and retrieval
- Offline sync scenarios

### Performance Tests
- Upload speed (target: <2s for 1MB image)
- Search latency (target: <500ms)
- AI processing time (target: <10s for vision, <30s for audio)

## Deployment

### iOS App
```bash
# Build for TestFlight
eas build --platform ios --profile preview

# Submit to App Store
eas submit --platform ios
```

### Web App
```bash
# Build for production
npm run build:web

# Deploy to Vercel
vercel --prod

# Or deploy to Netlify
netlify deploy --prod
```

### Supabase Edge Functions
```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy analyze-memory
```

## Cost Estimates

### OpenAI API (per 1,000 users/month)
- GPT-4 Vision: ~$50-100 (assuming 10 images/user/month)
- Whisper: ~$20-40 (assuming 5 voice memos/user/month)

### Supabase (per 1,000 users/month)
- Pro Plan: $25/month (includes 8GB database, 100GB bandwidth)
- Storage: ~$10/month (assuming 500MB/user average)

### Total Estimated Cost: ~$105-175/month for 1,000 active users

## Contributing

This project is currently in specification phase. Contributions will be welcomed once implementation begins.

### Planned Contribution Areas
- React Native component development
- AI prompt engineering
- UI/UX improvements
- Documentation
- Testing

## License

MIT License - See LICENSE file for details

## Support

For questions or issues:
- 📧 Email: support@memoryvault.app (placeholder)
- 📖 Documentation: See `docs/` directory
- 🐛 Bug Reports: GitHub Issues (when repository is public)

## Acknowledgments

- **OpenAI**: GPT-4 Vision and Whisper APIs
- **Supabase**: Backend infrastructure
- **Expo**: Cross-platform development framework
- **React Native Community**: Component libraries and tools

---

**Note**: This project requires significant development effort before deployment. The specification is complete, but implementation is needed. Estimated timeline: 8-12 weeks for MVP, 16-20 weeks for production-ready system.

---

_Built by [The Agency](https://github.com/msitarzewski/agency-agents) — orchestrator run on 2026-06-01T22:24:49.881Z._
