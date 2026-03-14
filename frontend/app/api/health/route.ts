import { FASTAPI_BASE_URL } from "../_lib/fastapi";

export async function GET() {
  try {
    const res = await fetch(`${FASTAPI_BASE_URL}/api/health`, {
      cache: "no-store",
    });

    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (error) {
    return Response.json(
      { detail: "Upstream health check failed" },
      { status: 502 },
    );
  }
}
