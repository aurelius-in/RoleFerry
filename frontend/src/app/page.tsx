import AskBox from "@/components/AskBox";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 sm:p-16">
      <main className="w-full max-w-3xl mx-auto text-center space-y-6">
        <div className="flex flex-col items-center justify-center gap-3">
          <img src="/roleferry-med.gif" alt="RoleFerry animation" className="w-[260px] md:w-[320px] rounded" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
          Smooth crossing in rough seas.
        </h1>
        <p className="text-base sm:text-lg opacity-90">
          When every wave pushes you back, RoleFerry pulls you forward.
        </p>
        <div className="pt-2">
          <AskBox />
        </div>
      </main>
    </div>
  );
}
