import LegacyRouteRenderer from "@/components/LegacyRouteRenderer";
import { getLegacyRoute, normalizeLegacyRouteKey } from "@/lib/legacy-route-config";
import { notFound, redirect } from "next/navigation";

const ASSET_PATH_RE = /\.[a-z0-9]+$/i;
export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const resolvedParams = await Promise.resolve(params);
  const rawSlug = resolvedParams?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug : typeof rawSlug === "string" ? [rawSlug] : [];
  const firstSegment = (slug[0] || "").trim();
  const routeKey = normalizeLegacyRouteKey(slug.join("/"));

  if (!routeKey) {
    redirect("/");
  }

  // Do not treat Next internals or asset-like paths as application routes.
  if (firstSegment === "_next" || ASSET_PATH_RE.test(routeKey)) {
    notFound();
  }

  const resolvedRoute = getLegacyRoute(routeKey);
  if (!resolvedRoute) {
    redirect("/");
  }

  return <LegacyRouteRenderer routeKey={resolvedRoute.key} />;
}
