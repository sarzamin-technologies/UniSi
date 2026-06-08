import { TemplateBuilder } from "./TemplateBuilder";
import { LoginGate } from "@unisi/ui";

export default function TemplateDetailPage({ params }: { params: { id: string } }) {
  return (
    <LoginGate>
      <TemplateBuilder templateId={params.id} />
    </LoginGate>
  );
}
