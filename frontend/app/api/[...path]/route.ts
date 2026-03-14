import { forwardFastApiRequest } from "../_lib/fastapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function handle(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const normalizedPath = path[0] === "api" ? path.slice(1) : path;
  const pathname = normalizedPath.length ? `/${normalizedPath.join("/")}` : "";
  const search = new URL(request.url).search;

  return forwardFastApiRequest({
    path: `/api${pathname}${search}`,
    request,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function OPTIONS(request: Request, context: RouteContext) {
  return handle(request, context);
}
