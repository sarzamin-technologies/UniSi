# UniSi API Reference

Complete reference for every UniSi HTTP endpoint.

- **Base URL:** your deployment origin, e.g. `https://your-host` (local dev: `http://localhost:3000`).
- **Content type:** JSON unless noted (file uploads use `multipart/form-data`).
- **IDs:** UUID v4. **Timestamps:** ISO 8601 UTC strings.

---

## Authentication

Two mechanisms:

| Mechanism | How | Use |
|---|---|---|
| **API token** | `Authorization: Bearer unisi_…` | Programmatic / server-to-server |
| **Session cookie** | Agnic OAuth login in the browser | The dashboard UI |

Create a token in **Settings → API tokens**. It's shown once; store it securely (server-side only).

> **Important:** API tokens work **only** on the endpoints marked **Token ✅** below.
> A handful of endpoints are **session-only** (Token ❌) — they require the browser login and
> cannot be called with a Bearer token: `templates/generate`, `templates/{id}/detect-fields`,
> and all of `tokens` and `webhooks`. (Manage those from the dashboard.)

### Errors

All errors return JSON `{ "error": "<code-or-message>" }`, sometimes with an `issues` array
(Zod validation detail). Common statuses:

| Status | Meaning |
|---|---|
| 400 | Invalid body / parameters |
| 401 | Missing/invalid auth (`unauthenticated`, `invalid_token`) |
| 404 | Not found (or not owned by your account) |
| 409 | Conflict (e.g. already completed) |
| 413 | Payload too large (25 MB cap on uploads) |
| 415 | Unsupported media type (non-PDF upload) |
| 422 | Unprocessable (e.g. unreadable PDF, doc not public) |
| 402 | Insufficient Agnic wallet balance (AI calls) |
| 502 | Upstream fetch failed |

---

## Templates

### `GET /api/templates` — Token ✅
List your templates (max 100, newest first).
```json
{ "templates": [
  { "id": "uuid", "name": "NDA", "createdAt": "…", "updatedAt": "…",
    "documents": [ … ], "fields": [ … ] }
] }
```

### `POST /api/templates` — Token ✅
Upload a PDF as a new template. **`multipart/form-data`:**
- `file` — the PDF (required, `application/pdf`, ≤ 25 MB)
- `name` — optional display name (defaults to the filename)

→ `201 { "template": { … } }`. Creates one document + a default `Signer` role.

### `POST /api/templates/import-gdoc` — Token ✅
Import a **publicly shared** Google Doc as a template (exported to PDF server-side).
```json
{ "url": "https://docs.google.com/document/d/…/edit", "name": "optional" }
```
→ `201 { "template": { … } }`. `422` if the doc isn't shared "Anyone with the link".

### `POST /api/templates/generate` — Token ❌ (session only)
AI-draft a template from a prompt. Returns immediately; a worker fills it in.
```json
{ "prompt": "A mutual NDA between …", "name": "optional" }
```
→ `202 { "template": { "id": "…", … } }` (poll `GET /api/templates/{id}` until `documents` is populated). Billed to your Agnic wallet.

### `GET /api/templates/{id}` — Token ✅
→ `{ "template": { …full row… } }` (includes `fields`, `submitterRoles`, `documents`).

### `PATCH /api/templates/{id}` — Token ✅
Update name / fields / roles. All optional:
```json
{
  "name": "string",
  "fields": [ Field, … ],
  "submitterRoles": [ { "name": "Signer", "order": 0 }, … ]
}
```
→ `{ "template": { … } }`. See [Field object](#field-object).

### `DELETE /api/templates/{id}` — Token ✅
→ `{ "ok": true }`.

### `POST /api/templates/{id}/regenerate` — Token ✅
Re-render an AI template's PDF from edited markdown (re-places fields).
```json
{ "bodyMarkdown": "…", "title": "optional" }
```
→ `{ "template": { … } }`.

### `POST /api/templates/{id}/detect-fields` — Token ❌ (session only)
Queue AI vision field-detection. Body: `{ "replace": true }` (replace existing) or `{ "replace": false }` (append).
→ `202 { "jobId": "…" }` (a worker runs it; poll the template). Billed to your wallet.

---

## Submissions

### `GET /api/submissions` — Token ✅
List submissions (max 100, newest first).
```json
{ "submissions": [
  { "id": "uuid", "status": "pending|completed|…", "templateId": "uuid",
    "createdAt": "…", "completedAt": null }
] }
```

### `POST /api/submissions` — Token ✅
Send a template for signing. One entry per signer role; an invite email goes to each.
```json
{
  "templateId": "uuid",
  "submitters": [
    { "role": "Signer", "email": "jane@acme.com", "name": "Jane" }
  ]
}
```
→ `201 { "submission": { … } }`. `400` if any email is invalid.

### `GET /api/submissions/{id}` — Token ✅
→ `{ "submission": { … }, "submitters": [ { id, role, email, name, status, … } ] }`.

### `GET /api/submissions/{id}/documents` — Token ✅
Available once `completed`.
```json
{
  "documents": [ { "id": "uuid", "filename": "signed-….pdf", "url": "/api/attachments/{id}/file" } ],
  "auditTrail": [ { "id": "uuid", "filename": "audit-trail-….pdf",
                    "url": "/api/attachments/{id}/file", "signed": true } ]
}
```

---

## Attachments

### `GET /api/attachments/{id}` — Token ✅
→ `{ "url": "/api/attachments/{id}/file" }` (a same-origin streaming URL).

### `GET /api/attachments/{id}/file` — Token ✅
Streams the raw PDF bytes (`application/pdf`).

---

## Verification (public, no auth)

### `POST /api/verify`
Verify an audit-trail certificate and (optionally) that a signed PDF matches it.
**`multipart/form-data`:**
- `auditTrail` — the audit-trail PDF (required)
- `document` — the signed PDF (optional, to check the hash)

```json
{
  "document": { "filename": "…", "sha256": "…", "matches": true },
  "trail": {
    "signaturePresent": true, "signatureValid": true,
    "signerSubject": "CN=UniSi Platform, …", "matchesPlatformCert": true,
    "submissionId": "…", "chainHash": "…",
    "documents": [ { "sha256": "…" } ],
    "signers": [ { "name": "…", "email": "…", "signedAt": "…", "ip": "…" } ]
  }
}
```

---

## Signing (public, slug-gated)

These power the signer's experience; the `slug` is the per-signer token in the invite link.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/sign/{slug}` | Load signer state, fields, document URLs (marks "opened" on first call) |
| `POST` | `/api/sign/{slug}/submit` | Submit field values & complete signing |
| `GET` | `/api/sign/{slug}/files/{attachmentId}` | Stream a document PDF for this signer |
| `POST` | `/api/sign/{slug}/ask` | Signer Q&A (requires signer Agnic login; billed to **signer's** wallet) |
| `GET`/`DELETE` | `/api/sign/{slug}/agnic/session` | Signer's Agnic session state / sign out |
| `GET` | `/api/sign/{slug}/agnic/login` | Begin signer Agnic OAuth |

**`POST /api/sign/{slug}/submit`** body:
```json
{ "values": { "<fieldId>": "text value" | true | { "dataUrl": "data:image/png;base64,…" } } }
```
→ `{ … }`. `409 already_completed` if re-submitted. Signature/initials fields take the `dataUrl` PNG; checkboxes take a boolean; everything else a string.

**`POST /api/sign/{slug}/ask`** body: `{ "question": "…", "model": "optional-slug" }`. `402` if the signer's wallet is out of funds.

---

## Account & session (session only, dashboard)

These require the browser session — **not** usable with an API token.

### API tokens
| Method | Path | Body / Result |
|---|---|---|
| `GET` | `/api/tokens` | `{ "tokens": [ { id, name, createdAt, lastUsedAt } ] }` |
| `POST` | `/api/tokens` | `{ "name": "CI deploy" }` → `201 { "token": { "id": "…", "plaintext": "unisi_…" } }` (shown once) |
| `DELETE` | `/api/tokens/{id}` | `{ "ok": true }` — breaks anything using it immediately |

### Webhooks
| Method | Path | Body / Result |
|---|---|---|
| `GET` | `/api/webhooks` | `{ "endpoints": [ { id, url, events, active, createdAt } ] }` |
| `POST` | `/api/webhooks` | `{ "url": "https://…", "events": ["submission.completed", …] }` → `201 { "endpoint": {…}, "secret": "whsec_…" }` (shown once) |
| `DELETE` | `/api/webhooks/{id}` | `{ "ok": true }` |

See [Webhooks](#webhooks-1) below for delivery format.

### Other
| Method | Path | Result |
|---|---|---|
| `GET` | `/api/balance` | `{ "balance": <number> }` — Agnic wallet (USDC) |
| `GET` | `/api/session` | `{ "authenticated": true, … }` |
| `DELETE` | `/api/session` | Sign out → `{ "ok": true }` |
| `GET` | `/api/auth/login` · `/api/auth/callback` · `/api/auth/login-popup` · `/api/auth/popup-callback` · `/api/auth/signer-callback` | Agnic OAuth (PKCE) browser flow — not called directly |

---

## Webhooks

When a subscribed event occurs, UniSi `POST`s JSON to your endpoint URL.

**Events:** `submission.created`, `submitter.opened`, `submitter.signed`, `submission.completed`.

**Headers:**
- `X-UniSi-Event` — the event name
- `X-UniSi-Delivery` — unique delivery id (use to dedupe retries)
- `X-UniSi-Signature` — `t=<unix_ts>,v1=<hmac_sha256>`

**Body envelope:**
```json
{
  "event": "submission.completed",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "data": {
    "submission": { "id": "…", "status": "completed", "template_id": "…",
                    "created_at": "…", "completed_at": "…" },
    "submitters": [ { "id": "…", "role": "Signer", "email": "…", "name": "…",
                      "status": "completed", "completed_at": "…" } ]
  }
}
```

**Verify the signature** (Node) — HMAC over `` `${t}.${rawBody}` `` using the endpoint secret; use the **raw** body:
```js
import crypto from "node:crypto";
function verify(rawBody, header, secret) {
  const p = Object.fromEntries(header.split(",").map((kv) => kv.split("=")));
  const expected = crypto.createHmac("sha256", secret).update(`${p.t}.${rawBody}`).digest("hex");
  const ok = p.v1.length === expected.length &&
             crypto.timingSafeEqual(Buffer.from(p.v1), Buffer.from(expected));
  return ok && Math.abs(Date.now() / 1000 - Number(p.t)) < 300; // 5-min window
}
```
Respond `2xx` to acknowledge; non-2xx/timeouts are retried with backoff.

---

## Object shapes

### Field object
Coordinates are normalized `[0,1]`, top-left origin.
```json
{
  "id": "uuid",
  "type": "text|signature|initials|date|checkbox|number|email|phone|image|attachment",
  "pageIndex": 0,
  "x": 0.12, "y": 0.34, "w": 0.2, "h": 0.04,
  "required": true,
  "submitterRole": "Signer",
  "label": "optional",
  "defaultValue": "optional"
}
```

### Submitter role
```json
{ "name": "Signer", "order": 0 }
```

---

## Quick start (cURL)

```bash
HOST=https://your-host
TOKEN=unisi_xxx

# 1. List templates
curl $HOST/api/templates -H "Authorization: Bearer $TOKEN"

# 2. Send one for signing
curl -X POST $HOST/api/submissions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"templateId":"TEMPLATE_UUID","submitters":[{"role":"Signer","email":"jane@acme.com","name":"Jane"}]}'

# 3. After completion, fetch signed docs + audit trail
curl $HOST/api/submissions/SUBMISSION_UUID/documents -H "Authorization: Bearer $TOKEN"
```
