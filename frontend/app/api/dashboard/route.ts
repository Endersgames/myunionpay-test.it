import { forwardFastApiGet } from "../_lib/fastapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return forwardFastApiGet({
    path: "/api/admin/dashboard",
    request,
  });
}
