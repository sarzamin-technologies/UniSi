# Terms of Service — UniSi

**Effective Date:** June 6, 2026
**Service Provider:** Sarzamin Technologies Corp ("Sarzamin", "we", "us", "our")
**Contact:** legal@sarzamin.ca | https://www.sarzamin.ca
**Address:** Toronto, Ontario, Canada

---

## 1. Agreement to Terms

By accessing or using UniSi (any domain operated by Sarzamin Technologies Corp), creating an account, uploading documents, or inviting signers, you ("User", "you") agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.

These Terms apply to all users: account owners (document senders), signers (recipients invited to sign), and developers accessing the API.

---

## 2. Open Source Software — AGPL-3.0

UniSi is **free and open-source software** published under the **GNU Affero General Public License v3.0 or later** (AGPL-3.0-or-later). The complete source code is available at:

**https://github.com/sarzamin-technologies/unisi**

The AGPL-3.0 license governs your rights to copy, modify, and distribute the software. These Terms of Service govern your use of the hosted platform operated by Sarzamin Technologies Corp and are entirely separate from the software license.

**The software is provided "AS IS", without warranty of any kind.** See Section 10 for the full disclaimer of warranties.

If you self-host or modify UniSi, AGPL-3.0 requires that:
- You make the complete corresponding source code available to all users of your deployment via a network server at no charge.
- Any modified version you deploy publicly must also be released under AGPL-3.0.

---

## 3. Description of the Service

UniSi is an AI-assisted electronic signature platform that enables users to:
- Upload or AI-generate PDF documents for signature
- Auto-detect signature fields using AI vision models
- Invite recipients to review and electronically sign documents
- Generate tamper-evident audit trails and completed PDF packages
- Conduct AI-powered document Q&A during the signing process
- Access functionality via REST API, webhooks, or embeddable web component

AI features are provided through **Agnic** (app.agnic.ai), a third-party platform operated independently of Sarzamin.

---

## 4. Electronic Signatures — Legal Disclaimer

**READ CAREFULLY. SARZAMIN PROVIDES TOOLING, NOT LEGAL ADVICE.**

UniSi facilitates **Simple Electronic Signatures (SES)** — a digital representation of intent to sign. Sarzamin makes **no representation or warranty** regarding:

1. **Legal enforceability.** The legal validity of electronic signatures varies by jurisdiction, document type, and applicable law. Electronic signatures may not satisfy legal requirements for certain documents, including (but not limited to): wills and testamentary instruments, real property transfers, certain family law documents, court orders, negotiable instruments, and documents requiring notarization or witnessing under applicable law.

2. **Identity verification.** UniSi does not independently verify the identity of signers beyond email-address delivery. Signer identity verification is the sole responsibility of the account owner.

3. **Regulatory compliance.** It is your sole responsibility to determine whether electronic signatures satisfy the requirements of applicable law in your jurisdiction, including Canada's *Personal Information Protection and Electronic Documents Act* (PIPEDA), the U.S. *Electronic Signatures in Global and National Commerce Act* (ESIGN Act) and *Uniform Electronic Transactions Act* (UETA), the EU *eIDAS Regulation*, or any other law.

4. **Not legal advice.** Nothing in the Service or these Terms constitutes legal advice. Consult a qualified legal professional regarding the enforceability of any specific agreement or electronic signature.

---

## 5. AI Processing Disclosure

**Your documents are processed by AI models operated by a third party.**

By uploading a document or using any AI feature (template drafting, field detection, signer Q&A, or structured data extraction), you expressly acknowledge and consent that:

1. Document content — rendered page images and/or extracted text — will be transmitted to **Agnic's AI gateway** and processed by large language models (including Anthropic Claude models).
2. Agnic and Anthropic operate their own privacy policies and data handling practices that Sarzamin does not control.
3. **Do not upload documents containing classified, trade-secret, privileged, or otherwise highly sensitive information** that you would not consent to being processed by a third-party AI service.
4. AI-generated content (drafted templates, detected fields, extracted data) may contain errors. You are responsible for independently reviewing all AI outputs before relying on them.

Sarzamin is not liable for the accuracy of AI-generated content or for any consequence of acting on such content without independent verification.

---

## 6. User Responsibilities

### 6.1 Account Owners
Account owners are responsible for:
- Having the legal right to use documents they upload for electronic execution
- Accurately identifying signers and confirming contact details
- Informing signers of any legal context relevant to the documents they are signing
- Compliance with applicable data protection laws with respect to signer personal data
- Keeping API tokens and webhook secrets confidential

### 6.2 Signers
Signers are responsible for:
- Reviewing all documents carefully before signing
- Understanding the nature and effect of what they are signing
- Determining independently whether they have authority to sign
- Keeping their signing link confidential

---

## 7. Acceptable Use

You may not use the Service to:
- Forge, falsify, or misrepresent the identity of any party to a document
- Coerce, deceive, or manipulate signers
- Upload documents containing malware or malicious code
- Engage in phishing, fraud, or impersonation
- Circumvent any security or access control
- Scrape, harvest, or systematically collect data from the Service or other users
- Intentionally degrade service performance or circumvent rate limits
- Violate any applicable law or regulation

Sarzamin reserves the right to suspend or terminate access immediately and without notice for violations of this section.

---

## 8. Third-Party Services

The Service depends on third-party providers, each subject to their own terms and privacy policies:

| Service | Provider | Purpose |
|---|---|---|
| AI gateway, OAuth, wallet | Agnic (app.agnic.ai) | Identity, AI model access, billing |
| AI models | Anthropic (via Agnic) | Claude model inference |
| Document storage | Amazon S3 / Cloudflare R2 | PDF and attachment storage |
| Email delivery | Resend | Signing invitations and notifications |

Sarzamin is not responsible for the availability, accuracy, security, or legality of third-party services. Interruption of third-party services may cause interruption of the Service. Sarzamin does not guarantee continuous availability of AI features if Agnic is unavailable.

---

## 9. Wallet, Credits, and Billing

AI usage is metered and charged against Agnic wallet balances:
- The account owner's Agnic wallet is charged for template-side AI features (drafting, field detection, extraction).
- The signer's Agnic wallet is charged for signer-side AI features (document Q&A).
- Sarzamin does not directly process payments; all billing is managed by Agnic.
- Sarzamin may earn partner commissions on AI usage through Agnic's partner program.

Sarzamin is not responsible for Agnic wallet charges, billing disputes, or wallet service interruptions.

---

## 10. Disclaimer of Warranties

**TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:**

- Warranties of **merchantability**, fitness for a particular purpose, or non-infringement
- **Accuracy or completeness** of AI-generated content, field detection, or extracted data
- **Legal enforceability** of any electronic signature or document executed through the Service
- **Uninterrupted or error-free** operation of the Service or any component thereof
- **Security** against unauthorized access, data breaches, or loss of data
- **Compatibility** with your systems, regulatory requirements, or legal obligations

Some jurisdictions do not allow exclusion of implied warranties; in such jurisdictions these disclaimers apply to the fullest extent permitted by law.

---

## 11. Limitation of Liability

**TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:**

1. **Aggregate cap.** Sarzamin's total aggregate liability to you for all claims arising out of or related to these Terms or the Service shall not exceed the greater of: (a) the amount you paid directly to Sarzamin (not Agnic) in the twelve (12) months preceding the claim, or (b) CAD $100.

2. **Excluded categories.** Sarzamin shall not be liable for any indirect, incidental, special, consequential, punitive, or exemplary damages, including but not limited to: loss of data, loss of profits, business interruption, loss of goodwill, reputational damage, or cost of substitute services — even if Sarzamin has been advised of the possibility of such damages.

3. **Specifically excluded.** Sarzamin has no liability for: (a) the legal unenforceability of any electronic signature in any jurisdiction; (b) reliance on AI-generated content without independent verification; (c) third-party service failures (Agnic, AWS, Anthropic, Resend); (d) unauthorized access to your account resulting from your security failures.

These limitations apply regardless of the theory of liability (contract, tort, statute, or otherwise).

---

## 12. Indemnification

You agree to indemnify, defend, and hold harmless Sarzamin Technologies Corp and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising from:
- Your violation of these Terms
- Documents you upload, send, or process through the Service
- Your violation of any applicable law or the rights of any third party (including signers' privacy rights)
- Any dispute between you and a signer or third party

---

## 13. Data Handling Summary

Sarzamin collects and processes personal data as described in the [Privacy Policy](https://unisi.app/privacy). Key points:
- **Account data**: Name and email obtained via Agnic OAuth.
- **Signer data**: Email, name, IP address, user agent, and timestamps of signing events recorded for audit purposes.
- **Documents**: Uploaded PDFs stored on S3-compatible storage; document content may be processed by AI (see Section 5).
- **Audit trails**: Append-only, SHA-256 hash-chained event logs retained to support signature validity.
- **Retention**: Documents and audit trails retained for the lifetime of your account plus 90 days after deletion.

---

## 14. Source Code Access (AGPL-3.0 Compliance)

In accordance with Section 13 of the AGPL-3.0, the complete source code for UniSi as deployed on this platform is available at no charge at:

**https://github.com/sarzamin-technologies/unisi**

---

## 15. Intellectual Property

- **UniSi Software**: Licensed under AGPL-3.0. Copyright © 2025–2026 Sarzamin Technologies Corp.
- **Your Content**: You retain all intellectual property rights in documents you upload. By uploading, you grant Sarzamin a limited, non-exclusive, royalty-free license solely to operate the Service on your behalf.
- **Brand**: The name "UniSi" and associated logos are trademarks of Sarzamin Technologies Corp. The AGPL-3.0 license does not grant trademark rights.

---

## 16. Term and Termination

These Terms are effective until terminated. Sarzamin may suspend or terminate your access at any time, with or without cause or notice. Upon termination:
- Your right to use the Service ceases immediately.
- You may request export of your documents within 30 days of termination.
- After 30 days, Sarzamin may delete your data without further notice.

Sections 4, 5, 10, 11, 12, 15, 17, and 18 survive termination.

---

## 17. Governing Law and Jurisdiction

These Terms are governed by the laws of the **Province of Ontario, Canada** and applicable federal laws of Canada, without regard to conflict-of-law principles. Any dispute shall be subject to the exclusive jurisdiction of the courts of the Province of Ontario, Canada. If you are a consumer, mandatory consumer protection provisions of your jurisdiction also apply.

For EU users: to the extent required by EU law, mandatory consumer protection provisions of your country of residence apply.

---

## 18. Changes to These Terms

Sarzamin may modify these Terms at any time. Material changes will be communicated by posting a notice on the Service and updating the Effective Date above. Continued use after changes become effective constitutes acceptance of the revised Terms.

---

## 19. Miscellaneous

- **Severability**: If any provision is found unenforceable, the remaining provisions continue in full force.
- **No Waiver**: Failure to enforce any provision does not waive the right to enforce it later.
- **Entire Agreement**: These Terms and the Privacy Policy constitute the entire agreement between you and Sarzamin regarding the Service.
- **Language**: These Terms are in English. In case of conflict with a translated version, the English version prevails.

---

## 20. Contact

**Sarzamin Technologies Corp**
Toronto, Ontario, Canada
legal@sarzamin.ca | https://www.sarzamin.ca
