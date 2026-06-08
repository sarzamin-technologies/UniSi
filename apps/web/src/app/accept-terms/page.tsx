import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getOwnerSession } from "@/lib/session";
import { AcceptTermsForm } from "./AcceptTermsForm";

export const metadata: Metadata = {
  title: "Terms of Service — UniSi",
};

export const dynamic = "force-dynamic";

export default async function AcceptTermsPage() {
  const session = await getOwnerSession();

  if (!session.account_id) redirect("/");
  if (session.terms_accepted) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#f7f8f6] dark:bg-slate-950 flex flex-col">
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            UniSi
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center py-16 px-6">
        <div className="w-full max-w-2xl">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-8 py-7 border-b border-slate-100 dark:border-slate-800">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                Before you continue
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Please read and accept our Terms of Service to use UniSi.
              </p>
            </div>

            <div className="px-8 py-6 space-y-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <Section icon="📄" title="Open source, as-is software">
                UniSi is free, open-source software licensed under{" "}
                <strong>AGPL-3.0</strong> and provided{" "}
                <strong>"as is", without warranty of any kind.</strong>{" "}
                Sarzamin Technologies Corp does not guarantee uptime, data durability, or fitness
                for any specific purpose.
              </Section>

              <Section icon="✍️" title="Electronic signatures — legal disclaimer">
                UniSi produces <strong>Simple Electronic Signatures (SES)</strong>. We make{" "}
                <strong>no representation that signatures are legally enforceable</strong> in your
                jurisdiction or for your document type. Consult a legal professional for
                advice on enforceability.
              </Section>

              <Section icon="🤖" title="AI processing of your documents">
                When you use AI features, <strong>document content is sent to Agnic's AI gateway
                and processed by Anthropic Claude models</strong>. Do not upload classified,
                privileged, or highly sensitive documents you would not consent to third-party AI
                processing.
              </Section>

              <Section icon="🔒" title="Your data">
                We collect your name, email (from Agnic), and signer activity (IP address,
                timestamps). Documents are stored on S3-compatible storage. We do not sell your
                data. See our{" "}
                <Link href="/privacy" className="text-[#b61c28] hover:underline" target="_blank">
                  Privacy Policy
                </Link>{" "}
                for full details.
              </Section>

              <Section icon="⚖️" title="Liability">
                Sarzamin Technologies Corp's liability is limited to the greater of fees you paid
                us directly or CAD $100. We are not liable for indirect, consequential, or
                incidental damages. Governing law: Province of Ontario, Canada.
              </Section>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                By accepting you agree to the full{" "}
                <Link href="/terms" className="text-[#b61c28] hover:underline" target="_blank">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-[#b61c28] hover:underline" target="_blank">
                  Privacy Policy
                </Link>
                . Effective June 6, 2026. Operated by Sarzamin Technologies Corp, Toronto,
                Ontario, Canada.
              </p>
              <AcceptTermsForm />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-base mt-0.5 shrink-0" aria-hidden>
        {icon}
      </span>
      <div>
        <p className="font-medium text-slate-900 dark:text-white mb-0.5">{title}</p>
        <p>{children}</p>
      </div>
    </div>
  );
}
