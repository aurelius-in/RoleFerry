"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getActiveRoute, isStepSkippedForRoute } from "@/lib/workflowRoutes";

/** Redirect away from steps not on the active route (e.g. Roles/Gaps on Route 2/3). */
export function useRouteGuard(step: number) {
  const router = useRouter();

  useEffect(() => {
    const route = getActiveRoute();
    if (isStepSkippedForRoute(step, route)) {
      router.replace("/");
    }
  }, [step, router]);
}
