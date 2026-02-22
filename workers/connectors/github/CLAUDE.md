# GitHub Connector

Cloudflare Worker that ingests GitHub activity into OpenChief via webhooks and periodic polling. Normalizes raw GitHub API payloads into `OpenChiefEvent` objects and publishes them to the shared Cloudflare Queue.

## How It Works

Two ingestion paths, both produce the same normalized events:

### Webhooks (real-time)

GitHub sends POST requests to this worker when subscribed events occur. The worker:

1. Verifies the `X-Hub-Signature-256` HMAC-SHA256 signature (constant-time comparison)
2. Parses the `X-GitHub-Event` header to determine event type
3. Calls `normalizeGitHubEvent()` to convert the payload into one or more `OpenChiefEvent` objects
4. Publishes each event to the `EVENTS_QUEUE` (Cloudflare Queue)

### Polling (periodic)

A cron trigger (`0 */6 * * *`) calls `pollAllRepos()` which:

1. Reads the list of repos from `GITHUB_REPOS` (comma-separated)
2. Authenticates as a GitHub App using RS256 JWT → installation access token
3. Fetches PRs, reviews, issues, commits, comments, and workflow runs via GitHub API
4. Uses KV (`POLL_CURSOR`) to track the last-seen timestamp per repo (defaults to 30 days back on first run)
5. Slims payloads to essential fields before normalizing (to stay under queue message size limits)
6. Publishes all normalized events to the queue

Polling catches events that webhooks might miss (downtime, misconfiguration) and handles initial backfill.

## Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Worker entry point — routes requests (health check, webhook, admin /poll), cron handler |
| `src/normalize.ts` | Converts GitHub webhook/API payloads → `OpenChiefEvent[]` |
| `src/poll.ts` | GitHub API polling logic — fetches all event types with pagination, cursor management |
| `src/github-app-auth.ts` | GitHub App authentication — JWT generation, installation token caching |
| `src/webhook-verify.ts` | HMAC-SHA256 webhook signature verification (WebCrypto) |

## Event Types Produced

| GitHub Event | OpenChief Event Type | Key Metadata |
|-------------|---------------------|--------------|
| `pull_request` | `pr.opened`, `pr.closed`, `pr.merged`, `pr.updated` | additions, deletions, draft, labels, reviewers |
| `pull_request_review` | `pr.review.submitted` | state (approved/changes_requested), time-to-review hours |
| `issues` | `issue.opened`, `issue.closed`, `issue.updated` | number, title, labels, age in hours |
| `issue_comment` | `issue.comment.created` | word count, body preview |
| `pull_request_review_comment` | `pr.review.comment` | file path, word count |
| `push` | `commit.pushed` | commit count, branch |
| `workflow_run` | `build.completed` | conclusion (success/failure), branch |

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | None | Health check — returns `{ ok: true }` |
| `POST` | `/` | Webhook signature | GitHub webhook receiver |
| `POST` | `/poll` | Bearer `ADMIN_SECRET` | Manual poll trigger — fetches all repos immediately |

## Authentication

This connector authenticates to GitHub as a **GitHub App** (not a personal access token):

1. Signs a short-lived RS256 JWT with the app's private key (PKCS#8 PEM format)
2. Exchanges the JWT for an installation access token (valid ~1 hour)
3. Caches the token at module level with a 5-minute refresh buffer

The private key must be in **PKCS#8 format** (`-----BEGIN PRIVATE KEY-----`). If you download a PKCS#1 key from GitHub (`-----BEGIN RSA PRIVATE KEY-----`), convert it:

```bash
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in downloaded.pem -out pkcs8.pem
```

## Environment / Secrets

All secrets are set via `wrangler secret put <NAME>`:

| Name | Type | Description |
|------|------|-------------|
| `GITHUB_WEBHOOK_SECRET` | Secret | Random hex string for webhook signature verification |
| `GITHUB_APP_ID` | Secret | GitHub App ID (numeric, shown on app settings page) |
| `GITHUB_APP_PRIVATE_KEY` | Secret | PKCS#8 PEM private key (multi-line) |
| `GITHUB_INSTALLATION_ID` | Secret | Installation ID (from URL after installing the app) |
| `GITHUB_REPOS` | Secret | Comma-separated repos to poll, e.g. `org/repo1,org/repo2` |
| `ADMIN_SECRET` | Secret | Bearer token for the `/poll` admin endpoint |

## Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `EVENTS_QUEUE` | Queue producer | Publishes normalized events to `openchief-events` |
| `POLL_CURSOR` | KV namespace | Stores last-poll timestamp per repo |

## Setup

### Creating a GitHub App

1. Go to **GitHub org Settings → Developer settings → GitHub Apps → New GitHub App**
2. Set the **Webhook URL** to this worker's URL (e.g. `https://openchief-connector-github.your-team.workers.dev`)
3. Generate a **Webhook Secret** (`openssl rand -hex 20`) and enter it
4. **Repository permissions** (all Read-only): Commit statuses, Contents, Issues, Metadata, Pull requests
5. **Subscribe to events**: Create, Delete, Issue comment, Issues, Pull request, Pull request review, Push, Status
6. Select **"Only on this account"**, click Create
7. Note the **App ID** from the settings page
8. **Generate a private key** → download `.pem` → convert to PKCS#8
9. Click **Install App** → select your org → All repositories → Install
10. Note the **Installation ID** from the URL (the number at the end of `/settings/installations/{id}`)
11. Set all secrets via `wrangler secret put`

### Using Claude Code with Browser Automation

If you have Claude Code with the MCP Chrome extension, you can automate the entire GitHub App creation:

```
Create a new GitHub App for OpenChief on my organization. Navigate to GitHub →
Organization Settings → Developer Settings → GitHub Apps → New. Fill in the app
name, set the webhook URL to my GitHub connector worker URL, generate a webhook
secret, set repository permissions (Commit statuses, Contents, Issues, Pull
requests — all Read-only), subscribe to events (Create, Delete, Issue comment,
Issues, Pull request, Pull request review, Push, Status), select Only on this
account, create the app, generate a private key, install it on the org for all
repos, then convert the private key to PKCS#8 and set all the wrangler secrets
on the connector worker.
```

## Polling Details

- Fetches up to 5 pages per resource type (100 items/page)
- Payloads are slimmed before normalization to stay under queue message size limits (~128KB)
- Results are logged with counts per event type
- On first run for a repo, looks back 30 days; subsequent runs use KV cursor
- Parallelizes API calls across resource types (PRs, issues, commits, comments, workflow runs)
