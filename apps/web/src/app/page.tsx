import Link from "next/link";
import { VerifyWidget } from "@/components/VerifyWidget";
import { getOwnerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getOwnerSession();
  const signedIn = Boolean(session.account_id);
  const ctaHref = signedIn ? "/dashboard" : "/api/auth/login";
  const ctaLabel = signedIn ? "Open dashboard" : "Start securely";

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <Header signedIn={signedIn} />
      <main>
        <Hero ctaHref={ctaHref} ctaLabel={ctaLabel} />
        <ProofStrip />
        <ServicePanel />
        <Assurance />
        <Verify />
        <LaunchService />
        <CtaStrip ctaHref={ctaHref} ctaLabel={ctaLabel} />
      </main>
      <Footer />
    </div>
  );
}

function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f7f8f6]/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="UniSi home">
          <Logo />
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight">UniSi</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Audit-ready e-signatures</p>
          </div>
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-5">
          <a href="#assurance" className="hidden text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline">
            Assurance
          </a>
          <a href="#verify" className="hidden text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline">
            Verify
          </a>
          <Link
            href={signedIn ? "/dashboard" : "/api/auth/login"}
            className="inline-flex min-h-10 items-center rounded-md bg-[#b61c28] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#9f1621]"
          >
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <section className="relative min-h-[680px] overflow-hidden border-b border-slate-200/80 dark:border-slate-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/unisi-hero-professional-signing.png"
        alt="Professional desk with signed documents and a laptop"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(247,248,246,0.97)_0%,rgba(247,248,246,0.84)_34%,rgba(247,248,246,0.36)_62%,rgba(247,248,246,0.08)_100%)] dark:bg-[linear-gradient(90deg,rgba(15,23,42,0.95)_0%,rgba(15,23,42,0.76)_40%,rgba(15,23,42,0.26)_72%,rgba(15,23,42,0.06)_100%)]" />
      <div className="relative mx-auto flex min-h-[680px] max-w-7xl items-center px-5 py-20 sm:px-6">
        <div className="max-w-2xl">
          <ServiceBadge />
          <h1 className="mt-6 text-4xl font-semibold leading-[1.04] tracking-normal text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
            White-label digital signing with records you can defend.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
            UniSi helps small businesses, legal and immigration offices, and startups launch secure signing under their own brand and domain, with audit trails, AI signer support, and independent verification.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={ctaHref}
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#b61c28] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#9f1621]"
            >
              {ctaLabel}
            </Link>
            <a
              href="#verify"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-900 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              Verify a document
            </a>
          </div>
          <dl className="mt-10 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ["Audit trail", "Hash-chained events"],
              ["AI Q&A", "Signer guidance"],
              ["Your brand", "White-label ready"],
            ].map(([value, label]) => (
              <div key={value} className="border-l-2 border-[#b61c28] pl-4">
                <dt className="text-lg font-semibold text-slate-950 dark:text-white">{value}</dt>
                <dd className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function ProofStrip() {
  const items = [
    ["White-label platform", <BrandIcon key="brand" />],
    ["AI Signer Q&A", <AiIcon key="ai" />],
    ["Open source", <SourceIcon key="source" />],
    ["Connects with your systems", <ConnectIcon key="connect" />],
  ] as const;

  return (
    <section className="border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-5 py-6 text-sm text-slate-700 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 dark:text-slate-300">
        {items.map(([label, icon]) => (
          <div key={label} className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center text-[#b61c28]" aria-hidden>
              {icon}
            </span>
            <span className="font-medium">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const SERVICE_ITEMS = [
  {
    title: "For document-heavy offices",
    body: "Use structured signing packages for retainers, consent forms, intake forms, service agreements, and immigration paperwork.",
  },
  {
    title: "AI answers before signing",
    body: "Signer Q&A helps clients understand document sections using grounded answers, reducing back-and-forth for busy teams.",
  },
  {
    title: "Fits into existing workflows",
    body: "APIs, webhooks, and embeds make it easier to connect signing with CRMs, intake portals, partner apps, and internal tools.",
  },
];

function ServicePanel() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#b61c28]">Reliable by design</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              A signing workflow your operations team can explain.
            </h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
              UniSi is designed for small teams that need clear records without enterprise software overhead. Every signing package moves through a controlled path from document setup to verification.
            </p>
          </div>
          <OperationsRail />
        </div>
        <div className="mt-12 grid gap-8 border-t border-slate-200 pt-8 sm:grid-cols-3 dark:border-slate-800">
          {SERVICE_ITEMS.map((item) => (
            <article key={item.title} className="relative pl-8">
              <span className="absolute left-0 top-1 h-4 w-4 rounded-full border-4 border-white bg-[#b61c28] shadow-sm shadow-slate-900/20 dark:border-slate-950" />
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function OperationsRail() {
  const steps = [
    ["Prepare", "Fields and signer details reviewed"],
    ["Send", "Controlled signing link delivered"],
    ["Complete", "Certificate and audit trail generated"],
    ["Verify", "Record can be checked independently"],
  ];

  return (
    <div className="relative py-8">
      <div className="absolute left-4 right-4 top-1/2 hidden h-px bg-slate-300 dark:bg-slate-700 sm:block" />
      <div className="grid gap-7 sm:grid-cols-4">
        {steps.map(([title, body], index) => (
          <div key={title} className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#b61c28] text-sm font-semibold text-white shadow-sm">
              {index + 1}
            </div>
            <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.12em] text-slate-950 dark:text-white">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const ASSURANCE_ITEMS = [
  ["Auditability", "Each signing event is linked into a SHA-256 audit chain and completion certificate."],
  ["AI signer support", "Document-grounded Q&A helps signers understand what they are reviewing before they sign."],
  ["Open source", "The AGPL-licensed codebase can be inspected, self-hosted, and adapted by technical teams."],
  ["Operator accountability", "Published ownership, terms, and privacy policy keep the service accountable."],
  ["Integration readiness", "REST APIs, HMAC-signed webhooks, and embeddable forms connect signing with the tools your business already uses."],
];

function Assurance() {
  return (
    <section id="assurance" className="border-y border-slate-200/80 bg-slate-950 py-16 text-white dark:border-slate-800 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.68fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-300">Trust framework</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">Built for records that need to stand up later.</h2>
            <EvidenceLedger />
          </div>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {ASSURANCE_ITEMS.map(([title, body]) => (
              <article key={title} className="border-t border-white/15 pt-5">
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EvidenceLedger() {
  const rows = [
    ["submission.created", "9f42a0", "signed"],
    ["fields.confirmed", "a81d23", "sealed"],
    ["signer.completed", "3c77be", "sealed"],
    ["certificate.issued", "6e10f4", "valid"],
  ];

  return (
    <div className="mt-10 max-w-md font-mono text-xs text-slate-300">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-5 border-b border-white/15 pb-3 text-[11px] uppercase tracking-[0.16em] text-slate-500">
        <span>Event</span>
        <span>Hash</span>
        <span>Status</span>
      </div>
      {rows.map(([event, hash, status]) => (
        <div key={event} className="grid grid-cols-[1fr_auto_auto] gap-x-5 border-b border-white/10 py-3">
          <span>{event}</span>
          <span className="text-slate-500">{hash}</span>
          <span className="text-emerald-300">{status}</span>
        </div>
      ))}
      <div className="mt-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-slate-500">
        <span className="h-px flex-1 bg-white/15" />
        Verifiable audit chain
      </div>
    </div>
  );
}

function Verify() {
  return (
    <section id="verify" className="bg-white py-16 dark:bg-slate-950 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-6 lg:grid-cols-[0.72fr_1fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#b61c28]">Independent verification</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">Check a signed document without asking anyone for access.</h2>
          <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
            Upload the completion certificate, and optionally the signed PDF. UniSi checks the platform signature and whether the document still matches the audit trail.
          </p>
        </div>
        <VerifyWidget />
      </div>
    </section>
  );
}

function CtaStrip({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <section className="border-t border-slate-200/80 bg-white py-14 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal sm:text-3xl">Start with a signing workflow you can trust.</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Use UniSi from the dashboard, embed it in a client portal, or connect it to your CRM, intake flow, or internal tools.</p>
        </div>
        <Link
          href={ctaHref}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#b61c28] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#9f1621]"
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}

function LaunchService() {
  return (
    <section className="border-t border-slate-200/80 bg-[#f7f8f6] py-16 dark:border-slate-800 dark:bg-slate-950 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-6 lg:grid-cols-[0.72fr_1fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#b61c28]">SME launch service</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
            Offer e-signatures under your own name.
          </h2>
        </div>
        <div className="max-w-3xl">
          <p className="leading-7 text-slate-600 dark:text-slate-300">
            For offices and growing teams that want a branded signing portal, Sarzamin can help set up UniSi on your domain, adapt the workflow to your services, and connect it with your existing tools.
          </p>
          <div className="mt-7 grid gap-5 border-t border-slate-200 pt-6 text-sm sm:grid-cols-3 dark:border-slate-800">
            {["Your logo and domain", "Client-ready signing flow", "Integration support"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-[#b61c28]" />
                {item}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="mailto:unisi@sarzamin.ca"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#b61c28] bg-white px-6 text-sm font-semibold text-[#b61c28] shadow-sm hover:bg-red-50 dark:bg-slate-950 dark:hover:bg-red-950/30"
            >
              Contact us
            </a>
            <a href="mailto:unisi@sarzamin.ca" className="text-sm font-medium text-slate-600 hover:text-[#b61c28] dark:text-slate-300">
              unisi@sarzamin.ca
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-[#f7f8f6] py-10 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.sarzamin.ca/assets/sarzamin-logo-B9cWihGl.png"
            alt="Sarzamin Technologies"
            className="h-8 w-auto"
          />
          <div className="text-sm leading-tight text-slate-600 dark:text-slate-400">
            Developed by{" "}
            <a href="https://www.sarzamin.ca" className="font-semibold text-slate-900 hover:underline dark:text-white">
              Sarzamin Technologies Corp
            </a>
            <br />
            <span className="text-xs">Toronto, Ontario, Canada</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400 lg:items-center">
          <span>Secure signing records</span>
          <CanadianBadge />
        </div>
        <div className="text-xs leading-6 text-slate-500 lg:text-right">
          <p>
            Open source under{" "}
            <a
              href="https://github.com/sarzamin-technologies/unisi"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-white"
            >
              AGPL-3.0
            </a>
          </p>
          <p>© {new Date().getFullYear()} Sarzamin Technologies Corp.</p>
          <p className="flex gap-3 lg:justify-end">
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function ServiceBadge() {
  return (
    <span
      className="inline-flex w-fit items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#b61c28] dark:text-red-300"
      aria-label="Audit-ready records"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#b61c28]" />
      Audit-ready records
    </span>
  );
}

function CanadianBadge() {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#b61c28]">
      <CanadaIcon />
      Proudly Canadian
    </span>
  );
}

function CanadaIcon() {
  return (
    <svg viewBox="0 0 28 20" className="h-4 w-5" fill="none" aria-hidden>
      <rect x="1" y="2" width="26" height="16" rx="2" fill="#fff" stroke="#b61c28" strokeWidth="1.4" />
      <path d="M2 4a2 2 0 0 1 2-2h4v16H4a2 2 0 0 1-2-2V4Zm18-2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4V2Z" fill="#b61c28" />
      <path d="M14 5.2 15.1 8l2.3-.8-1.1 2.2 2.1.6-2.3 1 1 2-2.1-.5-.2 2.5h-1.6l-.2-2.5-2.1.5 1-2-2.3-1 2.1-.6-1.1-2.2 2.3.8L14 5.2Z" fill="#b61c28" />
    </svg>
  );
}

function BrandIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8h15l6 6v22H13z" />
      <path d="M28 8v6h6" />
      <path d="M18 20h10" />
      <path d="M18 25h7" />
      <path d="M17 33c4-3 7.2-3.3 9.5-1 1.4 1.4 3 1.2 4.8-.8" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 12h18a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-8l-7 5v-5h-3a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5Z" />
      <path d="M17 21h.01" />
      <path d="M22 21h.01" />
      <path d="M27 21h.01" />
      <path d="M22 7v5" />
      <path d="M18 7h8" />
    </svg>
  );
}

function SourceIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 15-7 7 7 7" />
      <path d="m27 15 7 7-7 7" />
      <path d="m24 11-4 22" />
      <path d="M13 36h18" />
    </svg>
  );
}

function ConnectIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 22h18" />
      <path d="M22 13v18" />
      <rect x="6" y="16" width="10" height="12" rx="3" />
      <rect x="28" y="16" width="10" height="12" rx="3" />
      <rect x="17" y="6" width="10" height="12" rx="3" />
      <rect x="17" y="26" width="10" height="12" rx="3" />
    </svg>
  );
}

function Logo() {
  return (
    <span className="flex h-10 w-10 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none">
        <path
          d="M14 7h20a5 5 0 0 1 5 5v24a5 5 0 0 1-5 5H14a5 5 0 0 1-5-5V12a5 5 0 0 1 5-5Z"
          fill="#fff"
          stroke="#0f172a"
          strokeWidth="3.2"
        />
        <path
          d="M13 30c5.5-3.3 10-4.3 13.2-2.9 2.5 1.1 2.6 4.6-.2 5.6-2.8 1-3.8-1.6-1.3-5 2.8-3.8 6.2-4.8 8.5-2.2 2 2.2 4.4 2.4 7.3.5"
          stroke="#b61c28"
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function CheckIcon() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden>
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 10 3 3 7-7" />
      </svg>
    </span>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-6 w-6 text-[#b61c28]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
