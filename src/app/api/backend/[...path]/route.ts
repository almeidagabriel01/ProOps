import { NextRequest, NextResponse } from "next/server";
import { resolveFunctionsApiUpstream } from "@/lib/server-api-upstream";

const REQUEST_TIMEOUT_MS = 30_000;
const SSE_TIMEOUT_MS = 300_000;
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);
const BODYLESS_RESPONSE_STATUSES = new Set([204, 205, 304]);
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const SAFE_RESPONSE_HEADERS = new Set([
  "cache-control",
  "content-disposition",
  "content-encoding",
  "content-length",
  "content-type",
  "etag",
  "last-modified",
  "location",
]);

export const dynamic = "force-dynamic";

function getRequestId(req: NextRequest): string {
  return req.headers.get("x-request-id") || crypto.randomUUID();
}

function buildUpstreamUrl(req: NextRequest, path: string[]): string {
  const { baseUrl } = resolveFunctionsApiUpstream(req);
  const upstreamUrl = new URL(
    `${baseUrl}/${path.map((segment) => encodeURIComponent(segment)).join("/")}`,
  );
  upstreamUrl.search = req.nextUrl.search;
  return upstreamUrl.toString();
}

function buildForwardHeaders(req: NextRequest, requestId: string): Headers {
  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const accept = req.headers.get("accept");
  const authorization = req.headers.get("authorization");
  const pdfGenerator = req.headers.get("x-pdf-generator");
  const tenantId = req.headers.get("x-tenant-id");
  const forwardedHost =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const forwardedProto =
    req.headers.get("x-forwarded-proto") ||
    req.nextUrl.protocol.replace(/:$/, "");

  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  if (authorization) headers.set("authorization", authorization);
  if (pdfGenerator) headers.set("x-pdf-generator", pdfGenerator);
  if (tenantId) headers.set("x-tenant-id", tenantId);
  if (forwardedHost) headers.set("x-forwarded-host", forwardedHost);
  if (forwardedProto) headers.set("x-forwarded-proto", forwardedProto);
  headers.set("x-request-id", requestId);

  return headers;
}

function buildResponseHeaders(source: Headers): Headers {
  const headers = new Headers();

  source.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalized)) {
      return;
    }
    if (SAFE_RESPONSE_HEADERS.has(normalized)) {
      headers.set(key, value);
    }
  });

  return headers;
}

async function proxyRequest(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = getRequestId(req);
  const { path } = await context.params;
  const upstream = resolveFunctionsApiUpstream(req);
  const upstreamUrl = buildUpstreamUrl(req, path);
  const acceptHeader = req.headers.get("accept") ?? "";
  const isSSE = acceptHeader.includes("text/event-stream");
  const timeoutMs = isSSE ? SSE_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const init: RequestInit = {
      method: req.method,
      headers: buildForwardHeaders(req, requestId),
      signal: controller.signal,
      redirect: "manual",
      cache: "no-store",
    };

    if (!BODYLESS_METHODS.has(req.method)) {
      init.body = await req.arrayBuffer();
      (init as RequestInit & { duplex?: "half" }).duplex = "half";
    }

    let upstreamResponse = await fetch(upstreamUrl, init);

    // Auto-retry specifically for local Firebase emulator cold starts
    if (upstream.target === "local" && upstreamResponse.status === 404) {
      const cloned = upstreamResponse.clone();
      const text = await cloned.text().catch(() => "");

      // If the emulator is up but functions are still loading, it returns this specific string
      if (text.includes("does not exist, valid functions are")) {
        let retries = 5;
        while (retries > 0) {
          console.warn(
            `[Proxy] Firebase emulator not fully loaded, retrying ${req.method} ${upstreamUrl}... (${retries} attempts left)`,
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));

          upstreamResponse = await fetch(upstreamUrl, init);
          if (upstreamResponse.status !== 404) break;

          const retryCloned = upstreamResponse.clone();
          const retryText = await retryCloned.text().catch(() => "");
          if (!retryText.includes("does not exist, valid functions are")) break;

          retries--;
        }
      }
    }

    const responseHeaders = buildResponseHeaders(upstreamResponse.headers);
    const upstreamContentType = upstreamResponse.headers.get("content-type") ?? "";
    const isSSEResponse = upstreamContentType.includes("text/event-stream");

    let response: NextResponse;
    if (BODYLESS_RESPONSE_STATUSES.has(upstreamResponse.status)) {
      response = new NextResponse(null, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    } else if (isSSEResponse) {
      response = new NextResponse(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    } else {
      response = new NextResponse(await upstreamResponse.arrayBuffer(), {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    response.headers.set("x-request-id", requestId);

    console.info(
      JSON.stringify({
        source: "api-backend-proxy",
        requestId,
        method: req.method,
        path: `/${path.join("/")}`,
        target: upstream.target,
        status: upstreamResponse.status,
        durationMs: Date.now() - startedAt,
      }),
    );

    return response;
  } catch (error) {
    const status =
      error instanceof DOMException && error.name === "AbortError" ? 504 : 502;

    console.error(
      JSON.stringify({
        source: "api-backend-proxy",
        requestId,
        method: req.method,
        path: `/${path.join("/")}`,
        target: upstream.target,
        status,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      }),
    );

    return NextResponse.json(
      {
        message:
          status === 504
            ? "Upstream API request timed out."
            : "Unable to reach upstream API.",
      },
      {
        status,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, context);
}

export function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, context);
}

export function PUT(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, context);
}

export function DELETE(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, context);
}

export function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, context);
}

export function OPTIONS(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, context);
}
