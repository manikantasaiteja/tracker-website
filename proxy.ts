import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  const publicApiPaths = ["/api/auth", "/api/register", "/api/forgot-password"];
  const isPublicApi = publicApiPaths.some((p) => pathname.startsWith(p));

  if (!isLoggedIn && !isPublic && !isPublicApi) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
