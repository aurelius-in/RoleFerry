"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAudience } from "@/lib/audience";
import { getActiveClient } from "@/lib/clients";
import { RECRUITER_STEP_COPY } from "@/lib/recruiterCopy";

const GATED = new Set(Object.keys(RECRUITER_STEP_COPY).concat(["/deliverability-launch", "/tracker"]));

export default function RecruiterClientBar() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (getAudience() !== "recruiter") {
      setLabel(null);
      return;
    }
    const client = getActiveClient();
    const gated = GATED.has(pathname) || [...GATED].some((path) => pathname.startsWith(`${path}/`));
    if (!client && gated) {
      router.replace("/recruiter");
      return;
    }
    setLabel(client ? `${client.name} - ${client.company}` : null);
  }, [pathname, router]);

  if (!label || pathname === "/recruiter") return null;

  return (
    <div className="border-b border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <span>Client: {label}</span>
        <Link className="underline" href="/recruiter">
          Switch client
        </Link>
      </div>
    </div>
  );
}
