const stripTrailingSlashes = (value) => (value || "").replace(/\/+$/, "");

export function getApiBase() {
  return stripTrailingSlashes(
    process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      "/api",
  );
}

export function getBackendBase() {
  const configured = stripTrailingSlashes(
    process.env.NEXT_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || "",
  );

  return configured || "";
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
