import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const isAkuosplash = host.includes("akuosplash.cl");

  if (isAkuosplash && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/akuosplash", req.url));
  }

  const authHeader = req.headers.get("authorization");
  const cookieName = "aljibe-session";
  const existingCookie = req.cookies.get(cookieName)?.value;

  if (authHeader?.startsWith("Bearer ") && !existingCookie) {
    const token = authHeader.slice(7);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("cookie", `${cookieName}=${token}`);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/"],
};
