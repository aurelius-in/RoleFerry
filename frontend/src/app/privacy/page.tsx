import { BrandName } from "@/components/Brand";

export default function Privacy() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4 text-slate-100">
      <h1 className="text-3xl font-bold">Privacy</h1>
      <p className="opacity-90 leading-relaxed">
        <BrandName /> is in beta. We collect the account details you give us (name, email, phone, and an optional LinkedIn URL) so you can sign in and run a job search.
      </p>
      <p className="opacity-90 leading-relaxed">
        If you upload a resume or paste a job posting, we use that information to match roles, draft outreach, and keep your tracker. We do not sell your personal information.
      </p>
      <p className="opacity-90 leading-relaxed">
        Questions: <a className="underline" href="mailto:outreach@roleferry.com">outreach@roleferry.com</a>
      </p>
    </main>
  );
}
