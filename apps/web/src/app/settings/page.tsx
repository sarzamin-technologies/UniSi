import Link from "next/link";
import { LoginGate } from "@unisi/ui";
import { AppHeader } from "@/components/AppHeader";
import { ProfileSection } from "./ProfileSection";
import { TokensSection } from "./TokensSection";
import { WebhooksSection } from "./WebhooksSection";

export default function SettingsPage() {
  return (
    <LoginGate>
      <AppHeader />
      <main className="max-w-3xl mx-auto p-8 space-y-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Settings</h1>
          <Link
            href="/docs/api"
            className="text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
          >
            API reference →
          </Link>
        </div>
        <ProfileSection />
        <TokensSection />
        <WebhooksSection />
      </main>
    </LoginGate>
  );
}
