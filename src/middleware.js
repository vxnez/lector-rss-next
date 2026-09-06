import { NextResponse } from "next/server";

export function middleware(request) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/sources/:path*"],
};