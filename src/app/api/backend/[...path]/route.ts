import { NextRequest, NextResponse } from "next/server";
import { resolveFunctionsApiUpstream } from "@/lib/server-api-upstream";

const REQUEST_TIMEOUT_MS = 30_000;
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);
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
  "content-length",
  "content-type",
  "etag",
  "last-modified",
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

  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  if (authorization) headers.set("authorization", authorization);
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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

    const upstreamResponse = await fetch(upstreamUrl, init);
    const body = await upstreamResponse.arrayBuffer();
    const response = new NextResponse(body, {
      status: upstreamResponse.status,
      headers: buildResponseHeaders(upstreamResponse.headers),
    });

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
