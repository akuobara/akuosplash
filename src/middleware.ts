import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const isAkuosplash = host.includes("akuosplash.cl");

  if (isAkuosplash && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/akuosplash", req.url));
  }

  const authHeader = req.headers.get("authorization");
  const existingCookie = req.cookies.get("aljibe-session")?.value;
  const existingAkuoCookie = req.cookies.get("akuosplash_session")?.value;

  if (authHeader?.startsWith("Bearer ") && !existingCookie && !existingAkuoCookie) {
    const token = authHeader.slice(7);
    const requestHeaders = new Headers(req.headers);
    // Copiar a ambas cookies — aljibe-session (AljibeApp) y akuosplash_session (AkuoSplash)
    requestHeaders.set("cookie", `aljibe-session=${token}; akuosplash_session=${token}`);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/"],
};
