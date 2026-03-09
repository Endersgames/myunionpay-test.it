import { useState, useCallback, useEffect } from "react";

/**
 * Robust PWA install hook.
 * Uses the globally captured beforeinstallprompt from index.html.
 * Flow: 1 tap → browser native dialog → installed.
 */
export function usePwaInstall() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = typeof window !== "undefined" && (
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true
  );

  useEffect(() => {
    setIsInstalled(isStandalone || window.__pwaInstallOutcome === "installed");
    // Also listen for late-arriving prompt
    const handler = (e) => { e.preventDefault(); window.__pwaInstallPrompt = e; };
    window.addEventListener("beforeinstallprompt", handler);
    const installed = () => { setIsInstalled(true); window.__pwaInstallPrompt = null; };
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, [isStandalone]);

  const triggerInstall = useCallback(async () => {
    if (isInstalled) return true;
    setInstalling(true);

    try {
      // Android / Chrome / Edge: use captured prompt
      const prompt = window.__pwaInstallPrompt;
      if (prompt) {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        window.__pwaInstallPrompt = null;
        if (outcome === "accepted") {
          setIsInstalled(true);
          setInstalling(false);
          return true;
        }
        setInstalling(false);
        return false;
      }

      // iOS: show manual instructions
      if (isIOS) {
        setShowIOSGuide(true);
        setInstalling(false);
        return false;
      }

      // Fallback: try Chrome-specific approach
      if ("getInstalledRelatedApps" in navigator) {
        const apps = await navigator.getInstalledRelatedApps();
        if (apps.length > 0) {
          setIsInstalled(true);
          setInstalling(false);
          return true;
        }
      }

      // No prompt available - show iOS guide as last resort
      setShowIOSGuide(true);
    } catch (e) {
      console.error("[PWA] Install error:", e);
      setShowIOSGuide(true);
    }
    setInstalling(false);
    return false;
  }, [isInstalled, isIOS]);

  return { isInstalled, installing, triggerInstall, isIOS, showIOSGuide, setShowIOSGuide };
}
