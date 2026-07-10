import { NextRequest, NextResponse } from "next/server";

// Middleware que copia el token del header Authorization a una cookie del request
// Esto es necesario en entornos de preview HTTPS donde las cookies cross-origin
// pueden no enviarse automáticamente, pero el frontend puede enviar el token via header.
export function middleware(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cookieName = "aljibe-session";
  const existingCookie = req.cookies.get(cookieName)?.value;

  // Si hay token en el header Authorization pero no en la cookie, 
  // inyectarlo como cookie en el request que llega al API route
  if (authHeader?.startsWith("Bearer ") && !existingCookie) {
    const token = authHeader.slice(7);
    // Clonar los headers del request y agregar la cookie
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("cookie", `${cookieName}=${token}`);
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
