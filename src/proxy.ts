import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Runs on every page request. None of this is authorization (pages and actions check
// access themselves, server-side). It:
// 1. sets a per-request nonce Content-Security-Policy, so only Next's own scripts run;
// 2. refreshes the Supabase session cookies so Server Components see a valid token;
// 3. records the requested path so sign-in can send people back to it;
// 4. gives signed-out visitors a random first-party analytics id, unless their browser
//    sends Global Privacy Control or Do Not Track.

function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  const https = (process.env.APP_URL ?? "").startsWith("https://");
  let supabase = "";
  try {
    supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    supabase = "";
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes carry per-event tints; nonces can't cover attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    // "Continue with Google" posts to a server action that redirects to Supabase, then Google.
    `form-action 'self' https://accounts.google.com${supabase ? ` ${supabase}` : ""}`,
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  requestHeaders.set("x-restix-path", `${request.nextUrl.pathname}${request.nextUrl.search}`.slice(0, 512));
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (process.env.AUTH_MODE !== "dev" && url && key) {
    const supabase = createServerClient(url, key, {
      cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          requestHeaders.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
        },
      },
    });
    try {
      // Verifies the JWT and refreshes it when it is about to expire.
      await supabase.auth.getClaims();
    } catch {
      // Auth provider unreachable: pages fall back to signed-out behaviour.
    }
  }

  response.headers.set("content-security-policy", csp);
  const optedOut = request.headers.get("sec-gpc") === "1" || request.headers.get("dnt") === "1";
  if (!optedOut && !request.cookies.has("restix_aid")) {
    response.cookies.set("restix_aid", crypto.randomUUID(), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180,
    });
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml|.*\\.(?:png|svg|jpg|jpeg|webp|ico|css|js)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
