import { useState, useCallback, useEffect } from "react";

const INSTALL_PROMPT_WAIT_MS = 2500;

async function waitForInstallPrompt(timeoutMs = INSTALL_PROMPT_WAIT_MS) {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.__pwaInstallPrompt) {
    return window.__pwaInstallPrompt;
  }

  return new Promise((resolve) => {
    let timeoutId;

    const cleanup = () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };

    const handlePrompt = (event) => {
      event.preventDefault();
      window.__pwaInstallPrompt = event;
      cleanup();
      resolve(event);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt, { once: true });
    timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(window.__pwaInstallPrompt || null);
    }, timeoutMs);
  });
}

/**
 * Robust PWA install hook.
 * Uses the globally captured beforeinstallprompt from index.html.
 * Flow: 1 tap → browser native dialog → installed.
 */
export function usePwaInstall() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [nativePromptReady, setNativePromptReady] = useState(false);

  const isBrowser = typeof window !== "undefined" && typeof navigator !== "undefined";
  const isSecureContext = isBrowser && window.isSecureContext;
  const isIOS =
    isBrowser &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !window.MSStream;
  const isAndroid =
    isBrowser &&
    /android/.test(navigator.userAgent.toLowerCase());
  const hasNativeInstallFlow =
    isBrowser &&
    isSecureContext &&
    !isIOS &&
    "serviceWorker" in navigator;
  const isStandalone =
    isBrowser &&
    ((typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true);

  useEffect(() => {
    if (!isBrowser) {
      return undefined;
    }

    setIsInstalled(isStandalone || window.__pwaInstallOutcome === "installed");
    setNativePromptReady(Boolean(window.__pwaInstallPrompt));

    const handler = (e) => {
      e.preventDefault();
      window.__pwaInstallPrompt = e;
      setNativePromptReady(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const installed = () => {
      setIsInstalled(true);
      window.__pwaInstallPrompt = null;
      setNativePromptReady(false);
    };
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, [isBrowser, isStandalone]);

  const ensureInstallPrompt = useCallback(async () => {
    if (!isBrowser || !isSecureContext) {
      return null;
    }

    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        if (registration) {
          await registration.update();
        }
        await navigator.serviceWorker.ready;
      } catch (error) {
        console.log("[PWA] Service worker not ready for install prompt", error);
      }
    }

    const prompt = await waitForInstallPrompt();
    setNativePromptReady(Boolean(prompt));
    return prompt;
  }, [isBrowser, isSecureContext]);

  useEffect(() => {
    if (!hasNativeInstallFlow || window.__pwaInstallPrompt) {
      return undefined;
    }

    void ensureInstallPrompt();
    return undefined;
  }, [ensureInstallPrompt, hasNativeInstallFlow]);

  const triggerInstall = useCallback(async () => {
    if (isInstalled) {
      return true;
    }
    setInstalling(true);

    try {
      const prompt = window.__pwaInstallPrompt || (await ensureInstallPrompt());
      if (prompt) {
        setNativePromptReady(true);
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        window.__pwaInstallPrompt = null;
        setNativePromptReady(false);
        if (outcome === "accepted") {
          setIsInstalled(true);
          setInstalling(false);
          return true;
        }
        setInstalling(false);
        return false;
      }

      if (isIOS) {
        setShowIOSGuide(true);
        setInstalling(false);
        return false;
      }

      if ("getInstalledRelatedApps" in navigator) {
        const apps = await navigator.getInstalledRelatedApps();
        if (apps.length > 0) {
          setIsInstalled(true);
          setInstalling(false);
          return true;
        }
      }

      if (isAndroid) {
        console.warn("[PWA] Android install prompt unavailable");
        setInstalling(false);
        return false;
      }

      setShowIOSGuide(true);
    } catch (e) {
      console.error("[PWA] Install error:", e);
      if (isIOS) {
        setShowIOSGuide(true);
      }
    }
    setInstalling(false);
    return false;
  }, [ensureInstallPrompt, isAndroid, isInstalled, isIOS]);

  return {
    isInstalled,
    installing,
    triggerInstall,
    isIOS,
    isSecureContext,
    nativePromptReady,
    canInstall: isIOS || hasNativeInstallFlow,
    showIOSGuide,
    setShowIOSGuide,
  };
}
