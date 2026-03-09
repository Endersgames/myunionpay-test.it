import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Download } from "lucide-react";
import { usePwaInstall } from "@/lib/usePwaInstall";

const MYU_ICON = "/myu-icon.png";

const MYU_BEHAVIORS = {
  "/dashboard": [
    { animation: "myu-wave", delay: 5000 },
    { animation: "myu-peek-right", delay: 12000 },
    { animation: "myu-bounce", delay: 20000 },
  ],
  "/marketplace": [
    { animation: "myu-look-around", delay: 4000 },
    { animation: "myu-point-up", delay: 15000 },
  ],
  "/profile": [{ animation: "myu-nod", delay: 6000 }],
  "/notifications": [{ animation: "myu-peek-right", delay: 3000 }],
  "/qr": [{ animation: "myu-bounce", delay: 5000 }],
};

const TIPS = {
  "/dashboard": "Psst... hai controllato i negozi oggi?",
  "/marketplace": "Qualcosa di interessante qui!",
  "/profile": "Il tuo profilo, tutto in ordine!",
  "/qr": "Scansiona per pagare!",
  "/notifications": "Novita per te!",
};

export default function MyuMascot() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isInstalled, installing, triggerInstall } = usePwaInstall();
  const [currentAnim, setCurrentAnim] = useState("");
  const [showTip, setShowTip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [tipText, setTipText] = useState("");
  const [showInstallBubble, setShowInstallBubble] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);

  // Hidden paths
  const hiddenPaths = ["/myu", "/login", "/register", "/", "/menu", "/s/"];
  const isHidden = hiddenPaths.some(
    (p) => location.pathname === p || location.pathname.startsWith("/s/") || location.pathname.startsWith("/menu/")
  );

  // Show install bubble periodically when not installed
  useEffect(() => {
    if (isHidden || isInstalled || installDismissed) return;
    const initial = setTimeout(() => setShowInstallBubble(true), 6000);
    const recurring = setInterval(() => {
      if (!installDismissed) setShowInstallBubble(true);
    }, 60000);
    return () => { clearTimeout(initial); clearInterval(recurring); };
  }, [location.pathname, isHidden, isInstalled, installDismissed]);

  // Page tips
  useEffect(() => {
    if (isHidden || showInstallBubble) return;

    const behaviors = MYU_BEHAVIORS[location.pathname] || MYU_BEHAVIORS["/dashboard"];
    const timers = [];

    behaviors.forEach(({ animation, delay }) => {
      const t = setTimeout(() => {
        setCurrentAnim(animation);
        setTimeout(() => setCurrentAnim(""), 2000);
      }, delay);
      timers.push(t);
    });

    const tipTimer = setTimeout(() => {
      if (showInstallBubble) return;
      const tip = TIPS[location.pathname];
      if (tip) {
        setTipText(tip);
        setShowTip(true);
        setTimeout(() => setShowTip(false), 4000);
      }
    }, 8000);
    timers.push(tipTimer);

    return () => timers.forEach(clearTimeout);
  }, [location.pathname, isHidden, showInstallBubble]);

  const handleInstall = useCallback(async () => {
    const result = await triggerInstall();
    if (result) {
      setShowInstallBubble(false);
      setInstallDismissed(true);
    }
  }, [triggerInstall]);

  const dismissInstall = useCallback(() => {
    setShowInstallBubble(false);
    setInstallDismissed(true);
    // Reset after 5 min
    setTimeout(() => setInstallDismissed(false), 300000);
  }, []);

  if (isHidden) return null;

  return (
    <>
      {/* Install bubble from MYU */}
      {showInstallBubble && !isInstalled && (
        <div
          className="fixed bottom-[108px] right-4 z-50"
          style={{ animation: "myuFadeIn 0.3s ease" }}
          data-testid="myu-install-bubble"
        >
          <div className="bg-white rounded-2xl rounded-br-sm px-3 py-3 shadow-xl border border-[#2B7AB8]/15 max-w-[210px]">
            <p className="text-xs text-[#1A1A1A] leading-tight font-medium mb-2">
              Installa myUup.com sulla Home per accesso rapido e cashback!
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-1 bg-[#2B7AB8] text-white text-[10px] font-bold px-2 py-1.5 rounded-lg hover:bg-[#236699] transition-colors"
                data-testid="myu-install-btn"
              >
                <Download className="w-3 h-3" />
                Installa
              </button>
              <button
                onClick={dismissInstall}
                className="text-[10px] text-[#6B7280] px-2 py-1.5 rounded-lg hover:bg-black/5 transition-colors"
                data-testid="myu-install-dismiss"
              >
                Dopo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard tip bubble */}
      {showTip && !showInstallBubble && (
        <div
          className="fixed bottom-[108px] right-4 z-50"
          style={{ animation: "myuFadeIn 0.3s ease, myuFadeOut 0.3s ease 3.5s forwards" }}
        >
          <div className="bg-white rounded-2xl rounded-br-sm px-3 py-2 shadow-lg border border-black/5 max-w-[180px]">
            <p className="text-xs text-[#1A1A1A] leading-tight">{tipText}</p>
          </div>
        </div>
      )}

      {/* MYU FAB */}
      <button
        onClick={() => navigate("/myu")}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full shadow-lg overflow-hidden transition-all duration-300 ${
          isHovered ? "scale-110 shadow-xl" : ""
        } ${currentAnim}`}
        data-testid="myu-fab"
        style={{ background: "transparent" }}
      >
        <img src={MYU_ICON} alt="MYU" className="w-full h-full object-cover" />
        <span className="absolute inset-0 rounded-full border-2 border-[#4A90D9]/40 animate-ping opacity-30 pointer-events-none" />
      </button>
    </>
  );
}
