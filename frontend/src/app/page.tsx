import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 sm:p-16">
      <main className="w-full max-w-3xl mx-auto text-center space-y-6">
        <div className="flex items-center justify-center">
          <Image
            src="/role_ferry_black.png"
            alt="RoleFerry logo"
            width={220}
            height={60}
            className="hidden dark:block"
            priority
          />
          <Image
            src="/role_ferry_white.png"
            alt="RoleFerry logo"
            width={220}
            height={60}
            className="block dark:hidden"
            priority
          />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
          Forge your first conversation.
        </h1>
        <p className="text-base sm:text-lg opacity-90">
          Relationship-first outreach for prospecting and hiring.
        </p>
        <div className="inline-flex rounded-full px-4 py-2 text-black font-medium brand-gradient">
          Get started in the Foundry
        </div>
      </main>
    </div>
  );
}
