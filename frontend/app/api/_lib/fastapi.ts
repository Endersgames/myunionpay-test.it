import { NextResponse } from "next/server";

const FASTAPI_BASE_URL = "http://127.0.0.1:8000";
const BFF_HEADER_VALUE = "next";
const DEFAULT_TIMEOUT_MS = 8000;

type ForwardFastApiGetOptions = {
  path: string;
  request: Request;
  timeoutMs?: number;
};

function buildResponseHeaders(contentType?: string) {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.set("X-BFF", BFF_HEADER_VALUE);

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  return headers;
}

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: buildResponseHeaders("application/json"),
  });
}

function buildUpstreamHeaders(request: Request) {
  const headers = new Headers();
  headers.set("accept", "application/json");
  headers.set("x-bff", BFF_HEADER_VALUE);

  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");
  const requestId = request.headers.get("x-request-id");

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (cookie) {
    headers.set("cookie", cookie);
  }

  if (requestId) {
    headers.set("x-request-id", requestId);
  }

  return headers;
}

function normalizeErrorBody(bodyText: string, fallbackDetail: string) {
  if (!bodyText) {
    return { detail: fallbackDetail };
  }

  try {
    const parsed = JSON.parse(bodyText);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (_error) {
    // Fall back to a safe string detail below.
  }

  const detail = bodyText.trim();
  return { detail: detail || fallbackDetail };
}

async function buildSuccessResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "application/json";
  const bodyText = await response.text();

  if (!bodyText) {
    return new NextResponse(null, {
      status: response.status,
      headers: buildResponseHeaders(contentType),
    });
  }

  if (contentType.includes("application/json")) {
    return jsonResponse(JSON.parse(bodyText), response.status);
  }

  return new NextResponse(bodyText, {
    status: response.status,
    headers: buildResponseHeaders(contentType),
  });
}

async function buildErrorResponse(response: Response) {
  const bodyText = await response.text();

  if (response.status === 401) {
    return jsonResponse(normalizeErrorBody(bodyText, "Unauthorized"), 401);
  }

  if (response.status === 403) {
    return jsonResponse(normalizeErrorBody(bodyText, "Forbidden"), 403);
  }

  if (response.status === 404) {
    return jsonResponse(normalizeErrorBody(bodyText, "Not found"), 404);
  }

  if (response.status >= 500) {
    return jsonResponse({ detail: "Upstream service error" }, response.status);
  }

  return jsonResponse(
    normalizeErrorBody(bodyText, `Upstream request failed (${response.status})`),
    response.status,
  );
}

export async function forwardFastApiGet({
  path,
  request,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ForwardFastApiGetOptions) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${FASTAPI_BASE_URL}${path}`, {
      method: "GET",
      headers: buildUpstreamHeaders(request),
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.ok) {
      return await buildSuccessResponse(response);
    }

    return await buildErrorResponse(response);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return jsonResponse({ detail: "Upstream request timeout" }, 504);
    }

    return jsonResponse({ detail: "Upstream service unavailable" }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
}
