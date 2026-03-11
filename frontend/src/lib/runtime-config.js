const stripTrailingSlashes = (value) => (value || "").replace(/\/+$/, "");

const isDevProxyHost = () =>
  typeof window !== "undefined" && window.location.hostname === "dev.myuup.com";

export function getApiBase() {
  const configured = stripTrailingSlashes(
    process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      "/api",
  );

  if (configured !== "/api") {
    return configured;
  }

  return isDevProxyHost() ? "/api/api" : configured;
}

export function getBackendBase() {
  const configured = stripTrailingSlashes(
    process.env.NEXT_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || "",
  );

  if (configured) {
    return configured;
  }

  return isDevProxyHost() ? "/api" : "";
}

export function withApiPath(pathname) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getApiBase()}${normalizedPath}`;
}

export function withBackendPath(pathname) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getBackendBase()}${normalizedPath}`;
}

export function getGoogleAuthStartUrl() {
  const configured = stripTrailingSlashes(
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_START_URL ||
      process.env.REACT_APP_GOOGLE_AUTH_START_URL ||
      "",
  );

  if (configured) {
    return configured;
  }

  return withApiPath("/auth/google/login");
}
