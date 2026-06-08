import { SigningForm } from "./SigningForm";

export const dynamic = "force-dynamic";

export default function SignPage({ params }: { params: { slug: string } }) {
  return <SigningForm slug={params.slug} />;
}
