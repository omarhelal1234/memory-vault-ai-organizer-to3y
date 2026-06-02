# CLAUDE.md — Memory Vault

Read this first. It is the project map so you don't have to re-scan the whole tree each chat. If something here is wrong or stale, fix this file as part of your change.

## What this is

**Memory Vault** — a cross-platform (iOS + Web) AI life-organizer / ideas collector. Users capture screenshots, photos, voice memos, links, reels, and notes; OpenAI files each under a **fully dynamic two-level taxonomy** (`category › subcategory`) — reusing the user's existing categories when one fits and only inventing a new name when nothing does — and extracts **typed, card-specific structured data** (recipe ingredients/steps, article TL;DRs, product prices, idea next-actions, reel action-items), every URL it can find (incl. text inside screenshots), a triage **priority** (1–3), and a 0–100 "spark score" for ideas. Pasted TikTok/Instagram/YouTube links are auto-enriched from their oEmbed/Open-Graph metadata. The UI is a drill-down: **Home (category dashboard) → Subcategories → item list (with classification/priority chips + done checkboxes) → detail (rich per-kind card)**. A `✨` "auto-organize" action runs an LLM reconcile pass that merges near-duplicate categories.

- **Frontend**: React Native via Expo `~50`, TypeScript (strict), React Navigation (native-stack), Zustand for state.
- **Backend**: Supabase (Auth, Postgres + RLS, Storage, Edge Functions on Deno).
- **AI**: OpenAI `gpt-4o` (vision + text categorization) and `whisper-1` (audio transcription), invoked **only** from the Edge Functions (`analyze-memory`, `process-my-memories`).
- **Status**: functional MVP. Email/password auth, capture (note/link/reel/image→Storage), the dynamic-taxonomy drill-down navigation, priority/done triage, search, and detail view are all wired to the live Supabase backend. Backend (tables, RLS, storage bucket, both Edge Functions) is deployed to project `saovircuzswtespcghij`. **Pending deploy as of this change**: migration `20240101000005` (backfill NULL subcategory -> 'General') and `process-my-memories` / `_shared/extract.ts` (reconcile null-vs-General fix) must be pushed for auto-organize to merge correctly in prod.

## Layout (real project root is this directory)

```
App.tsx                         # AuthProvider + auth-gated native-stack navigator
env.js                          # Generated web env shim (window.ENV) — do not hand-edit; NOT read by src/lib/supabase.ts
src/
  screens/                      # AuthScreen, HomeScreen (category dashboard+FAB), SubcategoryScreen, ItemListScreen (chips+done toggle, inbox mode), CaptureScreen, MemoryDetailScreen, SearchScreen
  components/StructuredCard.tsx # Renders the per-kind rich card (recipe/article/product/repo/movie/travel/idea/reel) + ExtractedLinks + SparkBar
  lib/supabase.ts               # Supabase client; reads EXPO_PUBLIC_* env, throws on placeholders
  lib/auth.tsx                  # AuthProvider/useAuth: session state, signIn/signUp/signOut
  lib/api.ts                    # DB/storage queries; processMyMemories()/reconcileTaxonomy() invokes; setPriority/setDone; taxonomy aggregation (topCategories/subcategoriesOf/itemsIn/unprocessed); categoryIcon/categoryColor/PRIORITY_META
  types/index.ts                # Memory, StructuredData union (...|ReelData), SEED_CATEGORIES (starting suggestions, NOT a closed set) — source of truth for the data model
supabase/
  migrations/                   # 6 SQL migrations: initial schema, storage+RLS hardening, revoke definer execute, structured_extraction, taxonomy_priority (subcategory/priority/done), backfill_subcategory_general (NULL subcategory -> 'General')
  functions/_shared/extract.ts  # Shared engine: dynamic taxonomy prompt (reuse-or-invent), link enrichment (fetchLinkContext: TikTok/IG/YouTube oEmbed + OG scrape), buildTaxonomy(), reconcileTaxonomy() (used by BOTH functions)
  functions/analyze-memory/     # Deno Edge Function: service-role + x-cron-secret (production cron path)
  functions/process-my-memories/ # Deno Edge Function: user-JWT scoped; invoked by the app after each capture
docs/                           # deployment-guide, setup-guide, DEPLOYMENT, qa-certification
.env.example                    # Template — explains the public vs server-secret split
```

## Critical conventions (don't break these)

- **Env var split**: client code may only read `EXPO_PUBLIC_*` vars (e.g. `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). The anon key is public + RLS-gated and safe to ship. **`OPENAI_API_KEY` and `CRON_SECRET` are server-only** — set via `supabase secrets set ...`, never in `.env` or client code.
- **Two Edge Function auth models**: `analyze-memory` runs with the service role, gated by a constant-time `x-cron-secret` check against `CRON_SECRET`, `verify_jwt=false` (production cron path — don't make it publicly callable). `process-my-memories` is `verify_jwt=true` and builds an RLS-scoped client from the caller's `Authorization` JWT, so it only ever touches the caller's own rows; it needs no `CRON_SECRET`/service-role key, only `OPENAI_API_KEY`. The app calls it via `supabase.functions.invoke('process-my-memories')`.
- **Row claiming**: both functions atomically flip `pending → processing` per row so concurrent workers don't double-process. Preserve that pattern if you touch the job loop.
- **One extraction engine**: both Edge Functions delegate to `supabase/functions/_shared/extract.ts` (`extractMemory()`). Change the prompt or extraction logic THERE, not in either `index.ts`, so the cron path and the app path never drift. The functions only own row-claiming, taxonomy loading, and writeback.
- **Dynamic taxonomy (reuse-or-invent)**: `category` and `subcategory` are free-form strings, NOT a fixed enum. Both functions load the user's existing taxonomy first (`buildTaxonomy()` over their completed rows) and pass it into `extractMemory()`; the prompt instructs the model to reuse an existing `category`/`subcategory` when it fits and only mint a new (short, Title Case) name when nothing does. `normalize()` snaps model output to existing names case-insensitively. The `✨` action calls `process-my-memories` with `{ mode: 'reconcile' }`, which runs `reconcileTaxonomy()` to merge near-duplicate pairs and bulk-updates the caller's rows. `analyze-memory` loads taxonomy **per user_id** (cached per batch) since it spans users. **`'General'` is the canonical empty subcategory** — `extractMemory()` always writes it (never NULL), reconcile coalesces NULL→`'General'` when building pairs, and the reconcile UPDATE matches `from_subcategory==='General'` against `subcategory='General' OR NULL` so legacy NULL rows still move. Don't reintroduce a NULL subcategory.
- **Card kind ≠ category**: `structured_data.kind` (one of idea/recipe/movie/repo/article/travel/product/reel) is chosen by content TYPE and is independent of the dynamic category. The UI switches the rich card on `kind`; `normalize()` drops any kind outside that fixed set. `spark_score` is non-null only when `kind === 'idea'`.
- **Structured columns + back-compat**: `extractMemory()` returns `{ ai_metadata, category, subcategory, structured_data, extracted_links, spark_score, priority }` and both functions persist all of them. `ai_metadata` (summary/suggested_categories/suggested_tags) is kept populated for older clients — don't drop it.
- **Link enrichment**: for `type:'link'`, `fetchLinkContext()` resolves TikTok/YouTube via official oEmbed and falls back to Open-Graph scraping (and for any other site) to recover title/author/caption/thumbnail before classifying. It never throws — partial/zero context still classifies from the bare URL. Reel cards are pre-seeded with the fetched thumbnail/platform so they survive model omissions.
- **Triage**: `priority` (1=low … 3=high) and `done` (bool) live on `memories` (migration `…0004`). `itemsIn()` sorts open-then-done, priority desc, newest. The done checkbox writes via `setDone()`; navigation/aggregation is derived client-side in `api.ts` from `listMemories()` (no reliance on the unused `categories`/`memory_categories` tables).
- **Types first**: `src/types/index.ts` mirrors the DB schema and the extraction output. To add a NEW rich-card kind: add its `*Data` type to the `StructuredData` union, list the kind in `STRUCTURED_KINDS` + its shape in the prompt in `extract.ts`, and add a renderer case in `StructuredCard.tsx`. (Adding a *category* needs no code change — the taxonomy is dynamic.)
- **Don't commit secrets**: `.env` is gitignored. Verify before every commit.

## Commands

```bash
npm install           # deps
npm run type-check    # tsc --noEmit  (run before committing)
npm run lint          # eslint src
npm test              # jest
npm run web           # Expo web dev server
npm run ios           # iOS simulator (macOS)
npm run build:web     # production web export

# Supabase
supabase db push                                  # apply migrations
supabase functions deploy analyze-memory          # cron-path function
supabase functions deploy process-my-memories     # app-invoked function (verify_jwt=true)
supabase secrets set OPENAI_API_KEY=... CRON_SECRET=...
```

Web runtime deps (Expo SDK 50): `react-dom`, `react-native-web`, `@expo/metro-runtime`. Also `@opentelemetry/api` is installed to satisfy a `@supabase/supabase-js` optional import under Metro. Auth uses **email/password**; for frictionless local testing, disable "Confirm email" in Supabase → Authentication → Providers → Email.

## Git

- Remote: `origin` → `github.com/omarhelal1234/memory-vault-ai-organizer-to3y`
- Work happens on feature branches (current: `chore/launch-finalize`); `main` is the deploy branch.

---

# Standard workflow for every task

Follow these steps in order on each unit of work. Do **not** skip the Codex review or the docs update.

### 1. Plan
State what you're going to change and why, in one short paragraph. For non-trivial work, list the files you expect to touch.

### 2. Implement
Make the change. Keep edits scoped to the task. Honor the conventions above. After coding, run the relevant checks:
```bash
npm run type-check && npm run lint && npm test
```

### 3. Cowork with Codex CLI (second pair of eyes / senior reviewer)
Before committing, have the `codex` CLI review the change as a senior engineer. Pipe it the diff and ask for correctness, security, and design feedback:
```bash
git --no-pager diff | codex exec "You are a senior code reviewer for an Expo/React Native + Supabase + TypeScript app. Review this diff for correctness, security (esp. secret handling and Supabase RLS), and design. List concrete issues by severity; say LGTM only if there are none."
```
- Read Codex's feedback and **address every blocking issue** (fix code, or write a one-line justification if you disagree).
- For larger or architectural changes, also ask Codex to sanity-check the *plan* from step 1 before implementing.
- Treat Codex as a reviewer, not an authority — you make the final call, but its concerns must be resolved or explicitly dismissed.

### 4. Update documentation (every run)
On every change, update the docs that the change affects:
- This `CLAUDE.md` if structure, conventions, or commands changed.
- `README.md` and the relevant file in `docs/` (setup-guide, deployment-guide, DEPLOYMENT, qa-certification) when behavior, setup, or deploy steps change.
- `.env.example` if env vars were added/removed/renamed.
- `src/types/index.ts` if the data model changed.

If a change genuinely touches no documented surface, state "no doc changes needed" and why.

### 5. Commit, push, and deploy
```bash
npm run type-check && npm run lint && npm test     # green before committing
git add -A
git commit -m "<concise message>"                  # see Co-Authored-By rule below
git push origin <current-branch>
```
Then deploy what changed:
- **Backend / edge function**: `supabase db push` (if migrations changed) and `supabase functions deploy analyze-memory` (if the function changed); re-set secrets if they changed.
- **Web**: `npm run build:web` then deploy the export (Vercel/Netlify per `docs/DEPLOYMENT.md`).
- **iOS**: `eas build` / `eas submit` per the deployment guide.

Only commit/push/deploy when the user has asked for it or pre-authorized it for the session. Report exactly what ran and any failures verbatim.

End commit messages with:
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```
