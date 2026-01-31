import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Chrome, Smartphone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Detects if user is on a non-Chrome Android browser and prompts to open in Chrome
 */
export function useBrowserCheck() {
  const [showChromePrompt, setShowChromePrompt] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isChrome, setIsChrome] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const android = /android/.test(ua);
    const chrome = /chrome/.test(ua) && !/edge|edg|opr|opera/.test(ua);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
    
    setIsAndroid(android);
    setIsChrome(chrome);
    setIsStandalone(standalone);
    
    // Show Chrome prompt only on Android non-Chrome browsers, not in standalone mode
    if (android && !chrome && !standalone) {
      setShowChromePrompt(true);
    }
  }, []);

  const openInChrome = () => {
    const currentUrl = window.location.href;
    // Intent URL to open in Chrome
    const intentUrl = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end`;
    window.location.href = intentUrl;
  };

  const dismissPrompt = () => {
    setShowChromePrompt(false);
    sessionStorage.setItem('chrome-prompt-dismissed', 'true');
  };

  useEffect(() => {
    if (sessionStorage.getItem('chrome-prompt-dismissed')) {
      setShowChromePrompt(false);
    }
  }, []);

  return { showChromePrompt, isAndroid, isChrome, isStandalone, openInChrome, dismissPrompt };
}

export default function ChromePromptBanner() {
  const { showChromePrompt, openInChrome, dismissPrompt } = useBrowserCheck();

  if (!showChromePrompt) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-[#121212] rounded-3xl p-6 max-w-sm w-full border border-white/10 animate-slideUp">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center">
            <Chrome className="w-10 h-10 text-white" />
          </div>
        </div>
        
        <h2 className="font-heading text-2xl font-bold text-center mb-3">
          Apri con Chrome
        </h2>
        
        <p className="text-[#A1A1AA] text-center mb-6">
          Per la migliore esperienza e per installare l'app sulla Home, apri UpPay con Google Chrome.
        </p>

        <div className="space-y-3">
          <Button
            onClick={openInChrome}
            className="w-full h-14 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-lg font-semibold glow-primary"
          >
            <Chrome className="w-5 h-5 mr-2" />
            Apri in Chrome
          </Button>
          
          <Button
            onClick={dismissPrompt}
            variant="ghost"
            className="w-full text-[#A1A1AA] hover:text-white"
          >
            Continua comunque
          </Button>
        </div>

        <div className="mt-6 p-4 bg-[#050505] rounded-xl">
          <p className="text-xs text-[#A1A1AA] text-center">
            <Smartphone className="w-4 h-4 inline mr-1" />
            Con Chrome puoi installare UpPay come app e ricevere notifiche push
          </p>
        </div>
      </div>
    </div>
  );
}
