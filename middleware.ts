import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const protectedPagePrefixes = ["/workbench", "/brief-records", "/admin"];
const protectedApiPrefixes = ["/api/opportunities", "/api/brief-records", "/api/admin"];
const publicPrefixes = ["/login", "/auth/callback", "/unauthorized"];

function isProtectedPage(pathname: string): boolean {
  return protectedPagePrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedApi(pathname: string): boolean {
  return protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }

  return publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { user, response } = await updateSupabaseSession(request);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/cron/") || pathname.startsWith("/api/sync/")) {
    return response;
  }

  if (isPublicPath(pathname)) {
    return response;
  }

  if (isProtectedApi(pathname) && !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isProtectedPage(pathname) && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
