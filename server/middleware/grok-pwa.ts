/**
 * Deployed-app (Nitro) half of the platform PWA chrome. Auto-registered as
 * global h3 middleware because vite.config.ts sets `serverDir: "./server"` —
 * without that option Nitro v3 never scans this directory.
 *
 * - `?install=1&platform=ios` on a document path → the Home Screen tutorial,
 *   bundled into the server build via `?raw` (the public/ directory is CDN
 *   static output on Vercel and not readable from the function).
 * - `/__grok/manifest.webmanifest` → per-app-named manifest (kept out of
 *   public/ so this dynamic response is the only one).
 * - Other HTML documents → stream-inject PWA + OG head tags at `</head>`.
 *   OG identity is baked via `virtual:grok-og-identity` at `vite build`
 *   (this function cannot read `src/lib/og/site.json` or `public/og.jpg`).
 *   This must be a middleware transforming `next()`: h3 discards the `response`
 *   runtime hook's return value, and `render:html` does not exist in Nitro v3.
 */
import installPageTemplate from "../../scripts/install-page.html?raw";
import { grokOgIdentity } from "virtual:grok-og-identity";
import {
  acceptsHtml,
  createHeadInjector,
  isDocumentPath,
  isInstallQuery,
  renderInstallPageHtml,
  renderWebManifest,
} from "../../scripts/grok-pwa-shared.mjs";

interface GrokPwaEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

/**
 * Vercel credit savers. Signed-out pages are shared from Vercel's cache for a
 * minute and served stale for ten more while they refresh, so repeat visits
 * and bots do not each run the server. Anyone signed in is never cached.
 */
const PUBLIC_PAGE_CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=600";
const SESSION_COOKIE = "grok-auth.session_token";

/** Addresses scanners try (WordPress, PHP, dotfiles). None exist in this app. */
const PROBE_PATH =
  /(^\/(wp-|wordpress|xmlrpc|phpmyadmin|pma|cgi-bin|vendor\/|\.(env|git|aws|ssh|svn|ht|DS_Store)))|\.(php\d?|asp|aspx|jsp|cgi|env|ini|sql|bak|old|swp)$/i;

function isSignedIn(event: GrokPwaEvent): boolean {
  return String(event.req.headers.get("cookie") ?? "").includes(SESSION_COOKIE);
}

function withPageCache(response: Response, event: GrokPwaEvent): Response {
  if (response.status >= 500) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", isSignedIn(event) ? "private, no-store" : PUBLIC_PAGE_CACHE);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function requestHost(event: GrokPwaEvent): string {
  return (
    event.req.headers.get("x-forwarded-host") ?? event.req.headers.get("host") ?? event.url.host
  );
}

function injectHeadStreaming(response: Response, host: string): Response {
  const injector = createHeadInjector({
    host,
    site: grokOgIdentity.site,
  });
  const transformed = response.body!.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        for (const out of injector.push(chunk)) controller.enqueue(out);
      },
      flush(controller) {
        for (const out of injector.flush()) controller.enqueue(out);
      },
    }),
  );
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(transformed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default async function grokPwaMiddleware(
  event: GrokPwaEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  // HEAD is how many bots check a page; it is cached exactly like GET.
  if (method !== "GET" && method !== "HEAD") return next();

  const path = event.url.pathname;

  if (PROBE_PATH.test(path)) {
    return new Response(method === "HEAD" ? null : "Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600, s-maxage=86400",
      },
    });
  }
  const urlWithQuery = path + event.url.search;

  if (path === "/__grok/manifest.webmanifest" || path === "/__grok/manifest.json") {
    return new Response(renderWebManifest(requestHost(event)), {
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
        "cache-control": "public, max-age=86400, s-maxage=86400",
      },
    });
  }

  if (
    isInstallQuery(urlWithQuery) &&
    isDocumentPath(path) &&
    acceptsHtml(event.req.headers.get("accept"))
  ) {
    const html = renderInstallPageHtml(installPageTemplate, {
      host: requestHost(event),
      url: urlWithQuery,
    });
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  }

  if (!isDocumentPath(path)) return next();

  const result = await next();
  if (!(result instanceof Response)) return result;
  const isHtml = String(result.headers.get("content-type") ?? "").includes("text/html");
  if (isHtml && result.body && !result.headers.get("content-encoding")) {
    return withPageCache(injectHeadStreaming(result, requestHost(event)), event);
  }
  return isHtml ? withPageCache(result, event) : result;
}
