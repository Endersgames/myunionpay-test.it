export async function GET() {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/health", {
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
