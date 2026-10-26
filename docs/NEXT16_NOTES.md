# Next.js 16.4.3 cheat sheet (ResTix)

Config: `cacheComponents: true`, `partialPrefetching: true`. Paths are relative to
`node_modules/next/dist/docs/01-app/` (called `$D`). React 19.3, Node >= 20.9, TS >= 5.1
(`$D/02-guides/upgrading/version-16.md`).

## 1. Proxy (formerly Middleware)
Sources: `$D/03-api-reference/03-file-conventions/proxy.md`, `middleware.md`, `02-guides/upgrading/version-16.md#middleware-to-proxy`

- `middleware.ts` is DEPRECATED; use `proxy.ts`. Export `proxy` (named) or a default export. One function per file.
- Location: project root, or inside `src/` if used (same level as `app/`). Here: `src/proxy.ts`.
- Runtime: Node.js only, not configurable; setting `runtime` in proxy throws. `edge` is not supported in proxy.
- Signature: `(request: NextRequest, event: NextFetchEvent)`; `NextProxy` type exists. `event.waitUntil()` for background work.
- No `matcher` = runs on EVERY request incl. `_next/static`, `_next/image`, `public/`. Matcher values must be constants.
- Server Actions are POSTs to the page route, so a matcher that excludes a path also skips proxy for actions there.
  Re-check auth inside every action; proxy is not the only defense.
- Auth guide: only optimistic cookie checks in proxy (no DB); real checks in the DAL
  (`02-guides/authentication.md#optimistic-checks-with-proxy-optional`).
- Renamed flag: `skipMiddlewareUrlNormalize` -> `skipProxyUrlNormalize`. Codemod: `npx @next/codemod@canary middleware-to-proxy .`
- Proxy buffers request bodies up to 10MB: `experimental.proxyClientMaxBodySize` (`05-config/01-next-config-js/proxyClientMaxBodySize.md`).
- `<Link>` prefetch through proxy rewrites needs extra config (`03-api-reference/02-components/link.md`, "Prefetching links in Proxy").

```ts
// src/proxy.ts  (adapted from proxy.md "Using Cookies" + authentication.md)
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const session = request.cookies.get('session')?.value
  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  const response = NextResponse.next()
  response.cookies.set({ name: 'x', value: 'y', path: '/' }) // Set-Cookie on the outgoing response
  return response
}
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico)$).*)'],
}
```
- Refreshing auth cookies: docs only give the generic `request.cookies` / `response.cookies` API above. A Supabase
  `@supabase/ssr` `updateSession` recipe is "not covered in bundled docs". Cookies can only be WRITTEN in proxy,
  Server Actions, Route Handlers, never during Server Component render (`04-functions/cookies.md`).

## 2. cacheComponents (Partial Prerendering is the default)
Sources: `05-config/01-next-config-js/cacheComponents.md`, `01-getting-started/08-caching.md`,
`02-guides/migrating-to-cache-components.md`, `02-guides/authentication-with-cache-components.md`,
`03-api-reference/01-directives/use-cache.md`, `use-cache-private.md`, `04-functions/cacheLife.md`, `connection.md`

What changes:
- Data fetching is dynamic by default; you opt INTO caching with `"use cache"`. Each route prerenders a static shell;
  runtime/uncached parts must be behind `<Suspense>` and stream in.
- Requires Node runtime; any `export const runtime` (even 'nodejs') must be removed.
- Segment configs `dynamic`, `revalidate`, `fetchCache`, `dynamicParams` are removed (`03-file-conventions/02-route-segment-config/index.md`).
  Exporting `dynamicParams` fails build: `Route segment config "dynamicParams" is not compatible with nextConfig.cacheComponents`.
  The guide says routes still exporting `dynamic`/`revalidate`/`fetchCache` "will error".
- `generateStaticParams` must return >= 1 param; `[]` is a build error (`empty-generate-static-params`).
- Navigation keeps hidden routes alive via React `<Activity>` (state preserved, effects cleaned up).

Request-time data (cookies/headers/searchParams/params/DB/fetch) goes in a component under `<Suspense>`:
```tsx
export default function Page() {
  return (<>
    <h1>Static shell</h1>
    <Suspense fallback={<p>Loading...</p>}><UserGreeting /></Suspense>
  </>)
}
async function UserGreeting() {              // reads cookies() => request-time
  const theme = (await cookies()).get('theme')?.value ?? 'light'
  return <p>{theme}</p>
}
```
- Missing Suspense: dev overlay "blocking-route" insight. `authentication-with-cache-components.md` states reading
  `cookies()` outside a boundary "is a build error". Treat as must-fix.
- `<Suspense>` alone does not make anything dynamic; purely synchronous work still prerenders.
- Keep awaits deep: don't `await params` or the session at layout top level; pass the promise down or await inside
  a Suspense child (`08-caching.md#maximizing-the-static-shell`).
- Nondeterministic values (`Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()`) during prerender are a BUILD
  ERROR, even with `instant = false`. Fix: `await connection()` (`next/server`) before them inside a Suspense'd component,
  or `"use cache"` the value, or move to a Client Component. `performance.now()` is exempt.
- Sync DB drivers (better-sqlite3) finish during prerender; call `connection()` first for per-request data.
  Async drivers (e.g. `postgres`) = uncached data: Suspense (stream) or `"use cache"`.
- `"use cache"` (file/function/component): args + captured vars become the cache key (stored in plain text; no secrets).
  Cannot read `cookies()/headers()/searchParams` inside (error `next-request-in-use-cache`; on dynamic routes may pass
  `next build` and fail at runtime). Read outside, pass values in. Cannot sit directly in a Route Handler body (use a helper).
  Pair every one with `cacheLife`. A short-lived nested cache (revalidate 0 / expire < 5 min, e.g. `'seconds'`) inside a
  `use cache` without explicit cacheLife fails the build. Timeout error: "Filling a cache during prerender timed out...".
- `"use cache: private"`: can read cookies()/headers()/searchParams (NOT `connection()`); cached in the browser only, never on
  the server; excluded from static shell. `"use cache: remote"`: durable shared server cache.
- cacheLife presets stale/revalidate/expire: default 5m/15m/never; seconds 30s/1s/1m; minutes 5m/1m/1h; hours 5m/1h/1d;
  days 5m/1d/1w; weeks 5m/1w/30d; max 5m/30d/1y. `stale` < 30s drops out of prefetch.
  Imports are stable: `import { cacheLife, cacheTag } from 'next/cache'`.
```tsx
async function getPosts() { 'use cache'; cacheLife('hours'); cacheTag('posts'); return db.posts() }
```
- Auth pattern (`authentication-with-cache-components.md`): `getSession()` reads cookies; wrap user lookup in
  `'use cache: private'`; pass only `userId` to an UNEXPORTED `'use cache'` function tagged `notes:${userId}`; invalidate
  with `updateTag` in the action.
- `export const dynamic = 'force-dynamic'`: NOT supported with cacheComponents. Migration guide: "Remove the config"
  (`migrating-to-cache-components.md#dynamic--force-dynamic`). There is no documented page-level "fully dynamic" switch;
  the model is: leave data uncached/runtime and wrap it in Suspense (use `await connection()` inside the Suspense'd
  subtree). A top-level uncached read with no Suspense yields an empty shell, which fails the non-empty static-shell
  validation unless the segment has `export const instant = false`. A dedicated whole-route-dynamic flag: not covered in bundled docs.
- `export const instant = false` (page/layout/slot): marks the segment as allowed to block; disables instant-navigation
  and non-empty-shell validation; does not make the route dynamic. Codemod: `npx @next/codemod@canary cache-components-instant-false ./src/app`.
  `instant` validation is dev-only today (`02-route-segment-config/instant.md`).
- `ensureStatic = 'auto' | 'shell' | 'prefetch' | 'navigation' | false` (16.4+) requires static output (`ensureStatic.md`).

## 3. Async request APIs (sync access REMOVED in 16)
Sources: `02-guides/upgrading/version-16.md#async-request-apis-breaking-change`, `03-file-conventions/page.md`, `route.md`, `04-functions/cookies.md`, `headers.md`
- Must `await`: `cookies()`, `headers()`, `draftMode()`, `params` (layout/page/route/default/opengraph-image/icon/apple-icon),
  `searchParams` (page only; not available in layouts).
- `opengraph-image`/`icon`: `params` and `id` are Promises (but `generateImageMetadata` still gets sync `params`).
  `sitemap({ id })`: `id` is `Promise<string>`.
- `PageProps<'/blog/[slug]'>`, `LayoutProps<...>`, `RouteContext<...>` are GLOBAL helper types (no import), generated by
  `next dev | build | typegen`.
```tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  const sp = await props.searchParams   // { [key: string]: string | string[] | undefined }
}
export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) { const { id } = await ctx.params }
```
- `cookies().set/delete` only in Server Actions / Route Handlers / proxy. `headers()` is read-only.
- Client `useSearchParams()` in a prerendered route needs a `<Suspense>` boundary, otherwise build error
  `missing-suspense-with-csr-bailout` (`04-functions/use-search-params.md`); dev won't warn.

## 4. Server Actions & forms
Sources: `02-guides/server-actions.md`, `02-guides/forms.md`, `03-directives/use-server.md`, `05-config/01-next-config-js/serverActions.md`,
`04-functions/{revalidateTag,updateTag,refresh,revalidatePath,redirect}.md`, `version-16.md#caching-apis`
- Actions are public POST endpoints: authenticate + authorize INSIDE every action; validate input.
- `useActionState(action, initialState)` -> `[state, formAction, pending]`; action signature becomes `(prevState, formData)`;
  `<form action={formAction}>` in a Client Component. `useFormStatus` (`react-dom`) for child submit buttons.
```ts
'use server'
export async function createUser(prev: { message: string }, formData: FormData) { /* ... */ return { message: 'ok' } }
// client: const [state, formAction, pending] = useActionState(createUser, { message: '' })
```
- `redirect()` throws `NEXT_REDIRECT`: call OUTSIDE try/catch. In actions it pushes history (303 for no-JS forms), elsewhere
  replaces. `permanentRedirect` = 308. `unstable_rethrow` exists for catch blocks.
- From `next/cache`:
  - `revalidateTag(tag, 'max')`: SECOND ARG REQUIRED (single-arg deprecated, TS error). Stale-while-revalidate.
    Actions + Route Handlers (webhooks: `{ expire: 0 }`). Not in Client Components or proxy.
  - `updateTag(tag)`: NEW, Server Actions ONLY (throws elsewhere). Immediate expire + refresh (read-your-writes).
  - `refresh()`: NEW, Server Actions only; refreshes the client router (uncached data).
  - `revalidatePath(path)`: Server Functions + Route Handlers. Not Client Components or proxy.
  - Calling any of them in an action clears the whole client router cache.
- CSRF: `Origin` is compared with Host / X-Forwarded-Host; mismatch rejected (missing Origin allowed with a warning; applies in prod).
  Extra hosts: `experimental.serverActions.allowedOrigins: ['my-proxy.com', '*.my-proxy.com']` (host[:port] only; `*` = one label; `**` = 1+ labels, leading only).
- Body limit: 1MB default; `experimental.serverActions.bodySizeLimit: '2mb'` (includes multipart overhead).
- Multi-instance/self-host: set stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

## 5. Route Handlers
Sources: `03-file-conventions/route.md`, `01-getting-started/15-route-handlers.md#with-cache-components`
- `app/**/route.ts`; methods GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS. Signature `(request: NextRequest, ctx)`; `ctx.params` is a Promise.
- Cookies: `(await cookies())` or `request.cookies`. Redirect: `NextResponse.redirect(new URL('/x', request.url))` or `redirect()`.
- Caching with cacheComponents: GET handlers follow the page model. Prerendered at build if they touch no uncached/runtime
  data (static JSON); request-time if they read `request.url/headers/cookies`, `cookies()`, `headers()`, DB, network, `Math.random`.
  Cache DB data via a `"use cache"` helper function (not inside the handler body).
- `revalidatePath/revalidateTag` allowed; `updateTag/refresh` not. `after()` allowed.

## 6. Error / status files
Sources: `03-file-conventions/{error,not-found,forbidden,unauthorized,loading}.md`, `04-functions/{forbidden,unauthorized}.md`, `05-config/01-next-config-js/authInterrupts.md`
- `error.tsx`: `'use client'`; props `{ error, retry }` in these docs (`retry()` re-fetches + re-renders; `reset()` only clears
  state, docs recommend `retry`). Example types `error: unknown`; narrow before reading `message/digest`. Does NOT catch
  errors from the same segment's layout/template (use `global-error.tsx`).
- `global-error.tsx`: `'use client'`, must render its own `<html><body>`; no `metadata` export; app CSS/theme not applied.
- `not-found.tsx` is rendered by `notFound()`: 404 if before streaming, else 200 + noindex. `global-not-found.js` is experimental:
  `experimental.globalNotFound: true`, must return full `<html>`.
- `forbidden()` / `unauthorized()` (403/401) + `forbidden.tsx` / `unauthorized.tsx`: require
  `experimental: { authInterrupts: true }`. Call in the render path and `await` any helper that calls them (un-awaited => unhandledRejection, no UI).
  Under Suspense status stays 200 (noindex added).
- `loading.tsx` = implicit Suspense around the segment page; fallback is prefetched. Parallel-route slots now REQUIRE `default.tsx` (build fails otherwise).

## 7. Metadata
Sources: `04-functions/generate-metadata.md#with-cache-components`, `03-file-conventions/01-metadata/{robots,sitemap,opengraph-image}.md`
- `export const metadata` or `generateMetadata({ params, searchParams })` (both Promises). Server Components only.
- With cacheComponents: runtime data or uncached fetch in `generateMetadata` while the rest of the page is fully prerenderable
  raises an ERROR naming the page/layout. Fix: `'use cache'` inside `generateMetadata`, or add a dynamic marker to the page:
  `<Suspense><Connection/></Suspense>` where `Connection` does `await connection(); return null`. Same for `generateViewport`.
- `app/robots.ts` returns `MetadataRoute.Robots`; `app/sitemap.ts` returns `MetadataRoute.Sitemap` (`generateSitemaps()` ids -> `id: Promise<string>`).
  Both are cached by default unless they use request-time APIs.
- `opengraph-image.tsx`: export `size`, `contentType`; default fn returns `new ImageResponse(<jsx/>, { ...size })` (`next/og`);
  props `params`/`id` are Promises. Size limits: OG 8MB, twitter 5MB (build fails above).

## 8. Fonts, images, env, server-only
- `next/font/google|local` (`01-getting-started/13-fonts.md`): `const geist = Geist({ subsets: ['latin'] })`, `className={geist.className}` on `<html>` in root layout.
- `next/image` v16 breaking defaults (`version-16.md#nextimage-changes`): local src with `?query` needs `images.localPatterns[].search`;
  `qualities` default `[75]` only; `imageSizes` drops 16; `minimumCacheTTL` 60s -> 4h; `maximumRedirects` unlimited -> 3;
  local-IP optimization blocked (`dangerouslyAllowLocalIP`); `images.domains` deprecated -> `remotePatterns`; `next/legacy/image` deprecated.
  Remote images need `width`/`height` or `fill` (`01-getting-started/12-images.md`).
- Env (`02-guides/environment-variables.md`): `.env*` is loaded from project ROOT only (NOT `src/`). Only `NEXT_PUBLIC_*` is inlined
  into client JS at BUILD time (frozen afterwards). All others are server-only.
- `import 'server-only'` at the top of DAL/session/db modules gives a build error if imported client-side (`02-guides/data-security.md`).
  `server-only` is already in package.json. `experimental.taint` for React taint APIs.

## 9. Deprecations / renames / misc
- middleware -> proxy. `next lint` REMOVED (run ESLint directly; `next build` no longer lints).
- `unstable_noStore` -> `connection()`. `unstable_cache` -> `"use cache"` (still works). `unstable_cacheLife/cacheTag` -> stable names.
  `unstable_rootParams` -> `next/root-params`. `experimental.dynamicIO`, `experimental.useCache`, `experimental.ppr`, `experimental_ppr` removed.
- `typedRoutes: true` is TOP-LEVEL stable (not `experimental.typedRoutes`); typed `Link` hrefs (`05-config/01-next-config-js/typedRoutes.md`).
- `after` from `next/server` is stable; not a request-time API (does not make a route dynamic; in static pages runs at build/revalidate);
  `cookies()/headers()` inside `after()` in a Server Component throw (OK in Route Handlers/Server Functions).
- Turbopack is default for dev and build. `next dev` outputs to `.next/dev` (dev + build can run concurrently).
- `partialPrefetching: true` (`05-config/.../partialPrefetching.md`, `02-guides/adopting-partial-prefetching.md`): `<Link>` default
  prefetch becomes one reusable App Shell per route (static + cached content); params/searchParams-specific content resolves after click.
  `<Link prefetch={true}>` fetches URL-specific cached content too (one server call per link, use sparingly). `prefetch={false}` disables.
  Prefetch only runs in production. Segment-level: `prefetch = 'partial'`. Routes reading cookies get a per-session shell.
  Requires `cacheComponents` or config validation throws.
- Browsers: Chrome/Edge/Firefox 111+, Safari 16.4+.

## 10. Testing
Sources: `02-guides/testing/{index,vitest,playwright}.md`, `02-guides/instant-navigation.md`
- Vitest does NOT support async Server Components; unit-test sync components only, use E2E for async ones.
- Vitest setup: `npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`;
  `vitest.config.mts` with `plugins: [tsconfigPaths(), react()]`, `test: { environment: 'jsdom' }`.
- Playwright: `npm init playwright`; test against production (`npm run build && npm run start`) or use `webServer`; set `baseURL`.
- Cache Components extra: `@next/playwright` `instant(page, async () => {...}, { baseURL })` asserts the UI visible before dynamic
  content streams. Works in `next dev`; for prod builds set `experimental.exposeTestingApiInProductionBuild` only for the test
  build (`EXPOSE_TESTING_API=1 next build`).
- Auth E2E recipes (storageState, login helpers): not covered in bundled docs.
