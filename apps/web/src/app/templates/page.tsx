import Link from "next/link";
import { LoginGate } from "@unisi/ui";
import { AppHeader } from "@/components/AppHeader";
import { TemplatesList } from "./TemplatesList";

export default function TemplatesPage() {
  return (
    <LoginGate>
      <AppHeader />
      <main className="max-w-5xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Templates</h1>
          <Link
            href="/templates/new"
            className="px-4 py-2 bg-emerald-500 text-white rounded-md font-medium hover:bg-emerald-400"
          >
            New template
          </Link>
        </div>
        <TemplatesList />
      </main>
    </LoginGate>
  );
}
