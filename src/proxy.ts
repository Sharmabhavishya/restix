import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Runs on every page request. Two jobs, neither of them authorization (pages and
// actions check access themselves, server-side):
// 1. refresh the Supabase session cookies so Server Components see a valid token;
// 2. give signed-out visitors a random first-party analytics id, unless their browser
//    sends Global Privacy Control or Do Not Track.
export async function proxy(request: NextRequest) {
  // Lets server-side guards send people back to the page they asked for after sign-in.
  const requestHeaders = new Headers(request.headers);
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

  const optedOut = request.headers.get("sec-gpc") === "1" || request.headers.get("dnt") === "1";
  if (!optedOut && !request.cookies.has("restix_aid")) {
    response.cookies.set("restix_aid", crypto.randomUUID(), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml|.*\\.(?:png|svg|jpg|jpeg|webp|ico|css|js)$).*)"],
};
