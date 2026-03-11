"use client";

import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
} from "next/navigation";

export const Link = forwardRef(function Link(
  { href, to, replace = false, scroll, prefetch, ...props },
  ref,
) {
  return (
    <NextLink
      ref={ref}
      href={href ?? to ?? "/"}
      replace={replace}
      scroll={scroll}
      prefetch={prefetch}
      {...props}
    />
  );
});

export const useParams = useNextParams;

export function useNavigate() {
  const router = useRouter();

  return useCallback(
    (to, options = {}) => {
      const notify = () => {
        window.setTimeout(() => {
          window.dispatchEvent(new Event("next-router-dom:navigate"));
        }, 0);
      };

      if (typeof to === "number") {
        if (to === -1) {
          router.back();
          notify();
          return;
        }

        if (to === 1) {
          router.forward();
          notify();
          return;
        }

        window.history.go(to);
        notify();
        return;
      }

      const destination = to || "/";

      if (/^https?:\/\//i.test(destination)) {
        if (options.replace) {
          window.location.replace(destination);
        } else {
          window.location.assign(destination);
        }
        return;
      }

      if (options.replace) {
        router.replace(destination, { scroll: options.scroll });
      } else {
        router.push(destination, { scroll: options.scroll });
      }

      notify();
    },
    [router],
  );
}

export function useLocation() {
  const pathname = usePathname() || "/";
  const [search, setSearch] = useState("");
  const [hash, setHash] = useState("");

  useEffect(() => {
    const updateLocation = () => {
      setSearch(window.location.search || "");
      setHash(window.location.hash || "");
    };

    updateLocation();
    window.addEventListener("hashchange", updateLocation);
    window.addEventListener("popstate", updateLocation);
    window.addEventListener("next-router-dom:navigate", updateLocation);

    return () => {
      window.removeEventListener("hashchange", updateLocation);
      window.removeEventListener("popstate", updateLocation);
      window.removeEventListener("next-router-dom:navigate", updateLocation);
    };
  }, []);

  return useMemo(
    () => ({
      pathname,
      search,
      hash,
      href: `${pathname}${search}${hash}`,
    }),
    [hash, pathname, search],
  );
}

export function useSearchParams() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [search, setSearch] = useState("");

  useEffect(() => {
    const updateSearch = () => setSearch(window.location.search || "");

    updateSearch();
    window.addEventListener("popstate", updateSearch);
    window.addEventListener("next-router-dom:navigate", updateSearch);

    return () => {
      window.removeEventListener("popstate", updateSearch);
      window.removeEventListener("next-router-dom:navigate", updateSearch);
    };
  }, [pathname]);

  const currentParams = useMemo(
    () => new URLSearchParams(search.replace(/^\?/, "")),
    [search],
  );

  const setSearchParams = useCallback(
    (nextInit, options = {}) => {
      const nextValue =
        typeof nextInit === "function"
          ? nextInit(new URLSearchParams(search.replace(/^\?/, "")))
          : nextInit;

      const nextParams = new URLSearchParams(nextValue || "");
      const queryString = nextParams.toString();
      const target = queryString ? `${pathname}?${queryString}` : pathname;

      if (options.replace) {
        router.replace(target, { scroll: options.scroll });
      } else {
        router.push(target, { scroll: options.scroll });
      }

      setSearch(queryString ? `?${queryString}` : "");
      window.setTimeout(() => {
        window.dispatchEvent(new Event("next-router-dom:navigate"));
      }, 0);
    },
    [pathname, router, search],
  );

  return [currentParams, setSearchParams];
}

export function Navigate({ to, replace = false, scroll }) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to, { replace, scroll });
  }, [navigate, replace, scroll, to]);

  return null;
}

export function BrowserRouter({ children }) {
  return children;
}

export function Routes({ children }) {
  return children;
}

export function Route() {
  return null;
}
