import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // This endpoint exists purely to debug Railway env + routing issues in prod.
  // It intentionally avoids the /api rewrite proxy by living at /__debug.
  return NextResponse.json({
    ok: true,
    // Railway build info (best-effort; may be null depending on service settings)
    railwayGitCommitSha: process.env.RAILWAY_GIT_COMMIT_SHA || null,
    railwayGitBranch: process.env.RAILWAY_GIT_BRANCH || null,
    railwayServiceId: process.env.RAILWAY_SERVICE_ID || null,
    railwayProjectId: process.env.RAILWAY_PROJECT_ID || null,
    nodeEnv: process.env.NODE_ENV,
    nextPublicApiUrl: process.env.NEXT_PUBLIC_API_URL || null,
    backendUrl: process.env.BACKEND_URL || null,
    timestamp: new Date().toISOString(),
  });
}

