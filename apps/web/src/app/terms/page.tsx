import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — UniSi",
  description: "Terms of Service for UniSi, operated by Sarzamin Technologies Corp.",
};

const GITHUB_URL = "https://github.com/sarzamin-technologies/unisi";

export default function TermsPage() {
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
          <h1>Terms of Service</h1>
          <p className="lead">
            <strong>Effective Date:</strong> June 6, 2026<br />
            <strong>Service Provider:</strong> Sarzamin Technologies Corp<br />
            <strong>Contact:</strong>{" "}
            <a href="mailto:legal@sarzamin.ca">legal@sarzamin.ca</a><br />
            <strong>Address:</strong> Toronto, Ontario, Canada
          </p>

          <hr />

          <h2>1. Agreement to Terms</h2>
          <p>
            By accessing or using UniSi, creating an account, uploading documents, or inviting signers,
            you ("User", "you") agree to be bound by these Terms of Service ("Terms"). If you do not
            agree, do not use the Service.
          </p>
          <p>
            These Terms apply to all users: account owners (document senders), signers (recipients
            invited to sign), and developers accessing the API.
          </p>

          <hr />

          <h2>2. Open Source Software — AGPL-3.0</h2>
          <p>
            UniSi is <strong>free and open-source software</strong> published under the{" "}
            <strong>GNU Affero General Public License v3.0 or later</strong> (AGPL-3.0-or-later). The
            complete source code is available at:{" "}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              {GITHUB_URL}
            </a>
          </p>
          <p>
            The AGPL-3.0 license governs your rights to copy, modify, and distribute the software. These
            Terms of Service govern your use of the <em>hosted platform</em> operated by Sarzamin
            Technologies Corp and are separate from the software license.
          </p>
          <p>
            <strong>The software is provided "AS IS", without warranty of any kind.</strong> See Section
            10 for the full disclaimer.
          </p>
          <p>
            If you self-host or modify UniSi, AGPL-3.0 requires that you make the complete corresponding
            source code available to your users at no charge, and that any modified version you deploy
            publicly is also released under AGPL-3.0.
          </p>

          <hr />

          <h2>3. Description of the Service</h2>
          <p>UniSi is an AI-assisted electronic signature platform that enables users to:</p>
          <ul>
            <li>Upload or AI-generate PDF documents for signature</li>
            <li>Auto-detect signature fields using AI vision models</li>
            <li>Invite recipients to review and electronically sign documents</li>
            <li>Generate tamper-evident audit trails and completed PDF packages</li>
            <li>Conduct AI-powered document Q&amp;A during the signing process</li>
            <li>Access functionality via REST API, webhooks, or embeddable web component</li>
          </ul>
          <p>
            AI features are provided through <strong>Agnic</strong> (app.agnic.ai), a third-party
            platform operated independently of Sarzamin.
          </p>

          <hr />

          <h2>4. Electronic Signatures — Legal Disclaimer</h2>
          <p>
            <strong>READ CAREFULLY. SARZAMIN PROVIDES TOOLING, NOT LEGAL ADVICE.</strong>
          </p>
          <p>
            UniSi facilitates <strong>Simple Electronic Signatures (SES)</strong> — a digital
            representation of intent to sign. Sarzamin makes <strong>no representation or warranty</strong>{" "}
            regarding:
          </p>
          <ol>
            <li>
              <strong>Legal enforceability.</strong> The legal validity of electronic signatures varies
              by jurisdiction, document type, and applicable law. Electronic signatures may not satisfy
              legal requirements for certain documents, including wills and testamentary instruments, real
              property transfers, certain family law documents, court orders, negotiable instruments, and
              documents requiring notarization or witnessing under applicable law.
            </li>
            <li>
              <strong>Identity verification.</strong> UniSi does not independently verify the identity of
              signers beyond email-address delivery. Signer identity verification is the sole
              responsibility of the account owner.
            </li>
            <li>
              <strong>Regulatory compliance.</strong> It is your sole responsibility to determine whether
              electronic signatures satisfy applicable law in your jurisdiction, including Canada's{" "}
              <em>PIPEDA</em>, the U.S. <em>ESIGN Act</em> and <em>UETA</em>, the EU{" "}
              <em>eIDAS Regulation</em>, or any other legislation.
            </li>
            <li>
              <strong>Not legal advice.</strong> Nothing in the Service or these Terms constitutes legal
              advice. Consult a qualified legal professional regarding the enforceability of any specific
              agreement or electronic signature.
            </li>
          </ol>

          <hr />

          <h2>5. AI Processing Disclosure</h2>
          <p>
            <strong>Your documents are processed by AI models operated by a third party.</strong>
          </p>
          <p>
            By using any AI feature (template drafting, field detection, signer Q&amp;A, structured data
            extraction), you expressly acknowledge and consent that:
          </p>
          <ol>
            <li>
              Document content — rendered page images and/or extracted text — will be transmitted to{" "}
              <strong>Agnic's AI gateway</strong> and processed by large language models (including
              Anthropic Claude models).
            </li>
            <li>
              Agnic and Anthropic operate their own privacy policies and data handling practices that
              Sarzamin does not control.
            </li>
            <li>
              <strong>Do not upload documents containing classified, trade-secret, privileged, or
              otherwise highly sensitive information</strong> that you would not consent to being processed
              by a third-party AI service.
            </li>
            <li>
              AI-generated content may contain errors. You are responsible for independently reviewing all
              AI outputs before relying on them.
            </li>
          </ol>
          <p>
            Sarzamin is not liable for the accuracy of AI-generated content or for any consequence of
            acting on such content without independent verification.
          </p>

          <hr />

          <h2>6. User Responsibilities</h2>
          <h3>6.1 Account Owners</h3>
          <p>Account owners are responsible for:</p>
          <ul>
            <li>Having the legal right to use documents they upload for electronic execution</li>
            <li>Accurately identifying signers and confirming contact details</li>
            <li>Informing signers of any relevant legal context</li>
            <li>Complying with applicable data protection laws regarding signer personal data</li>
            <li>Keeping API tokens and webhook secrets confidential</li>
          </ul>
          <h3>6.2 Signers</h3>
          <p>Signers are responsible for:</p>
          <ul>
            <li>Reviewing all documents carefully before signing</li>
            <li>Understanding the nature and effect of what they are signing</li>
            <li>Determining independently whether they have authority to sign</li>
            <li>Keeping their signing link confidential</li>
          </ul>

          <hr />

          <h2>7. Acceptable Use</h2>
          <p>You may not use the Service to:</p>
          <ul>
            <li>Forge, falsify, or misrepresent the identity of any party to a document</li>
            <li>Coerce, deceive, or manipulate signers</li>
            <li>Upload documents containing malware or malicious code</li>
            <li>Engage in phishing, fraud, or impersonation</li>
            <li>Circumvent any security or access control</li>
            <li>Scrape, harvest, or systematically collect data from the Service</li>
            <li>Intentionally degrade service performance or circumvent rate limits</li>
            <li>Violate any applicable law or regulation</li>
          </ul>
          <p>
            Sarzamin reserves the right to suspend or terminate access immediately and without notice for
            violations of this section.
          </p>

          <hr />

          <h2>8. Third-Party Services</h2>
          <p>The Service depends on third-party providers, each subject to their own terms and privacy policies:</p>
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Provider</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>AI gateway, OAuth, wallet</td>
                <td>Agnic (app.agnic.ai)</td>
                <td>Identity, AI model access, billing</td>
              </tr>
              <tr>
                <td>AI models</td>
                <td>Anthropic (via Agnic)</td>
                <td>Claude model inference</td>
              </tr>
              <tr>
                <td>Document storage</td>
                <td>Amazon S3 / Cloudflare R2</td>
                <td>PDF and attachment storage</td>
              </tr>
              <tr>
                <td>Email delivery</td>
                <td>Resend</td>
                <td>Signing invitations and notifications</td>
              </tr>
            </tbody>
          </table>
          <p>
            Sarzamin is not responsible for the availability, accuracy, security, or legality of
            third-party services.
          </p>

          <hr />

          <h2>9. Wallet, Credits, and Billing</h2>
          <p>AI usage is metered against Agnic wallet balances:</p>
          <ul>
            <li>The account owner's Agnic wallet is charged for template-side AI features.</li>
            <li>The signer's Agnic wallet is charged for signer-side AI Q&amp;A features.</li>
            <li>Sarzamin does not directly process payments; all billing is managed by Agnic.</li>
            <li>Sarzamin may earn partner commissions on AI usage through Agnic's partner program.</li>
          </ul>
          <p>
            Sarzamin is not responsible for Agnic wallet charges, billing disputes, or wallet service
            interruptions.
          </p>

          <hr />

          <h2>10. Disclaimer of Warranties</h2>
          <p>
            <strong>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED "AS IS" AND
              "AS AVAILABLE" WITHOUT ANY WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
              LIMITED TO:
            </strong>
          </p>
          <ul>
            <li>Warranties of merchantability, fitness for a particular purpose, or non-infringement</li>
            <li>Accuracy or completeness of AI-generated content, field detection, or extracted data</li>
            <li>Legal enforceability of any electronic signature or document executed through the Service</li>
            <li>Uninterrupted or error-free operation of the Service or any component thereof</li>
            <li>Security against unauthorized access, data breaches, or loss of data</li>
            <li>Compatibility with your systems, regulatory requirements, or legal obligations</li>
          </ul>
          <p>
            Some jurisdictions do not allow exclusion of implied warranties; in such jurisdictions these
            disclaimers apply to the fullest extent permitted by law.
          </p>

          <hr />

          <h2>11. Limitation of Liability</h2>
          <p>
            <strong>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:</strong>
          </p>
          <ol>
            <li>
              <strong>Aggregate cap.</strong> Sarzamin's total aggregate liability to you for all claims
              arising out of or related to these Terms or the Service shall not exceed the greater of:{" "}
              (a) the amount you paid directly to Sarzamin in the twelve (12) months preceding the claim,
              or (b) CAD $100.
            </li>
            <li>
              <strong>Excluded categories.</strong> Sarzamin shall not be liable for any indirect,
              incidental, special, consequential, punitive, or exemplary damages, including loss of data,
              loss of profits, business interruption, loss of goodwill, reputational damage, or cost of
              substitute services — even if Sarzamin has been advised of the possibility of such damages.
            </li>
            <li>
              <strong>Specifically excluded.</strong> Sarzamin has no liability for: (a) the legal
              unenforceability of any electronic signature; (b) reliance on AI-generated content without
              independent verification; (c) third-party service failures (Agnic, AWS, Anthropic, Resend);
              (d) unauthorized access resulting from your security failures.
            </li>
          </ol>
          <p>
            These limitations apply regardless of the theory of liability (contract, tort, statute, or
            otherwise).
          </p>

          <hr />

          <h2>12. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Sarzamin Technologies Corp and its
            officers, directors, employees, and agents from and against any claims, liabilities, damages,
            losses, and expenses (including reasonable legal fees) arising from: your violation of these
            Terms; documents you upload or process through the Service; your violation of any applicable
            law or third-party rights (including signers' privacy rights); or any dispute between you and
            a signer or third party.
          </p>

          <hr />

          <h2>13. Data Handling Summary</h2>
          <p>
            Sarzamin collects and processes personal data as described in the{" "}
            <Link href="/privacy">Privacy Policy</Link>. Key points:
          </p>
          <ul>
            <li>
              <strong>Account data:</strong> Name and email obtained via Agnic OAuth.
            </li>
            <li>
              <strong>Signer data:</strong> Email, name, IP address, user agent, and timestamps of
              signing events recorded for audit purposes.
            </li>
            <li>
              <strong>Documents:</strong> Uploaded PDFs stored on S3-compatible storage; document content
              may be processed by AI (see Section 5).
            </li>
            <li>
              <strong>Audit trails:</strong> Append-only, SHA-256 hash-chained event logs retained to
              support signature validity.
            </li>
            <li>
              <strong>Retention:</strong> Documents and audit trails retained for the lifetime of your
              account plus 90 days after deletion.
            </li>
          </ul>

          <hr />

          <h2>14. Source Code Access (AGPL-3.0)</h2>
          <p>
            In accordance with Section 13 of the AGPL-3.0, the complete source code for UniSi as
            deployed on this platform is available at no charge at:{" "}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              {GITHUB_URL}
            </a>
          </p>

          <hr />

          <h2>15. Intellectual Property</h2>
          <ul>
            <li>
              <strong>UniSi Software:</strong> Licensed under AGPL-3.0. Copyright © 2025–2026 Sarzamin
              Technologies Corp.
            </li>
            <li>
              <strong>Your Content:</strong> You retain all intellectual property rights in documents you
              upload. By uploading, you grant Sarzamin a limited, non-exclusive, royalty-free license
              solely to operate the Service on your behalf.
            </li>
            <li>
              <strong>Brand:</strong> "UniSi" and associated logos are trademarks of Sarzamin
              Technologies Corp. The AGPL-3.0 license does not grant trademark rights.
            </li>
          </ul>

          <hr />

          <h2>16. Term and Termination</h2>
          <p>
            Sarzamin may suspend or terminate your access at any time, with or without cause or notice.
            Upon termination, your right to use the Service ceases immediately. You may request export of
            your documents within 30 days. After 30 days, Sarzamin may delete your data without further
            notice. Sections 4, 5, 10, 11, 12, 15, 17, and 18 survive termination.
          </p>

          <hr />

          <h2>17. Governing Law and Jurisdiction</h2>
          <p>
            These Terms are governed by the laws of the <strong>Province of Ontario, Canada</strong> and
            applicable federal laws of Canada, without regard to conflict-of-law principles. Any dispute
            shall be subject to the exclusive jurisdiction of the courts of the Province of Ontario.
            Mandatory consumer protection provisions of your jurisdiction also apply where required by
            law.
          </p>

          <hr />

          <h2>18. Changes to These Terms</h2>
          <p>
            Sarzamin may modify these Terms at any time. Material changes will be communicated by posting
            a notice on the Service and updating the Effective Date above. Continued use after changes
            become effective constitutes acceptance.
          </p>

          <hr />

          <h2>19. Contact</h2>
          <p>
            <strong>Sarzamin Technologies Corp</strong><br />
            Toronto, Ontario, Canada<br />
            <a href="mailto:legal@sarzamin.ca">legal@sarzamin.ca</a>{" "}
            ·{" "}
            <a href="https://www.sarzamin.ca" target="_blank" rel="noopener noreferrer">
              www.sarzamin.ca
            </a>
          </p>
        </article>

        <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-900 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100">Privacy Policy</Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 dark:hover:text-zinc-100">Source Code (AGPL-3.0)</a>
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">Back to UniSi</Link>
        </div>
      </div>
    </div>
  );
}
