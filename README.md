# UniSi

**AI-native digital signature platform.** Send documents for signing, auto-detect and place fields with AI, draft complete templates from a prompt, and verify every completed document against a tamper-evident audit trail.

Built with TypeScript/Node, powered by [Agnic](https://app.agnic.ai) for authentication, AI gateway, and prepaid wallet billing — no Stripe integration, no API key management, no per-seat pricing infrastructure.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)

---

## Features

- **AI template drafting** — describe a document in plain language; UniSi generates the full text, places signing fields, and assigns signer roles automatically.
- **AI field detection** — upload any PDF and let Claude vision locate every signature line, date, name, and checkbox. Review and adjust, then send.
- **AI assistant** — a chat panel inside the template editor lets you ask questions about the document or request edits. For AI-drafted templates it can rewrite and re-render the PDF inline. For uploaded PDFs it suggests missing fields based on document type.
- **Markdown tables in PDFs** — AI-drafted templates support full markdown (headings, lists, blockquotes, tables) rendered to a clean PDF.
- **Electronic signatures** — canvas-based signature capture with stroke smoothing; fields for signature, initials, date, text, number, email, phone, and checkbox.
- **Audit trail** — every action (send, open, sign, complete) is recorded in an append-only SHA-256 hash chain. Completed documents carry an embedded certificate page and a PAdES-level PDF digital signature.
- **Audit verification** — the `/verify` page lets anyone upload a completed document and independently verify the chain of custody.
- **Webhooks** — `submission.created`, `submitter.signed`, and `submission.completed` events with HMAC-SHA256 signatures and automatic retry.
- **Structured extraction** — completed submissions return a clean JSON payload of all collected field values in the `submission.completed` webhook.
- **Embedding** — drop a signing form into any page with one HTML tag.
- **REST API** — full CRUD over templates and submissions via bearer-token API.
- **Google Docs import** — import a public Google Doc as a template with one API call.
- **Terms & Conditions gate** — first-time users must accept terms before accessing the platform.
- **Zero billing infrastructure** — AI usage is charged from each user's Agnic wallet; the platform earns commission on every AI call via the Agnic Partner Program.

---

## Tech stack

| Layer | Choice |
|---|---|
| Web app | Next.js 14 (App Router) — UI + API routes |
| Background jobs | Node process with BullMQ (PDF stamping, AI detection, emails, webhooks) |
| Database | PostgreSQL + Drizzle ORM |
| Queue | BullMQ on Redis |
| Object storage | S3-compatible (MinIO locally, Cloudflare R2 / AWS S3 in production) |
| PDF rendering | `pdfjs-dist` (page → image) + `pdf-lib` (stamp, sign, flatten) |
| Auth | Agnic OAuth 2.0 PKCE via `iron-session` (httpOnly cookie) |
| AI | OpenAI SDK pointed at `api.agnic.ai/v1` (charged from user's wallet) |
| Email | Resend (Mailpit for local development) |
| Monorepo | pnpm workspaces + Turborepo |

---

## Local development

### Prerequisites

- Node 20+ (`nvm use`)
- pnpm 9+ (`corepack enable`)
- Docker (for local infrastructure)
- An Agnic OAuth client ID — register at [app.agnic.ai/oauth-clients](https://app.agnic.ai/oauth-clients)

### Setup

```bash
# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env
# Required: SESSION_SECRET, AGNIC_OAUTH_CLIENT_ID
# Generate a session secret:  openssl rand -hex 32

# Start local infrastructure (Postgres, Redis, MinIO, Mailpit)
pnpm infra:up

# Run database migrations
pnpm db:migrate

# Start the web app and worker in parallel
pnpm dev
```

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Mailpit (email) | http://localhost:8025 |
| MinIO (storage) | http://localhost:9001 — credentials: `unisi` / `unisi-secret-key` |

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | ✅ | 64-char hex string — encrypts session cookies and DB tokens |
| `AGNIC_OAUTH_CLIENT_ID` | ✅ | Your Agnic OAuth client ID (`app_…`) |
| `NEXT_PUBLIC_AGNIC_OAUTH_CLIENT_ID` | ✅ | Same value, exposed to the browser for the top-up popup |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public origin, e.g. `http://localhost:3000` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `S3_ENDPOINT` | ✅ | Object storage endpoint |
| `S3_BUCKET` | ✅ | Bucket name |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | ✅ | Storage credentials |
| `AGNIC_PARTNER_ID` | recommended | Partner ID for commission attribution |
| `AGNIC_MERCHANT_ID` / `AGNIC_MERCHANT_WALLET` / `AGNIC_MERCHANT_FEE_PERCENT` | optional | Merchant fee collection |
| `RESEND_API_KEY` | optional | Email delivery (uses Mailpit without it) |
| `SMTP_FROM` | optional | Sender address for outgoing email |
| `PLATFORM_SIGN_P12_PATH` / `PLATFORM_SIGN_P12_BASE64` / `PLATFORM_SIGN_P12_PASSPHRASE` | optional | Platform signing certificate for PAdES audit trail |

---

## Repository layout

```
apps/
├── web/          Next.js 14 — UI + API route handlers
└── worker/       BullMQ consumer — PDF stamping, AI jobs, email, webhooks
packages/
├── db/           Drizzle schema + migrations
├── agnic/        OAuth flow, iron-session helpers, token persistence, balance
├── ai/           Agnic gateway wrappers (draftTemplate, detectFields, extractStructured, chat)
├── pdf/          PDF read, markdown-to-PDF render, stamp, flatten, PAdES signing
├── audit/        Append-only audit trail with SHA-256 hash chain
├── storage/      S3-compatible blob layer with SHA-256 dedup + presigned URLs
├── shared/       Zod schemas, field coordinate utilities
└── ui/           Shared React components (LoginGate, PdfPages, BalanceDisplay, …)
```

---

## API

**Full reference:** [docs/API.md](docs/API.md)

Create an API token at **Settings → API tokens**. Pass it as:

```
Authorization: Bearer unisi_…
```

### Quick examples

```bash
# List templates
curl -H "Authorization: Bearer $TOKEN" $APP/api/templates

# Upload a PDF as a template
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F file=@contract.pdf -F name="Service Agreement" \
  $APP/api/templates

# Import a Google Doc
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://docs.google.com/document/d/.../edit"}' \
  $APP/api/templates/import-gdoc

# Create a submission (send for signing)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"templateId":"<id>","submitters":[{"role":"Signer","email":"jane@example.com","name":"Jane Smith"}]}' \
  $APP/api/submissions

# List submissions
curl -H "Authorization: Bearer $TOKEN" $APP/api/submissions
```

> **Note:** AI actions (`templates/generate`, `templates/:id/detect-fields`) and account management (`tokens`, `webhooks`) are dashboard-only and do not accept API tokens.

---

## Webhooks

Configure endpoints and subscribed events at **Settings → Webhooks**.

Every delivery includes:

```
X-UniSi-Event: submission.completed
X-UniSi-Signature: t=1714080000,v1=<hex hmac-sha256>
X-UniSi-Delivery: <delivery-uuid>
```

Verify with `hmac_sha256(secret, "${t}.${rawBody}")`.

### Events

| Event | Fired when |
|---|---|
| `submission.created` | A submission is created and invitations are sent |
| `submitter.signed` | An individual signer completes their fields |
| `submission.completed` | All signers have signed; includes `completed_document_ids` and `extracted_data` (AI-structured field values) |

---

## Embedding

Embed a signing form into any page:

```html
<unisi-form slug="abc123"></unisi-form>
<script src="https://your-unisi.example/embed.js" defer></script>
```

The form renders inside a sandboxed iframe and posts completion events to the parent window.

---

## Deployment

See **[DEPLOY.md](./DEPLOY.md)** for a complete guide to deploying on Railway with Neon (Postgres), Upstash (Redis), Cloudflare R2 (storage), and Resend (email).

For alternative stacks: the web app and worker are standard Node processes. Any platform that can run a Next.js app and a Node worker alongside Postgres, Redis, and an S3-compatible store will work.

---

## Audit trail & verification

Every completed submission produces a tamper-evident record:

1. Each action (send, open, sign) is recorded as an event with a rolling SHA-256 hash — each event commits the previous hash, making any tampering detectable.
2. The completed PDF is appended with a certificate page summarising the audit chain.
3. A PAdES-level digital signature is applied to the final PDF with the platform's signing certificate.

Anyone can verify a completed document at `/verify` — upload the PDF and UniSi independently checks the signature and hash chain without requiring an account.

---

## Contributing

UniSi is open-source under AGPL-3.0. Contributions are welcome — please open an issue before submitting a large PR.

```bash
pnpm typecheck   # TypeScript across all packages
pnpm lint        # ESLint
pnpm test        # Vitest unit tests
```

---

## License

[AGPL-3.0-or-later](./LICENSE) © [Sarzamin Technologies Corp](https://sarzamin.ca)

This means if you modify UniSi and make it available over a network, you must make your modified source available under the same license. See [TERMS.md](./TERMS.md) and [PRIVACY.md](./PRIVACY.md) for the hosted service terms.

---

*Powered by [Agnic](https://app.agnic.ai) — login, AI gateway, and prepaid wallet in one. See [docs/agnic-integration.md](docs/agnic-integration.md) for a full integration walkthrough.*
