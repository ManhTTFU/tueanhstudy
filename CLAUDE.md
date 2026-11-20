# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Bé Vui Học Toán" – a Vietnamese math game for children aged 3–5. Vite + React 18 + TypeScript (strict) + Tailwind frontend, a REST API served as a single Vercel Function, and Neon PostgreSQL via Drizzle ORM. All UI text, comments, error messages and docs are in **Vietnamese**; keep it that way. README.md (Vietnamese) holds the full deploy, backup and extension guides.

## Commands

```bash
npm run dev            # Vite dev server on :5173, serves frontend AND /api (dev/apiPlugin.ts)
DATABASE_URL= PGLITE_DIR=/tmp/x npm run dev   # force a throwaway local PGlite even if .env.local points at Neon
npm run build          # tsc --noEmit && vite build -> dist/ (hashed bundles go in dist/static/)
npm run typecheck
npm test               # vitest run (tests/**/*.test.ts, node environment)
npx vitest run tests/api.test.ts            # single file
npx vitest run -t "không cộng trùng"        # single test, matched by name
npm run db:generate    # after editing db/schema.ts -> new SQL in db/migrations/
npm run db:migrate     # migrates DATABASE_URL_UNPOOLED || DATABASE_URL (Neon!), or local PGlite (.data/pglite) when both unset
npm run db:studio
npm run assets:images  # download missing Fluent Emoji SVGs for the object/sticker catalogs
npm run assets:voice   # generate missing Vietnamese voice .m4a (macOS `say -v Linh` only)
npm run assets:sfx     # regenerate synthesized WAV effects
```

No linter is configured. `.env.local` is loaded by vite.config.ts, drizzle.config.ts and scripts/migrate.ts. `assets:voice` exits on non-macOS (e.g. this Windows machine): any new spoken prompt then has no `.m4a` and `tests/engine.test.ts` fails until the file is generated on a Mac or recorded by hand.

Tests use in-memory PGlite with all migrations applied, so they never touch Neon. `tests/migration.test.ts` replays only the first N migrations (trimmed `_journal.json`), seeds old-shape data, then applies the rest; add a case there for any migration that transforms existing rows.

## Architecture

### Shared pure core (client + server)
`src/engine/`, `src/chapters/registry.ts`, `src/chapters/*/{config,generator}.ts`, `src/config/`, `src/data/stickers.ts` and `src/data/objects/catalog.ts` are imported by **both** the React app and the server. Rules for these files:
- No React, DOM, or other browser-only imports.
- Relative imports **must end in `.js`** (e.g. `'./random.js'`). Vercel runs `api/` as unbundled per-file ESM on Node, so imports without an extension break at runtime even though Vite and `tsc` accept them. Purely frontend files (`.tsx`, features/, components/) can use imports without an extension.

### One quiz engine, many chapters
- A chapter is a `ChapterDefinition` (`src/engine/types.ts`) registered in `src/chapters/registry.ts`. It holds the id, theme, range, quiz config, reward config, `enabled` flag and a `QuestionGenerator` built with `createQuestionGenerator` (which handles de-duplication). Its UI is registered separately in `src/chapters/ui-registry.tsx` (`QuestionView`, `Illustration`, `promptVoice`, optional `Learning` stage).
- A chapter with `parentId` is a sub-game (e.g. `number-finding` → "Tìm số" under `number-recognition`): it is hidden from the home page (`getHomeChapters`) and offered in the game picker that opens when "Chơi ngay" is tapped on its parent's intro page (`getSubGames`; labels from the optional `game` field). It is otherwise a normal chapter with its own sessions, progress and rewards.
- Levels: a chapter's optional `level` groups games inside a root chapter (`src/chapters/levels.ts`). "Làm quen mặt số" has level 1 (1–10: `number-recognition`, `number-finding`) and levels 2–10 (11–20 … 91–100), generated from `LEVEL_STICKERS` in `src/chapters/number-recognition/levels.ts` (cards up to `MAX_NUMBER` in `src/data/numbers/numbers.ts`). Level N unlocks when every game of level N-1 has bestScore ≥ `LEVEL_UNLOCK_MIN_SCORE` (8). `startSession` enforces this (403 `level_locked`); the intro page only displays it (`?cap=N` selects the level).
- Arithmetic (`src/chapters/arithmetic/`): `OPERATIONS` (operations.ts) defines each operation (symbol, spoken word, `compute`, `pairs(level)`, `answerRange`); `config.ts` builds one chapter per (`ARITHMETIC_LEVELS` × `ARITHMETIC_GAMES`), root id `arithmetic` (= add, level 1). Visuals per operation live in `OPERATION_VIEWS`; voice files `questions/<op>-<a>-<b>` come from `allVoiceLines()`. Chapters can set `levelLabel` (level tab text) and `fullName` (name stored in history/stats).
- `brain` is now a hub-only chapter (`hubOnly: true`: no quiz, excluded from overall progress, `startSession` returns 404); its intro page only lists the 11 topics. The old brain skill games are `enabled: false` but kept so old history still resolves names.
- Picture answers (`src/chapters/brain/`): answers stay numeric (index of the object in `OBJECTS`), and `payload.choices` maps value → object id so stored sessions keep rendering. `ChapterUI` can provide `OptionContent` / `optionLabel` (rendered by `AnswerOptions`) and `optionsDelayMs` (QuizPage hides the options at first, e.g. memory game). `getSessionDetail` adds `correctLabel`/`selectedLabel` when a question has `choices`.
- "Sân chơi tư duy" (`src/chapters/dada/`): 11 `Topic`s (topics/*.ts), each level = one chapter built in config.ts (root `dd-<topic>` with `hubId: 'brain'`, then `dd-<topic>-<n>` as its children). `hubId` hides a chapter from the home page and lists it as a tile (`TopicShelf`) on the hub chapter's intro page; its own intro page's back button returns to the hub. Questions are data: `payload.blocks` (Block) + `payload.choices` (Visual, value = position) rendered generically by `DadaViews.tsx`; build them with `choiceQ`/`numberQ` and wrap a level with `levelGenerator` (tolerates small variety). A question may have 2..`quiz.optionCount` options (QuizEngine validates that range). Voice files are `sounds/dada/<fnv-hash>.m4a` of `payload.say ?? prompt`, collected by sampling every generator with fixed seeds in `dadaVoiceLines()`; `tests/engine.test.ts` asserts every sampled prompt has a file, so after adding a generator run `npm run assets:voice`.
- Age groups: `ChapterDefinition.ageGroup` (`'preschool'` default = 3–5 tuổi, `'primary'` = 5–9 tuổi). The home page shows `getHomeChapters(ageGroup)` for the family's `families.age_group` setting (switch on the home page, saved via `PUT /api/settings`); `overallProgress` counts only chapters of the selected group.
- "Nhóm 5–9 tuổi" (`src/chapters/primary/`): "Tính nhẩm" (`pm-mental`, 6 levels from `MENTAL_STAGES`) and hub "Tư duy toán" (`pm-think`, hubOnly) with 7 `PRIMARY_TOPICS` × 3 levels (`pm-<topic>`, `pm-<topic>-2/3`). Question builders in `kit.ts`: `inputQ` (free numeric input: `Question.input = true`, `options = []`; QuizPage renders `NumberPad`; `evaluateSubmission` accepts any distinct integer 0..`MAX_INPUT_VALUE`, at most `MAX_INPUT_ATTEMPTS`) and `pickQ` (text/emoji choices in `payload.choices`). `payload.steps` is client-only guidance shown by `PrimaryQuestionView` after the first wrong try (QuizPage passes `wrongTries`); scoring is unchanged. These prompts are random text, so `promptVoice` returns `{ file: '' }` and `AudioController.speak` uses the system Vietnamese voice; no `.m4a` files are needed.
- Primary extras (`server/services/primaryService.ts`, `challengeService.ts`, rules in `src/chapters/primary/rewards.ts`): coins are an earn-only ledger (`coin_ledger`, UNIQUE `(family_id, dedupe_key)`: `session:<id>:coin`, `challenge:<id>:coin`); balance = ledger sum − `redemptions.cost` sum. `completeSession` awards coins and updates `review_items` only for `ageGroup === 'primary'` chapters, and grants NO candy/sticker/achievement rewards for them (primary chapters have `rewards: { candiesForPerfect: 0 }`; the home page hides `RewardZone` and `AppHeader`/result screens show coins via `coins` / `coinsOnly`). "Ôn câu sai" is chapter `pm-review` (`review: true`): `startSession` takes questions from `review_items` (409 `review_empty` when none; `useQuiz` shows the `unavailable` stage) with question id = item key `<chapter>|<question id>`. Redeeming locks the family's `progress` row and is idempotent on a client UUID. Challenge runs store server-generated questions; completion checks order and a minimum of 600 ms per answer. Leaderboard = coins earned this week (Monday 00:00 UTC+7) across families, names only. Pages: `src/features/primary/` (`/thu-thach`, `/doi-qua`, `/bang-xep-hang`), parent "Đổi quà" tab manages `shop_rewards` (soft delete) and marks redemptions delivered. Backup `schemaVersion` 2 adds `coins`, `shopRewards`, `redemptions`, `challenges` (v1 files are upgraded with empty arrays).
- `QuizPage` + `useQuiz` (`src/features/quiz/`) are generic and must stay chapter-agnostic. Home, intro and learning pages iterate the registries. To add a chapter, add these files and registry entries; do not branch on a chapter id in shared code.
- `QuizSession.ts` is a pure state machine (`answering → correct|wrong → … → finished`). Input is ignored outside `answering`, which prevents double taps from counting. Tried wrong options are dimmed.
- **Scoring uses the first attempt only.** A wrong first try counts as incorrect even after the child retries correctly.

### Server trusts nothing from the client
- `POST /api/quiz/sessions`: the server generates the questions (`generateQuiz`) and stores them in `quiz_sessions.questions` (jsonb).
- `POST /api/quiz/sessions/:id/complete`: the client sends only `{questionId, attempts[]}`. `evaluateSubmission` validates the attempts against the stored questions and recomputes the score, and enforces `minDurationMs`. Everything runs in **one transaction** (`server/services/quizService.ts`): `SELECT … FOR UPDATE` on the session; an already-completed session returns the old result with `rewards: []`.
- Reward idempotency is enforced in the database: `(family_id, dedupe_key)` is UNIQUE (`session:<id>:candy`, `achievement:<code>`, `gift:<giftId>`), inserted with `ON CONFLICT DO NOTHING`. Gift opening is idempotent on a client-generated UUID (`gift_openings.id`). Candies accumulate and are never spent: available gifts = `floor(totalCandies / candiesPerGift) - giftsOpened`.
- `progress` is one row per family (`ensureProgressRow(db, familyId)`); `app_settings` is a single global row (`getGlobalSettingsRow`, only the HMAC secret); everything per-family (settings, PIN, versions, lockouts) comes from `getFamilyRow`.

### API layer
- `server/router.ts` defines a platform-independent `handleApiRequest(ApiRequest, db?) → ApiResponse` with a regex route table. Each route can set a rate-limit bucket and a `parent: true` auth flag.
- `api/router.ts` (the only Vercel Function) adapts `VercelRequest` to `ApiRequest`. `vercel.json` rewrites `/api/:path*` to `/api/router?route=:path*`. Add new endpoints to the route table; do not create more files in `api/`, because the free Hobby plan limits how many Functions a deployment can have.
- Every non-GET request needs the header `X-BVHT-Client: 1` (CSRF guard). `src/services/api.ts` adds it automatically.
- Parent auth: the PIN is hashed with scrypt; the session is an HttpOnly, SameSite=Strict cookie `bvht_parent` holding an HMAC token (`{fid, v, exp}`) whose `v` is checked against `families.session_version` (`bumpSessionVersion` logs out all devices). Five wrong PINs (or family codes) lock that family's login for 5 minutes, tracked in `families.failed_*_attempts` / `*_locked_until`.
- Multi-family (`server/familyAuth.ts`): every learning table carries `family_id` (FK to `families`, which also holds name, code hash, PIN hash, versions, lockouts and sound/motion settings). `handleApiRequest` resolves `familyId` from the `bvht_family` cookie and passes it to every non-`open` handler; services must always filter by it (never trust ids from the client). Login is name (normalized, no diacritics) + family code, or name + parent PIN. Registering a family needs `FAMILY_INVITE_CODE` except for the very first family; capped by `MAX_FAMILIES` (10). Parent tokens embed `fid` and only work for that family. `FamilyGate` (src/features/family) shows login/register and listens for the `bvht:family-required` event dispatched by `src/services/api.ts`. Backup import re-issues session/gift UUIDs so one family's file never collides with another family's rows.
- The DB connection (`server/db.ts`) is a `pg` Pool from `DATABASE_URL`. `setDatabase()`, or passing `db` to `handleApiRequest`, injects PGlite instead. `dev/apiPlugin.ts` uses this when `DATABASE_URL` is unset, and the tests always do (`createPgliteDatabase()` with no directory = in-memory, migrations applied).

### Backup format
`server/services/backupService.ts` defines the format: `format: "be-vui-hoc-toan-backup"` plus `schemaVersion`. Import validates with Zod plus cross-checks (referential integrity, candy total = sum of candy rewards, gift count) and then replaces all learning tables in one transaction. PIN and secret are never exported or overwritten. If you change the shape, bump `BACKUP_SCHEMA_VERSION` and add a conversion step in `upgradeBackup()`.

### Assets
- Everything lives under `public/assets/` (served at `/assets/...`, while hashed build output goes to `/static/`).
- Object images: `images/objects/<id>.svg`, keyed by `OBJECTS` in `src/data/objects/catalog.ts`. The `source` field is the fluentui-emoji folder name.
- Voice files: `sounds/<file>.m4a`, listed by `allVoiceLines()` in `src/data/voice.ts`.
- `tests/engine.test.ts` asserts that every catalog object, number card and sticker has its image and audio file. Adding a catalog entry therefore needs `assets:images` and `assets:voice` (macOS only). Sources and licenses are recorded in `public/assets/LICENSES.md`.

### Frontend conventions
- Child-facing UI uses the `.kid-btn` class (touch targets of at least 64px) and the `Mascot` component with moods (`neutral`, `happy`, `sad`, `cheer`, `thinking`). Feedback must always be gentle and positive; never use failure wording for a 3-year-old.
- Sound and effects go through the `AudioController` / `AnimationController` singletons, which respect the sound-off and reduced-motion settings. Settings are stored in the database through `SettingsContext`; localStorage is only a display cache and must never hold real data.
- `CountingGrid` renders `<button>`s only when `tapToCount` is true, so it never nests buttons when placed inside a clickable card.
