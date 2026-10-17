"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import RoutePicker from "@/components/RoutePicker";
import { setAudience } from "@/lib/audience";
import { ClientRecord, addClient, getActiveClient, listClients, removeClient, selectClient } from "@/lib/clients";
import { RECRUITER_STEP_COPY } from "@/lib/recruiterCopy";
import { getActiveRoute, getStepsForRoute, RouteId } from "@/lib/workflowRoutes";

export default function RecruiterHome() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [focus, setFocus] = useState("");
  const [error, setError] = useState("");
  const [route, setRoute] = useState<RouteId | null>(null);

  function refresh() {
    setClients(listClients());
    setActiveId(getActiveClient()?.id || null);
  }

  useEffect(() => {
    setAudience("recruiter");
    refresh();
    const syncRoute = () => setRoute(getActiveRoute());
    syncRoute();
    window.addEventListener("rf-route-changed", syncRoute);
    window.addEventListener("rf-client-changed", syncRoute);
    return () => {
      window.removeEventListener("rf-route-changed", syncRoute);
      window.removeEventListener("rf-client-changed", syncRoute);
    };
  }, []);

  function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !company.trim()) {
      setError("Client name and company are required.");
      return;
    }
    setError("");
    const client = addClient({ name, company, focus });
    selectClient(client.id);
    setName("");
    setCompany("");
    setFocus("");
    refresh();
  }

  const active = clients.find((client) => client.id === activeId) || null;

  return (
    <main className="min-h-screen px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Recruiter beta</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Choose a client first.</h1>
        <p className="mt-3 max-w-2xl text-white/70">
          Add each company you are hiring for. Pick one, then use the same steps as a job seeker, labeled for that client. Switching clients keeps their brief, candidate, and outreach separate.
        </p>

        <form onSubmit={onAdd} className="mt-8 grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-4">
          <label className="text-sm text-white/70">
            Client name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-white/70">
            Company
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-white/70">
            Role focus
            <input
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              placeholder="Senior PM, nurses, ..."
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white"
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950">
              Add client
            </button>
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-red-200">{error}</p> : null}

        <div className="mt-4 grid gap-2">
          {clients.length === 0 ? (
            <p className="text-sm text-white/50">No clients yet. Add one to unlock the rest of the steps.</p>
          ) : (
            clients.map((client) => {
              const selected = client.id === activeId;
              return (
                <div
                  key={client.id}
                  className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                    selected ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-white/5"
                  }`}
                >
                  <div>
                    <div className="font-semibold text-white">{client.name}</div>
                    <div className="text-sm text-white/60">
                      {client.company}
                      {client.focus ? ` - ${client.focus}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        selectClient(client.id);
                        refresh();
                      }}
                      className="rounded-md border border-white/15 px-3 py-1.5 text-sm"
                    >
                      {selected ? "Selected" : "Select"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeClient(client.id);
                        refresh();
                      }}
                      className="rounded-md px-3 py-1.5 text-sm text-red-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {active ? (
          <div className="mt-10">
            <h2 className="text-2xl font-bold text-white">Steps for {active.name}</h2>
            <p className="mt-1 text-sm text-white/60">{active.company}{active.focus ? ` - ${active.focus}` : ""}</p>
            <div className="mt-6">
              <RoutePicker variant="recruiter" />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {getStepsForRoute(route).map((step) => {
                const copy = RECRUITER_STEP_COPY[step.href];
                return (
                  <Link
                    key={step.href}
                    href={step.href}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-400/40 hover:bg-white/10"
                  >
                    <div className="text-xs font-bold text-emerald-300">Step {step.step}</div>
                    <div className="mt-1 text-lg font-semibold text-white">{copy?.title || step.label}</div>
                    <p className="mt-1 text-sm text-white/65">{copy?.blurb}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

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
