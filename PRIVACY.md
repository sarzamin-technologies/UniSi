# Privacy Policy — UniSi

**Effective Date:** June 6, 2026
**Data Controller:** Sarzamin Technologies Corp
**Contact:** privacy@sarzamin.ca | https://www.sarzamin.ca
**Address:** Toronto, Ontario, Canada

---

## 1. Who We Are

UniSi is an electronic signature platform operated by **Sarzamin Technologies Corp** ("Sarzamin", "we", "us"), a corporation based in Toronto, Ontario, Canada. This Privacy Policy describes how we collect, use, disclose, and protect personal information when you use the Service.

---

## 2. Information We Collect

### 2.1 Account Information
Collected when you create an account via Agnic OAuth:
- Name and email address (provided by Agnic)
- Agnic subject identifier (a unique, pseudonymous ID)
- Encrypted Agnic access and refresh tokens (AES-256-GCM, stored in our database)

### 2.2 Signer and Submission Data
Collected when a signer accesses and uses a signing link:
- Email address (provided by the account owner)
- Display name (if provided by the account owner or the signer)
- IP address and browser user agent at the time of each signing action
- Timestamps of signing events (link opened, document signed, declined)
- Optional: Agnic identity if the signer opts into AI-assisted Q&A features

### 2.3 Document Content
- PDFs and attachments uploaded by account owners
- Form field values collected from signers during the signing process
- AI-extracted structured data from completed documents
- Signature images (drawn or typed by signers)

### 2.4 Audit Trail Data
- Append-only log of all submission events
- SHA-256 hash chain linking each event to the previous
- Event payloads include type, timestamp, and submission metadata (not document content)

### 2.5 Technical Data
- API access logs (endpoint, HTTP method, timestamp, response status)
- Error logs (stack traces without PII where possible)
- AI usage logs (model name, token counts, cost in USD, timestamp — no document content)

---

## 3. How We Use Your Information

| Purpose | Legal Basis |
|---|---|
| Operating the Service (document processing, email dispatch, audit trails) | Contract performance |
| Security (fraud detection, rate limiting, abuse prevention) | Legitimate interest |
| AI processing of document content (field detection, drafting, extraction, Q&A) | Consent (per feature, at time of use) |
| Sending signing invitation emails on behalf of account owners | Contract performance / legitimate interest |
| Legal compliance and record retention | Legal obligation |
| Partner commission attribution via Agnic | Legitimate interest |

We do **not** sell, rent, or broker your personal information to third parties for marketing purposes.

---

## 4. Third-Party Sharing

We share personal data only with the following service providers to operate the Service:

| Provider | Data Shared | Purpose |
|---|---|---|
| **Agnic** (app.agnic.ai) | Account identity, AI usage metadata, document content via AI calls | OAuth login, AI gateway, wallet |
| **Anthropic** (via Agnic) | Document images/text submitted for AI processing | Claude model inference |
| **Amazon Web Services / Cloudflare** | Document files (PDFs, attachments) | S3-compatible object storage |
| **Resend** | Signer email address, name, signing link | Transactional email delivery |

All providers are bound by data processing contracts requiring them to protect data and use it only for specified purposes.

---

## 5. Data Retention

| Category | Retention Period |
|---|---|
| Account information | Until account deletion + 90 days |
| Documents (templates, submissions, attachments) | Until account deletion + 90 days |
| Audit trails | Until account deletion + 90 days |
| AI usage logs | 12 months |
| Server access logs | 90 days |
| Encrypted backups | 30 days rolling |

Following account deletion, data may persist in encrypted backups for up to 30 days before being permanently deleted.

---

## 6. Cookies and Session Data

UniSi uses **httpOnly, AES-256 encrypted session cookies** (iron-session) to maintain authentication state. These cookies:
- Cannot be read by JavaScript or browser extensions
- Are not accessible to third-party scripts
- Are strictly necessary for the Service to function

Two separate cookies are used:
- **Owner session**: valid 90 days, scoped to the account owner and tied to Agnic token lifetime
- **Signer session**: valid only for the duration of a specific signing session, isolated from the owner session

We do **not** use tracking cookies, advertising cookies, or third-party analytics. No cookie consent banner is legally required for strictly necessary functional cookies under most privacy regulations.

---

## 7. Your Privacy Rights

Depending on your jurisdiction, you may have the following rights:

| Right | Who Has It | How to Exercise |
|---|---|---|
| Access your data | All users | Email privacy@sarzamin.ca |
| Correct inaccurate data | All users | Email privacy@sarzamin.ca |
| Delete your data ("right to erasure") | All users (subject to legal retention) | Email privacy@sarzamin.ca or delete account in Settings |
| Data portability | All users | Request export from Settings or by email |
| Restrict or object to processing | EU/UK users (GDPR Art. 18/21) | Email privacy@sarzamin.ca |
| Opt out of sale/sharing | California users (CCPA/CPRA) | We do not sell data |
| Lodge a complaint | EU/UK users | Your national data protection authority |

**Canadian users (PIPEDA/provincial privacy laws)**: You have the right to access and correct your personal information. Contact privacy@sarzamin.ca.

We will respond to rights requests within **30 days**.

---

## 8. Account Owners as Data Controllers

When you (as an account owner) upload documents containing personal data about third parties (including signers), you act as a **data controller** for that data. Sarzamin acts as a **data processor** on your behalf. You are responsible for:
- Having a lawful basis for collecting and processing signers' personal data
- Informing signers that their data will be processed by UniSi
- Ensuring your use of the Service complies with applicable data protection laws (GDPR, CCPA, PIPEDA, etc.)

If you require a **Data Processing Agreement (DPA)** for GDPR compliance, contact privacy@sarzamin.ca.

---

## 9. International Data Transfers

Sarzamin is based in Canada. Data may be transferred to and processed in the United States (AWS, Resend, Anthropic via Agnic). Canada has been recognized as providing adequate data protection by the European Commission. For transfers to the US via our sub-processors, we rely on standard contractual clauses or applicable adequacy mechanisms.

---

## 10. Security Measures

We implement the following technical and organizational measures:
- AES-256-GCM encryption of Agnic tokens at rest
- HTTPS/TLS for all data in transit
- httpOnly encrypted session cookies (iron-session)
- HMAC-SHA256 signed webhooks
- SHA-256 hash-chained audit trails for tamper evidence
- S3 server-side encryption for stored documents
- API tokens stored as salted hashes (never in plaintext)
- Database-level advisory locks to prevent audit trail corruption

No security system is perfect. In the event of a data breach materially affecting your rights and freedoms, we will notify you as required by applicable law.

---

## 11. Children's Privacy

UniSi is not directed to individuals under the age of **18**. We do not knowingly collect personal information from minors. If you believe we have inadvertently collected such information, contact privacy@sarzamin.ca immediately.

---

## 12. Changes to This Policy

We may update this Privacy Policy periodically. Material changes will be communicated by posting a notice on the Service and updating the Effective Date above. Continued use after changes become effective constitutes acceptance of the updated policy.

---

## 13. Contact

**Sarzamin Technologies Corp — Privacy**
Toronto, Ontario, Canada
privacy@sarzamin.ca | https://www.sarzamin.ca
