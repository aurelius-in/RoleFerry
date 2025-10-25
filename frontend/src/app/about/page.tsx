import { BrandName } from "@/components/Brand";

export default function About() {
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl md:text-4xl font-bold">About <BrandName /></h1>
      <p className="opacity-90 text-lg md:text-xl">
        <BrandName /> is the result of a creative partnership between two business owners—Dave March and Oliver Ellison—working
        together to bring a modern, relationship‑first outreach experience to life. Dave guides the concept and vision, while Oliver leads the development and technical implementation.
      </p>
      <section className="grid md:grid-cols-3 gap-6">
        <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2">
          <h2 className="text-xl font-semibold">Dave March · Innovative Marketing Solutions</h2>
          <p className="opacity-90 text-base md:text-lg leading-relaxed">
            Dave focuses on career coaching and end‑to‑end talent sourcing—helping candidates and teams align on the work that matters.
            His perspective shapes the practical workflows, from sourcing through outreach and interviews.
          </p>
        </div>
        <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2">
          <h2 className="text-xl font-semibold">Oliver Ellison · Reliable AI Network, Inc.</h2>
          <p className="opacity-90 text-base md:text-lg leading-relaxed">
            Oliver leads innovation in AI‑driven solutions for diverse business use cases. His product and engineering work powers
            <BrandName className="ml-1" />'s generation, verification, and analytics capabilities.
          </p>
        </div>
        <div className="rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
          <img src="/about.png" alt="Dave and Oliver skydiving" className="w-48 h-48 object-cover rounded-lg" />
        </div>
      </section>
      <div className="text-sm"><a className="underline" href="/README.md" target="_blank">License & Notices</a></div>
    </main>
  );
}

