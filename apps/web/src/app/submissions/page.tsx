import { LoginGate } from "@unisi/ui";
import { AppHeader } from "@/components/AppHeader";
import { SubmissionsList } from "./SubmissionsList";

export default function SubmissionsPage() {
  return (
    <LoginGate>
      <AppHeader />
      <main className="max-w-5xl mx-auto p-8 space-y-6">
        <h1 className="text-2xl font-bold">Submissions</h1>
        <SubmissionsList />
      </main>
    </LoginGate>
  );
}
