import { LoginGate } from "@unisi/ui";
import { AppHeader } from "@/components/AppHeader";
import { SubmissionDetail } from "./SubmissionDetail";

export default function SubmissionDetailPage({ params }: { params: { id: string } }) {
  return (
    <LoginGate>
      <AppHeader />
      <SubmissionDetail submissionId={params.id} />
    </LoginGate>
  );
}
