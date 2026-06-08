# Deploying UniSi (Railway + Neon + Upstash + R2 + Resend + Cloudflare DNS)

Target: `https://unisi.sarzamin.ca`. Two compute services on **Railway** (web + worker),
with all stateful pieces on free managed services.

| Piece | Service | Free tier |
|---|---|---|
| Web + Worker (compute) | **Railway** | usage-based (~$5/mo) |
| Postgres | **Neon** | ✅ |
| Redis (BullMQ) | **Upstash** | ✅ |
| Object storage (S3) | **Cloudflare R2** | ✅ |
| Email | **Resend** | ✅ |
| DNS / TLS | **Cloudflare** (or sarzamin.ca's DNS) | ✅ |

---

## 1. Provision the managed services (collect these values)

### Neon (Postgres)
1. Create a project at neon.tech.
2. Copy the **pooled** connection string → `DATABASE_URL`
   (`postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`).

### Upstash (Redis)
1. Create a Redis database at upstash.com.
2. Copy the **`rediss://…`** URL (TLS) → `REDIS_URL`.

### Cloudflare R2 (storage)
1. R2 → create a bucket (e.g. `unisi`).
2. Create an **R2 API token** (Object Read & Write). You get an Access Key ID + Secret.
3. Values:
   - `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `S3_REGION=auto`
   - `S3_BUCKET=unisi`
   - `S3_ACCESS_KEY_ID=…`
   - `S3_SECRET_ACCESS_KEY=…`
   - `S3_FORCE_PATH_STYLE=true`
4. Make the bucket's objects readable as needed (the app serves PDFs via its own
   slug-gated proxy, so the bucket can stay private).

### Resend (email)
The app sends mail over SMTP (nodemailer) using Resend's SMTP relay — there is
no Resend HTTP-API integration, so the `SMTP_*` vars below are what actually
drive email. Set them all.
1. Add + verify a sending domain (e.g. `mail.sarzamin.ca`) — add the DKIM records it shows.
2. Create an API key (used as the SMTP password).
3. Configure SMTP:
   - `SMTP_HOST=smtp.resend.com`
   - `SMTP_PORT=2587`  — Railway (and many hosts) block the standard SMTP
     ports 25/465/587. Resend's alternate STARTTLS port **2587** is not
     blocked and works with the app's transport (`secure` is off for 2587).
     Locally (Mailpit) this stays `1025`.
   - `SMTP_USER=resend`
   - `SMTP_PASS=<your Resend API key>`
   - `SMTP_FROM="UniSi <noreply@mail.sarzamin.ca>"`

### Agnic (production OAuth)
1. In the Agnic partner portal, register the redirect URI:
   `https://unisi.sarzamin.ca/api/auth/callback`
2. Collect: `AGNIC_OAUTH_CLIENT_ID`, `AGNIC_OAUTH_CLIENT_SECRET`, `AGNIC_PARTNER_ID`,
   `AGNIC_MERCHANT_ID`, `AGNIC_MERCHANT_WALLET`, `AGNIC_MERCHANT_FEE_PERCENT`.

### Generated for you
`certs/railway-secrets.env` (gitignored) already contains `SESSION_SECRET`,
`PLATFORM_SIGN_P12_PASSPHRASE`, and `PLATFORM_SIGN_P12_BASE64` (the dev signing cert).
Use those values. **For production trust, replace the dev cert with a real CA/org
cert later** (re-base64 it into `PLATFORM_SIGN_P12_BASE64`).

---

## 2. Create the Railway project + two services

1. `railway login` (or set a project token).
2. New project → **Deploy from GitHub repo** → pick `Alixocracy/UniSi`.
3. Create **two services** from the same repo:
   - **`web`** → Settings → *Config-as-code path* = `railway.web.json`
   - **`worker`** → Settings → *Config-as-code path* = `railway.worker.json`
   Both build from the root `Dockerfile`; the start command differs (already in the JSONs).
4. **worker**: no public domain/port (it's a background consumer) — don't add a domain.
5. **web → Settings → Resources**: ~0.5–1 GB RAM. **worker**: **~1 GB** (PDF rendering can spike).

---

## 3. Set environment variables (BOTH services unless noted)

Set these on **web** and **worker** (Railway shared variables, or per service).
`NEXT_PUBLIC_*` are also consumed at **build time** (Railway passes them as Docker build args).

```
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://unisi.sarzamin.ca

# from certs/railway-secrets.env
SESSION_SECRET=…
PLATFORM_SIGN_P12_BASE64=…
PLATFORM_SIGN_P12_PASSPHRASE=changeit

# Neon
DATABASE_URL=…
PGPOOL_MAX=5

# Upstash
REDIS_URL=rediss://…

# Cloudflare R2
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=unisi
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_FORCE_PATH_STYLE=true

# Resend (SMTP relay — these drive email, not an API key)
# Port 2587: Railway blocks standard SMTP ports (25/465/587); 2587 is Resend's
# alternate STARTTLS port and is not blocked.
SMTP_HOST=smtp.resend.com
SMTP_PORT=2587
SMTP_USER=resend
SMTP_PASS=<your Resend API key>
SMTP_FROM=UniSi <noreply@mail.sarzamin.ca>

# Agnic
AGNIC_API_BASE=https://api.agnic.ai
NEXT_PUBLIC_AGNIC_AUTH_URL=https://app.agnic.ai
NEXT_PUBLIC_AGNIC_TOPUP_URL=https://app.agnic.ai/topup
AGNIC_OAUTH_CLIENT_ID=…
NEXT_PUBLIC_AGNIC_OAUTH_CLIENT_ID=…   # same value as AGNIC_OAUTH_CLIENT_ID
AGNIC_OAUTH_CLIENT_SECRET=…
AGNIC_PARTNER_ID=…
AGNIC_MERCHANT_ID=…
AGNIC_MERCHANT_WALLET=…
AGNIC_MERCHANT_FEE_PERCENT=20
```

> The worker doesn't need the `NEXT_PUBLIC_*` build args, but setting the same
> variables on both services is simplest. `SESSION_SECRET`, `DATABASE_URL`,
> `REDIS_URL`, S3, Agnic, and `PLATFORM_SIGN_*` are required by **both**.

---

## 4. Deploy

- Pushing to the deploy branch (or `railway up`) builds the image and deploys.
- The **web** service runs `pnpm db:migrate` as its **pre-deploy** step (configured in
  `railway.web.json`) before the new version goes live.
- Watch logs: web should print `▲ Next.js … Ready`; worker should print
  `UniSi worker started, queues: …`.

---

## 5. Domain + TLS (`unisi.sarzamin.ca`)

1. Railway → **web** service → Settings → Networking → **Custom Domain** →
   add `unisi.sarzamin.ca`. Railway shows a **CNAME target** (e.g. `xxx.up.railway.app`).
2. In the DNS for `sarzamin.ca` (Cloudflare or registrar): add
   `CNAME  unisi  →  <that target>`. If using Cloudflare, set the record to
   **DNS-only (grey cloud)** first so Railway can issue the cert, then you may proxy it.
3. Railway auto-provisions TLS once DNS resolves.

---

## 6. Post-deploy checklist
- [ ] `https://unisi.sarzamin.ca` loads; sign-in redirects to Agnic.
- [ ] Agnic OAuth round-trips (redirect URI registered, `NEXT_PUBLIC_APP_URL` correct).
- [ ] Create a template + send a test signing (email arrives via Resend).
- [ ] Complete signing → worker stamps the PDF + produces a **signed** audit trail.
- [ ] `/verify` validates that trail (signature valid + matches platform cert).
- [ ] `/docs/api` renders.

## Notes
- **Worker RAM:** if you see OOM/restarts during field-detection or stamping, raise the
  worker to ~1.5–2 GB.
- **Production cert:** the dev cert is self-signed — Acrobat will say "signer unknown".
  Swap in a CA/org `.p12` (re-base64 → `PLATFORM_SIGN_P12_BASE64`) when ready.
- **Cheaper later:** the only always-on cost is the worker. Porting its jobs to a
  serverless queue would push compute toward $0 (code change, optional).
