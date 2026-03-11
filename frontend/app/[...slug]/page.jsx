import LegacyRouteRenderer from "@/components/LegacyRouteRenderer";
import { legacyRoutes } from "@/lib/legacy-route-config";
import { notFound, redirect } from "next/navigation";

const ASSET_PATH_RE = /\.[a-z0-9]+$/i;
export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const slug = params?.slug || [];
  const routeKey = slug.join("/");
  const firstSegment = slug[0] || "";

  if (!routeKey) {
    redirect("/");
  }

  // Do not treat Next internals or asset-like paths as application routes.
  if (firstSegment === "_next" || ASSET_PATH_RE.test(routeKey)) {
    notFound();
  }

  if (!legacyRoutes[routeKey]) {
    redirect("/");
  }

  return <LegacyRouteRenderer routeKey={routeKey} />;
}
