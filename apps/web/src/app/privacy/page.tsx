import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — UniSi",
  description: "Privacy Policy for UniSi, operated by Sarzamin Technologies Corp.",
};

const GITHUB_URL = "https://github.com/sarzamin-technologies/unisi";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-10"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to UniSi
        </Link>

        <article className="prose prose-zinc dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-emerald-600 dark:prose-a:text-emerald-400">
          <h1>Privacy Policy</h1>
          <p className="lead">
            <strong>Effective Date:</strong> June 6, 2026<br />
            <strong>Data Controller:</strong> Sarzamin Technologies Corp<br />
            <strong>Contact:</strong>{" "}
            <a href="mailto:privacy@sarzamin.ca">privacy@sarzamin.ca</a><br />
            <strong>Address:</strong> Toronto, Ontario, Canada
          </p>

          <hr />

          <h2>1. Who We Are</h2>
          <p>
            UniSi is an electronic signature platform operated by{" "}
            <strong>Sarzamin Technologies Corp</strong> ("Sarzamin", "we", "us"), a corporation based in
            Toronto, Ontario, Canada. This Privacy Policy describes how we collect, use, disclose, and
            protect personal information when you use the Service.
          </p>

          <hr />

          <h2>2. Information We Collect</h2>

          <h3>2.1 Account Information</h3>
          <p>Collected when you create an account via Agnic OAuth:</p>
          <ul>
            <li>Name and email address (provided by Agnic)</li>
            <li>Agnic subject identifier (a unique, pseudonymous ID)</li>
            <li>Encrypted Agnic access and refresh tokens (AES-256-GCM, stored in our database)</li>
          </ul>

          <h3>2.2 Signer and Submission Data</h3>
          <p>Collected when a signer accesses a signing link:</p>
          <ul>
            <li>Email address (provided by the account owner)</li>
            <li>Display name (if provided by the account owner or the signer)</li>
            <li>IP address and browser user agent at the time of each signing action</li>
            <li>Timestamps of signing events (link opened, document signed, declined)</li>
            <li>Optional: Agnic identity if the signer opts into AI-assisted Q&amp;A features</li>
          </ul>

          <h3>2.3 Document Content</h3>
          <ul>
            <li>PDFs and attachments uploaded by account owners</li>
            <li>Form field values collected from signers during the signing process</li>
            <li>AI-extracted structured data from completed documents</li>
            <li>Signature images (drawn or typed by signers)</li>
          </ul>

          <h3>2.4 Audit Trail Data</h3>
          <ul>
            <li>Append-only log of all submission events</li>
            <li>SHA-256 hash chain linking each event to the previous (tamper evidence)</li>
            <li>Event payloads include type, timestamp, and submission metadata (not document content)</li>
          </ul>

          <h3>2.5 Technical Data</h3>
          <ul>
            <li>API access logs (endpoint, HTTP method, timestamp, response status)</li>
            <li>Error logs (stack traces without PII where possible)</li>
            <li>AI usage logs (model name, token counts, cost — no document content)</li>
          </ul>

          <hr />

          <h2>3. How We Use Your Information</h2>
          <table>
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Legal Basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Operating the Service (document processing, emails, audit trails)</td>
                <td>Contract performance</td>
              </tr>
              <tr>
                <td>Security (fraud detection, rate limiting, abuse prevention)</td>
                <td>Legitimate interest</td>
              </tr>
              <tr>
                <td>AI processing of document content</td>
                <td>Consent (per feature, at time of use)</td>
              </tr>
              <tr>
                <td>Sending signing invitation emails</td>
                <td>Contract performance / legitimate interest</td>
              </tr>
              <tr>
                <td>Legal compliance and record retention</td>
                <td>Legal obligation</td>
              </tr>
              <tr>
                <td>Partner commission attribution via Agnic</td>
                <td>Legitimate interest</td>
              </tr>
            </tbody>
          </table>
          <p>
            We do <strong>not</strong> sell, rent, or broker your personal information to third parties
            for marketing purposes.
          </p>

          <hr />

          <h2>4. Third-Party Sharing</h2>
          <p>
            We share personal data only with the following service providers to operate the Service:
          </p>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Data Shared</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Agnic</strong> (app.agnic.ai)</td>
                <td>Account identity, AI usage metadata, document content via AI calls</td>
                <td>OAuth login, AI gateway, wallet</td>
              </tr>
              <tr>
                <td><strong>Anthropic</strong> (via Agnic)</td>
                <td>Document images/text submitted for AI processing</td>
                <td>Claude model inference</td>
              </tr>
              <tr>
                <td><strong>Amazon Web Services / Cloudflare</strong></td>
                <td>Document files (PDFs, attachments)</td>
                <td>S3-compatible object storage</td>
              </tr>
              <tr>
                <td><strong>Resend</strong></td>
                <td>Signer email address, name, signing link</td>
                <td>Transactional email delivery</td>
              </tr>
            </tbody>
          </table>
          <p>
            All providers are bound by data processing contracts requiring them to protect data and use
            it only for specified purposes.
          </p>

          <hr />

          <h2>5. Data Retention</h2>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Retention Period</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Account information</td>
                <td>Until account deletion + 90 days</td>
              </tr>
              <tr>
                <td>Documents (templates, submissions, attachments)</td>
                <td>Until account deletion + 90 days</td>
              </tr>
              <tr>
                <td>Audit trails</td>
                <td>Until account deletion + 90 days</td>
              </tr>
              <tr>
                <td>AI usage logs</td>
                <td>12 months</td>
              </tr>
              <tr>
                <td>Server access logs</td>
                <td>90 days</td>
              </tr>
              <tr>
                <td>Encrypted backups</td>
                <td>30 days rolling</td>
              </tr>
            </tbody>
          </table>
          <p>
            Following account deletion, data may persist in encrypted backups for up to 30 days before
            permanent deletion.
          </p>

          <hr />

          <h2>6. Cookies and Session Data</h2>
          <p>
            UniSi uses <strong>httpOnly, AES-256 encrypted session cookies</strong> (iron-session) to
            maintain authentication state. These cookies cannot be read by JavaScript or browser
            extensions and are strictly necessary for the Service to function.
          </p>
          <p>Two separate cookies are used:</p>
          <ul>
            <li>
              <strong>Owner session:</strong> valid 90 days, tied to Agnic token lifetime
            </li>
            <li>
              <strong>Signer session:</strong> valid only for a specific signing session, isolated from
              the owner session
            </li>
          </ul>
          <p>
            We do <strong>not</strong> use tracking cookies, advertising cookies, or third-party
            analytics. No cookie consent banner is required for strictly necessary functional cookies
            under most privacy regulations.
          </p>

          <hr />

          <h2>7. Your Privacy Rights</h2>
          <table>
            <thead>
              <tr>
                <th>Right</th>
                <th>Who Has It</th>
                <th>How to Exercise</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Access your data</td>
                <td>All users</td>
                <td>Email privacy@sarzamin.ca</td>
              </tr>
              <tr>
                <td>Correct inaccurate data</td>
                <td>All users</td>
                <td>Email privacy@sarzamin.ca</td>
              </tr>
              <tr>
                <td>Delete your data</td>
                <td>All users (subject to legal retention)</td>
                <td>Settings or email privacy@sarzamin.ca</td>
              </tr>
              <tr>
                <td>Data portability</td>
                <td>All users</td>
                <td>Request export from Settings or by email</td>
              </tr>
              <tr>
                <td>Restrict / object to processing</td>
                <td>EU/UK users (GDPR Art. 18/21)</td>
                <td>Email privacy@sarzamin.ca</td>
              </tr>
              <tr>
                <td>Opt out of sale/sharing</td>
                <td>California users (CCPA/CPRA)</td>
                <td>We do not sell data</td>
              </tr>
              <tr>
                <td>Lodge a complaint</td>
                <td>EU/UK users</td>
                <td>Your national data protection authority</td>
              </tr>
            </tbody>
          </table>
          <p>
            <strong>Canadian users (PIPEDA/provincial):</strong> You have the right to access and correct
            your personal information. Contact{" "}
            <a href="mailto:privacy@sarzamin.ca">privacy@sarzamin.ca</a>.
          </p>
          <p>We will respond to rights requests within <strong>30 days</strong>.</p>

          <hr />

          <h2>8. Account Owners as Data Controllers</h2>
          <p>
            When you (as an account owner) upload documents containing personal data about third parties
            (including signers), you act as a <strong>data controller</strong> for that data. Sarzamin
            acts as a <strong>data processor</strong> on your behalf. You are responsible for:
          </p>
          <ul>
            <li>Having a lawful basis for collecting and processing signers' personal data</li>
            <li>Informing signers that their data will be processed by UniSi</li>
            <li>
              Ensuring your use of the Service complies with applicable data protection laws (GDPR, CCPA,
              PIPEDA, etc.)
            </li>
          </ul>
          <p>
            If you require a <strong>Data Processing Agreement (DPA)</strong> for GDPR compliance,
            contact <a href="mailto:privacy@sarzamin.ca">privacy@sarzamin.ca</a>.
          </p>

          <hr />

          <h2>9. International Data Transfers</h2>
          <p>
            Sarzamin is based in Canada, which is recognized by the European Commission as providing
            adequate data protection. Data may be transferred to and processed in the United States (AWS,
            Resend, Anthropic via Agnic). For US-based sub-processors, we rely on standard contractual
            clauses or applicable adequacy mechanisms.
          </p>

          <hr />

          <h2>10. Security Measures</h2>
          <p>We implement the following technical and organizational measures:</p>
          <ul>
            <li>AES-256-GCM encryption of Agnic tokens at rest</li>
            <li>HTTPS/TLS for all data in transit</li>
            <li>httpOnly encrypted session cookies (iron-session)</li>
            <li>HMAC-SHA256 signed webhooks</li>
            <li>SHA-256 hash-chained audit trails for tamper evidence</li>
            <li>S3 server-side encryption for stored documents</li>
            <li>API tokens stored as salted hashes (never in plaintext)</li>
          </ul>
          <p>
            No security system is perfect. In the event of a data breach materially affecting your
            rights, we will notify you as required by applicable law.
          </p>

          <hr />

          <h2>11. Children's Privacy</h2>
          <p>
            UniSi is not directed to individuals under the age of <strong>18</strong>. We do not
            knowingly collect personal information from minors. If you believe we have inadvertently
            collected such information, contact{" "}
            <a href="mailto:privacy@sarzamin.ca">privacy@sarzamin.ca</a> immediately.
          </p>

          <hr />

          <h2>12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. Material changes will be communicated by
            posting a notice on the Service and updating the Effective Date. Continued use after changes
            become effective constitutes acceptance.
          </p>

          <hr />

          <h2>13. Contact</h2>
          <p>
            <strong>Sarzamin Technologies Corp — Privacy</strong><br />
            Toronto, Ontario, Canada<br />
            <a href="mailto:privacy@sarzamin.ca">privacy@sarzamin.ca</a>{" "}
            ·{" "}
            <a href="https://www.sarzamin.ca" target="_blank" rel="noopener noreferrer">
              www.sarzamin.ca
            </a>
          </p>
        </article>

        <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-900 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100">Terms of Service</Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 dark:hover:text-zinc-100">Source Code (AGPL-3.0)</a>
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">Back to UniSi</Link>
        </div>
      </div>
    </div>
  );
}
