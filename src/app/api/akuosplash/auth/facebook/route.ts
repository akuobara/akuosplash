import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const appId = process.env.AKUO_FACEBOOK_APP_ID;
  const appSecret = process.env.AKUO_FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;background:#eff6ff;display:flex;min-height:100vh;align-items:center;justify-content:center} .c{background:#fff;border:2px solid #2563eb;border-radius:16px;padding:2rem;max-width:400px;text-align:center} a{display:inline-block;margin-top:1rem;padding:.6rem 1.2rem;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none}</style></head><body><div class="c"><h2>Login con Facebook</h2><p>La integración con Facebook está siendo configurada.</p><a href="/akuosplash">Volver</a></div></body></html>`;
    return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const redirectUri = `${protocol}://${host}/api/akuosplash/auth/facebook/callback`;
  const params = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, response_type: "code", scope: "email,public_profile", state: "akuosplash-facebook" });
  return NextResponse.redirect(`https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`);
}
