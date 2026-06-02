# CLAUDE.md — Memory Vault

Read this first. It is the project map so you don't have to re-scan the whole tree each chat. If something here is wrong or stale, fix this file as part of your change.

## What this is

**Memory Vault** — a cross-platform (iOS + Web) AI life-organizer / ideas collector. Users capture screenshots, photos, voice memos, links, and notes; OpenAI classifies each into a smart category (**Ideas**, Recipes, Movies to Watch, GitHub Repos, AI News, Travel Ideas, Shopping, Other) and extracts **typed, category-specific structured data** — recipe ingredients/steps, article TL;DRs, product prices, idea next-actions — plus every URL it can find (incl. text inside screenshots) and a 0–100 "spark score" for ideas. The detail screen renders a different rich card per category.

- **Frontend**: React Native via Expo `~50`, TypeScript (strict), React Navigation (native-stack), Zustand for state.
- **Backend**: Supabase (Auth, Postgres + RLS, Storage, Edge Functions on Deno).
- **AI**: OpenAI `gpt-4o` (vision + text categorization) and `whisper-1` (audio transcription), invoked **only** from the Edge Functions (`analyze-memory`, `process-my-memories`).
- **Status**: functional MVP. Email/password auth, capture (note/link/image→Storage), live memory list, category counts, search, and detail view are all wired to the live Supabase backend. Backend (tables, RLS, storage bucket, both Edge Functions) is deployed to project `saovircuzswtespcghij`.

## Layout (real project root is this directory)

```
App.tsx                         # AuthProvider + auth-gated native-stack navigator
env.js                          # Generated web env shim (window.ENV) — do not hand-edit; NOT read by src/lib/supabase.ts
src/
  screens/                      # AuthScreen, HomeScreen (list+FAB), CaptureScreen, CategoryScreen, MemoryDetailScreen, SearchScreen
  components/StructuredCard.tsx # Renders the category-specific rich card (recipe/article/product/repo/movie/travel/idea) + ExtractedLinks + SparkBar
  lib/supabase.ts               # Supabase client; reads EXPO_PUBLIC_* env, throws on placeholders
  lib/auth.tsx                  # AuthProvider/useAuth: session state, signIn/signUp/signOut
  lib/api.ts                    # All DB/storage queries + processMyMemories() invoke; categoryIcon()/primaryCategory() helpers
  types/index.ts                # Memory, StructuredData union (RecipeData|ArticleData|...), CATEGORIES — source of truth for the data model
supabase/
  migrations/                   # 4 SQL migrations: initial schema, storage+RLS hardening, revoke definer execute, structured_extraction
  functions/_shared/extract.ts  # Shared extraction engine: typed prompt, URL harvesting, spark scoring (used by BOTH functions)
  functions/analyze-memory/     # Deno Edge Function: service-role + x-cron-secret (production cron path)
  functions/process-my-memories/ # Deno Edge Function: user-JWT scoped; invoked by the app after each capture
docs/                           # deployment-guide, setup-guide, DEPLOYMENT, qa-certification
.env.example                    # Template — explains the public vs server-secret split
```

## Critical conventions (don't break these)

- **Env var split**: client code may only read `EXPO_PUBLIC_*` vars (e.g. `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). The anon key is public + RLS-gated and safe to ship. **`OPENAI_API_KEY` and `CRON_SECRET` are server-only** — set via `supabase secrets set ...`, never in `.env` or client code.
- **Two Edge Function auth models**: `analyze-memory` runs with the service role, gated by a constant-time `x-cron-secret` check against `CRON_SECRET`, `verify_jwt=false` (production cron path — don't make it publicly callable). `process-my-memories` is `verify_jwt=true` and builds an RLS-scoped client from the caller's `Authorization` JWT, so it only ever touches the caller's own rows; it needs no `CRON_SECRET`/service-role key, only `OPENAI_API_KEY`. The app calls it via `supabase.functions.invoke('process-my-memories')`.
- **Row claiming**: both functions atomically flip `pending → processing` per row so concurrent workers don't double-process. Preserve that pattern if you touch the job loop.
- **One extraction engine**: both Edge Functions delegate to `supabase/functions/_shared/extract.ts` (`extractMemory()`). Change the prompt or extraction logic THERE, not in either `index.ts`, so the cron path and the app path never drift. The functions only own row-claiming + writeback.
- **Structured columns + back-compat**: `extractMemory()` returns `{ ai_metadata, category, structured_data, extracted_links, spark_score }` and both functions persist all of them. `ai_metadata` (summary/suggested_categories/suggested_tags) is kept populated for older clients — don't drop it. `structured_data.kind` is the discriminant the UI switches on; `spark_score` is non-null only for `Ideas`.
- **Types first**: `src/types/index.ts` mirrors the DB schema and the extraction output. If you add a category, update `CATEGORIES`, the `StructuredData` union, the prompt schema in `extract.ts`, and the `categoryIcon` map together.
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
