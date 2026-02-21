# OpenChief

AI agents that passively watch business tools and produce reports via Claude. Open-source, serverless, runs on Cloudflare Workers.

## Architecture

- **pnpm monorepo + Turborepo** — `packages/shared`, `workers/*`, `workers/connectors/*`
- **Cloudflare Workers** — runtime (Durable Objects), router (Queue consumer), dashboard (React SPA + API), connectors (one Worker per data source)
- **Cloudflare D1** — shared database for agents, events, reports, revisions, identity mappings, model settings
- **Cloudflare KV** — caching layer for subscriptions, reports, user profiles, connector metadata, avatars
- **Cloudflare Queues** — `openchief-events` queue connects connectors to the router
- **Cloudflare Vectorize** — vector index for RAG (long-term memory), stores report/event embeddings
- **Cloudflare Workers AI** — embedding model (`@cf/baai/bge-base-en-v1.5`) for Vectorize indexing and retrieval
- **Durable Objects** — per-agent persistent state with SQLite inbox (events, reports, chat history, reasoning log)
- **React + Tailwind CSS v4** — SPA dashboard at `workers/dashboard`
- **Anthropic Claude** — LLM for report generation and agent chat (claude-sonnet-4-6 default)

## Repo Structure

```
openchief/
├── packages/shared/          # @openchief/shared — types, matching, ULID generation
├── workers/
│   ├── runtime/              # Agent Durable Object runtime (report generation + chat)
│   ├── router/               # Event router (queue consumer → D1 persistence)
│   ├── dashboard/            # React SPA + API worker (all UI + management endpoints)
│   └── connectors/           # One Worker per data source (14 connectors, all implemented)
│       ├── github/           # Webhook + polling
│       ├── slack/            # Webhook + polling + backfill + identity sync
│       ├── discord/          # Webhook (Ed25519) + polling
│       ├── figma/            # OAuth + webhook + polling (versions, comments, activity)
│       ├── jira/             # Polling (issues, transitions, sprints)
│       ├── jpd/              # Polling (Jira Product Discovery — ideas, insights)
│       ├── notion/           # Polling (pages, databases, comments)
│       ├── intercom/         # Webhook (HMAC-SHA1) + polling (conversations)
│       ├── twitter/          # OAuth PKCE + polling (multi-account, search)
│       ├── amplitude/        # Polling (metrics snapshots)
│       ├── google-calendar/  # OAuth + polling (calendar events)
│       ├── google-analytics/ # Polling (GA4 metrics via service account)
│       ├── quickbooks/       # OAuth (Intuit) + polling (invoices, payments, P&L)
│       └── rippling/         # Polling (employees, org structure, time-off)
├── agents/                   # 15 agent JSON definitions (data, not code)
├── migrations/               # 6 D1 SQL migration files
├── scripts/                  # setup.ts, seed-agents.ts, generate-config.ts, deploy.ts, teardown.ts
├── openchief.example.config.ts
├── turbo.json
└── pnpm-workspace.yaml
```

## Key Commands

```bash
pnpm build              # Build all packages (Turborepo)
pnpm typecheck           # Type check everything
pnpm dev                 # Start local dev servers
pnpm seed                # Seed agent definitions from agents/ to D1
pnpm run setup           # Interactive setup wizard (creates Cloudflare resources)
pnpm generate-config     # Generate wrangler.jsonc files from openchief.config.ts
pnpm run deploy          # Build + deploy all workers
pnpm run teardown        # Delete all workers + Cloudflare resources (--yes to skip prompts)

# Deploy individual workers
cd workers/runtime && npx wrangler deploy
cd workers/router && npx wrangler deploy
cd workers/dashboard && npx wrangler deploy
cd workers/connectors/github && npx wrangler deploy
cd workers/connectors/slack && npx wrangler deploy
```

## Event Flow

```
Source (GitHub, Slack, etc.)
  → Connector Worker (normalize to OpenChiefEvent, publish to queue)
    → Cloudflare Queue (openchief-events)
      → Event Router Worker (identity resolution, tweet enrichment, persist to D1)
        → Agent Durable Object reads events from D1 at report time
          → Claude generates report
            → Report stored in D1 + KV + local SQLite
```

## RAG (Long-Term Memory)

RAG gives agents historical context beyond the 48–72 hour event window. Implemented in `workers/runtime/src/rag.ts`.

### How It Works

1. After each report is generated, `indexReport()` embeds the headline and each section as separate vectors and upserts them to Cloudflare Vectorize (non-blocking via `ctx.waitUntil()`)
2. Before generating a report or answering a chat message, `retrieveContext()` embeds the query and searches Vectorize for the top-10 most relevant historical items, filtered by `agentId`
3. The retrieved context is injected into the prompt as `═══ HISTORICAL CONTEXT ═══`

### Cloudflare Services

- **Vectorize** — vector database (`openchief-agents` index, 768 dimensions, cosine metric)
- **Workers AI** — embedding model `@cf/baai/bge-base-en-v1.5` (768-dim output)
- Bindings: `VECTORIZE: VectorizeIndex` and `AI: Ai` on the runtime worker (both optional)

### What Gets Indexed

| Vector Type | ID Pattern | Content | Metadata |
|-------------|------------|---------|----------|
| Report headline | `report:{id}:headline` | Headline + action items | agentId, reportType, health, createdAt |
| Report section | `report:{id}:s{index}` | Headline + section name + body | agentId, reportType, sectionName, severity |
| Event batch | `events:{agentId}:{startDate}` | ~20 event summaries joined | agentId, startDate, endDate, eventCount |

### Integration Points in `agent-do.ts`

- **Report generation** (~line 708): retrieves RAG context before `buildPrompt()`
- **Chat** (~line 202): retrieves RAG context using the user's message as query
- **Post-report indexing** (~line 815): indexes the report via `ctx.waitUntil()`

### Configuration

RAG is optional. It activates when `vectorizeIndexName` is set in `openchief.config.ts`:

```typescript
cloudflare: {
  // ...
  vectorizeIndexName: "openchief-agents",  // Set to enable RAG
}
```

The setup wizard creates the Vectorize index automatically. The `generate-config.ts` script adds `vectorize` and `ai` bindings to the runtime worker's `wrangler.jsonc` when configured.

### Admin Endpoint

`POST /admin/backfill-vectorize` — indexes all existing reports from D1 into Vectorize. Run this after first enabling RAG on an instance with existing data.

### Error Handling

All RAG operations fail gracefully — if Vectorize or Workers AI is unavailable, agents continue generating reports and answering chat without historical context. Errors are logged but never block report generation.

## Adding a New Agent

Agents are **data, not code** — JSON configs in `agents/`. To add a new one:

1. Create `agents/<id>.json` following the schema (see `agents/CLAUDE.md`)
2. Required fields: `id`, `name`, `description`, `subscriptions`, `persona`, `outputs`, `enabled`
3. Optional: `tools` (array of tool names the agent can use in chat)
4. Seed to D1: `pnpm seed`
5. The seed script reads ALL `.json` files from `agents/` — no other code changes needed
6. Add an icon mapping in `workers/dashboard/src/components/AppSidebar.tsx` `agentIconMap`

## Adding a New Connector

1. Create `workers/connectors/<name>/` with `src/index.ts`, `package.json`, `wrangler.jsonc`
2. Implement: webhook handling and/or polling → normalize to `OpenChiefEvent` → publish to `EVENTS_QUEUE` queue
3. Add connector config to `CONNECTOR_CONFIGS` in `workers/dashboard/worker/index.ts`
4. Add source-to-tool mapping in `SOURCE_TO_TOOL` in same file
5. Add icon mapping in `workers/dashboard/src/components/SourceIcon.tsx`
6. Add to `pnpm-workspace.yaml` if not already covered by `workers/connectors/*` glob

## Agent Tools (Data-Driven)

Each agent definition has an optional `tools: string[]` array. Tools are looked up from the `ALL_TOOLS` registry in `workers/runtime/src/agent-tools.ts`:

| Tool | Description | Used By |
|------|-------------|---------|
| `query_events` | Read-only SQL (SELECT/WITH) against D1 events table | Most agents |
| `github_file` | Fetch file content or directory listing from configured repo | eng-manager, ciso |
| `github_search` | Code search in configured GitHub repo | eng-manager, ciso |

Tool access is enforced: agents without a tool in their `tools` array cannot use it in chat.

## Configuration System

- `openchief.example.config.ts` — Template with all required fields
- `openchief.config.ts` — User's actual config (gitignored)
- `scripts/generate-config.ts` reads the config and writes `wrangler.jsonc` files for all workers
- Config covers: instance identity, Cloudflare resource IDs, runtime settings, auth, GitHub repo, connector enablement

## Auth

Three auth modes, configured via `auth.provider` in `openchief.config.ts`:

| Mode | How It Works | Best For |
|------|-------------|----------|
| `"none"` | Open access, no login | Local dev, VPN-protected instances |
| `"cloudflare-access"` | Cloudflare Zero Trust SSO at the edge | Teams with existing CF Access / identity providers |
| `"password"` | Single admin password with cookie-based sessions | Simple deployments (recommended default) |

### Password Auth

- Password stored as a Wrangler secret (`ADMIN_PASSWORD`)
- Sessions use HMAC-SHA256 signed cookies (`oc_session`, 7-day TTL, HttpOnly + Secure + SameSite=Lax)
- Session token format: `email|expiry|hmac_hex` — signed with `ADMIN_PASSWORD` via Web Crypto API
- Login page at `/login`, logout button in sidebar
- All `/api/*` routes (except `/api/auth/*`) require a valid session cookie

### Cloudflare Access Auth

- CF Access injects `cf-access-authenticated-user-email` header at the edge after SSO
- Worker middleware rejects API requests missing this header (returns 401)
- Frontend redirects unauthenticated users to `https://<teamDomain>/cdn-cgi/access/login`
- `CF_ACCESS_TEAM_DOMAIN` wrangler var tells the frontend where to redirect
- Requires creating an Access application in the CF Zero Trust dashboard (not automated — the deploy script prints step-by-step instructions with the dashboard URL)

### Auth Implementation Files

| File | Role |
|------|------|
| `workers/dashboard/worker/index.ts` | Env bindings, session helpers (HMAC), auth middleware, 3 auth endpoints, async `getUserEmail()` |
| `workers/dashboard/src/lib/auth.tsx` | `AuthProvider` context + `useAuth()` hook — checks `/api/auth/session` on mount |
| `workers/dashboard/src/components/RequireAuth.tsx` | Route guard — redirects to `/login` (password) or CF Access login URL |
| `workers/dashboard/src/pages/Login.tsx` | Password login page |
| `workers/dashboard/src/components/AppSidebar.tsx` | Logout button (password mode only) |
| `workers/dashboard/src/lib/api.ts` | 401 response triggers `window.location.reload()` to re-enter auth flow |

### Auth API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/auth/session` | Returns `{ authenticated, provider, email?, teamDomain? }` — always accessible |
| `POST` | `/api/auth/login` | Password auth only — constant-time compare, sets session cookie |
| `POST` | `/api/auth/logout` | Clears session cookie (Max-Age=0) |

### Wrangler Vars & Secrets

| Name | Type | Mode | Description |
|------|------|------|-------------|
| `AUTH_PROVIDER` | var | All | `"none"`, `"cloudflare-access"`, or `"password"` |
| `ADMIN_PASSWORD` | secret | password | The admin password (set via `wrangler secret put`) |
| `CF_ACCESS_TEAM_DOMAIN` | var | cloudflare-access | Team domain for login redirect (e.g. `your-team.cloudflareaccess.com`) |

### Identity Resolution

Regardless of auth mode, user email is resolved via the `identity_mappings` D1 table for display names, avatars, team, and role. Falls back to email prefix if no identity found.

## Database (D1)

6 migration files in `migrations/`:
- `events` — All normalized events from all connectors
- `agent_definitions` — Agent configs (JSON)
- `agent_subscriptions` — Source + event type patterns per agent
- `reports` — Generated reports with content JSON
- `agent_revisions` — Change history for agent configs
- `identity_mappings` — Cross-platform user identity (GitHub, Slack, Discord, Figma, Jira, Notion)
- `model_settings` — Per-job-type AI model configuration

## Caching (KV)

| Key Pattern | TTL | Used By |
|-------------|-----|---------|
| `report:{agentId}:latest` | 5 min | Dashboard (latest report) |
| `subscriptions:all` | — | Runtime (invalidated on agent change) |
| `avatar:{agentId}` | — | Dashboard (agent avatars) |
| `identity:index` | 5 min | Router (identity resolution) |
| `slack:user:{userId}` | 24 hr | Slack connector (user cache) |
| `slack:channels:list` | 1 hr | Slack connector (channel cache) |
| `slack:backfill:cursor` | — | Slack connector (polling state) |
| `poll:cursor:{repo}` | — | GitHub connector (polling state) |
| `connector-secret:{source}:{field}` | — | Dashboard (secret metadata) |

## Naming Conventions

- Worker names: `openchief-runtime`, `openchief-router`, `openchief-dashboard`, `openchief-connector-{source}`
- Queue: `openchief-events`
- D1: `openchief-db`
- Package: `@openchief/shared`
- Agent IDs: kebab-case (`eng-manager`, `data-analyst`)
- Event types: dot-notation (`pr.opened`, `message.posted`, `build.failed`)
- Sources: lowercase (`github`, `slack`, `jira`, `google-analytics`)

## Development & Deploy Workflow

OpenChief is an open-source package — the source repo (`~/dev/openchief`) uses placeholder values for all Cloudflare resource IDs. A separate test directory (`~/dev/openchief-test`) holds the real deployed instance with actual resource IDs. **Never deploy directly from the source repo.**

### Workflow

1. **Edit** code in `~/dev/openchief/` (the source repo)
2. **Build** from the source repo: `pnpm build`
3. **Copy** the changed worker(s) to the test directory:
   ```bash
   rsync -av --exclude node_modules ~/dev/openchief/workers/<worker>/ ~/dev/openchief-test/workers/<worker>/
   ```
4. **Deploy** from the test directory:
   ```bash
   cd ~/dev/openchief-test/workers/<worker> && npx wrangler deploy
   ```
5. **Commit & push** from the source repo (which keeps placeholder values)

### Why Two Directories

- The source repo is open-source and must never contain real account IDs, database IDs, KV namespace IDs, or secrets
- The test directory has `wrangler.jsonc` files with real Cloudflare resource IDs filled in
- The Vite/Cloudflare build plugin for the dashboard generates a `dist/` config that references the source directory — if deploy configs get stale, delete `.wrangler/deploy/config.json` in the test directory and use a manually configured `wrangler.jsonc` with real IDs
- The test directory is not a git repo — it's a deployment staging area only

### Test Directory Resource IDs

Real Cloudflare resource IDs for `~/dev/openchief-test/` are stored in `.claude/settings.local.json` (gitignored). Check there or run `pnpm run setup` in the test directory to see current values.

## Code Style

- TypeScript strict mode everywhere
- ES2022 target and module
- Bundler module resolution
- Explicit return types on exported functions
- No default exports (except Cloudflare Worker entry points)
- Tailwind CSS v4 with OKLch color space in dashboard
- shadcn/ui component library (Radix primitives + CVA variants)
