import { NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/auth/server";
import { hasRequiredRole } from "@/lib/auth/roles";
import { loadOpportunities } from "@/lib/data/load-opportunities";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getApiAccessContext();

  if (!access?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRequiredRole(access.role, "viewer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { opportunities, supplementLoadError } = await loadOpportunities();
    return NextResponse.json({
      ok: true,
      count: opportunities.length,
      opportunities,
      supplementLoadError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
