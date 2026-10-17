"use client";

import Link from "next/link";
import { useEffect } from "react";
import { setAudience } from "@/lib/audience";

const STEPS = [
  {
    n: "1",
    title: "Roles you fill",
    body: "Set the kinds of roles, locations, and clients you want to win.",
    href: "/job-preferences",
  },
  {
    n: "2",
    title: "Open roles",
    body: "Import the job posts your clients are hiring for.",
    href: "/job-descriptions",
  },
  {
    n: "3",
    title: "Company research",
    body: "See who is hiring and what is going on at the company.",
    href: "/company-research",
  },
  {
    n: "4",
    title: "Decision makers",
    body: "Find the people who can say yes to a conversation.",
    href: "/find-contact",
  },
  {
    n: "5",
    title: "Your pitch",
    body: "Write the reason a hiring manager should talk to you.",
    href: "/offer",
  },
  {
    n: "6",
    title: "Outreach",
    body: "Draft the email sequence for those contacts.",
    href: "/campaign",
  },
  {
    n: "7",
    title: "Launch",
    body: "Check the sequence, then send it.",
    href: "/deliverability-launch",
  },
  {
    n: "8",
    title: "Pipeline",
    body: "Track who you contacted and what happened next.",
    href: "/tracker",
  },
];

export default function RecruiterHome() {
  useEffect(() => {
    setAudience("recruiter");
  }, []);

  return (
    <main className="min-h-screen px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Recruiter beta</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Win the conversation, then fill the role.</h1>
        <p className="mt-3 max-w-2xl text-white/70">
          This path is for people who hire. Start with the roles you fill, find the person who owns the req, and send a short pitch. It is a beta, so some screens still use job-seeker wording.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {STEPS.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-400/40 hover:bg-white/10"
            >
              <div className="text-xs font-bold text-emerald-300">Step {step.n}</div>
              <div className="mt-1 text-lg font-semibold text-white">{step.title}</div>
              <p className="mt-1 text-sm text-white/65">{step.body}</p>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-sm text-white/50">
          Looking for a job instead?{" "}
          <Link className="underline" href="/login?audience=job-seeker">
            Open the job-seeker beta
          </Link>
        </p>
      </div>
    </main>
  );
}
