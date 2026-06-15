"use client";

import { useState } from "react";
import {
  ROUTE_DEFINITIONS,
  RouteId,
  getActiveRoute,
  setActiveRoute,
} from "@/lib/workflowRoutes";

type Props = {
  onRouteSelected?: (route: RouteId) => void;
  compact?: boolean;
};

export default function RoutePicker({ onRouteSelected, compact = false }: Props) {
  const [selected, setSelected] = useState<RouteId | null>(() => getActiveRoute());

  const pick = (id: RouteId) => {
    setSelected(id);
    setActiveRoute(id);
    onRouteSelected?.(id);
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!compact && (
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-white">Choose your route</h2>
          <p className="text-sm text-white/60 max-w-xl mx-auto">
            Pick one route for this journey. Route 1 uses posted roles. Routes 2 and 3 skip job search and focus on company research and outreach.
          </p>
        </div>
      )}

      <div className={`grid grid-cols-1 ${compact ? "md:grid-cols-3" : "md:grid-cols-3"} gap-3`}>
        {ROUTE_DEFINITIONS.map((r) => {
          const active = selected === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => pick(r.id)}
              className={`relative text-left rounded-xl border p-4 transition-all ${
                active
                  ? `${r.accent} ring-2`
                  : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  active ? "border-white/30 text-white bg-white/10" : "border-white/15 text-white/50"
                }`}>
                  {r.badge}
                </span>
                <span className="text-xl" aria-hidden>{r.icon}</span>
              </div>
              <div className={`text-base font-bold mb-1 ${active ? "text-white" : "text-white/90"}`}>
                {r.title}
              </div>
              <div className="text-xs text-white/65 mb-2 leading-relaxed">{r.subtitle}</div>
              <div className={`text-xs font-medium ${active ? "text-blue-200" : "text-white/45"}`}>
                {r.strategy}
              </div>
              <div className="mt-2 text-[10px] text-white/40 uppercase tracking-wide">{r.difficulty} difficulty</div>
            </button>
          );
        })}
      </div>

      {selected && selected !== "1" && (
        <p className="text-xs text-amber-200/90 border border-amber-500/25 bg-amber-500/10 rounded-lg px-3 py-2 text-center">
          Route {selected} skips Role Search and Gap Analysis. You go Personality → Research → Pain Point Match → outreach.
        </p>
      )}

      {selected === "1" && (
        <p className="text-xs text-emerald-200/80 border border-emerald-500/20 bg-emerald-500/10 rounded-lg px-3 py-2 text-center">
          Route 1 includes the full job search: roles, gaps, match, then research and outreach.
        </p>
      )}
    </div>
  );
}
