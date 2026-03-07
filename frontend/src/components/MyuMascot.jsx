import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

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
  "/profile": [
    { animation: "myu-nod", delay: 6000 },
  ],
  "/notifications": [
    { animation: "myu-peek-right", delay: 3000 },
  ],
  "/qr": [
    { animation: "myu-bounce", delay: 5000 },
  ],
};

const TIPS = {
  "/dashboard": "Psst... hai controllato i negozi oggi?",
  "/marketplace": "Qualcosa di interessante qui!",
  "/profile": "Il tuo profilo, tutto in ordine!",
  "/qr": "Scansiona per pagare!",
  "/notifications": "Novità per te!",
};

export default function MyuMascot() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentAnim, setCurrentAnim] = useState("");
  const [showTip, setShowTip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [tipText, setTipText] = useState("");

  // Hide on MYU chat page or non-protected pages
  const hiddenPaths = ["/myu", "/login", "/register", "/", "/menu", "/s/"];
  const isHidden = hiddenPaths.some(p => location.pathname === p || location.pathname.startsWith("/s/") || location.pathname.startsWith("/menu/"));

  useEffect(() => {
    if (isHidden) return;

    const behaviors = MYU_BEHAVIORS[location.pathname] || MYU_BEHAVIORS["/dashboard"];
    const timers = [];

    behaviors.forEach(({ animation, delay }) => {
      const t = setTimeout(() => {
        setCurrentAnim(animation);
        setTimeout(() => setCurrentAnim(""), 2000);
      }, delay);
      timers.push(t);
    });

    // Show tip bubble occasionally
    const tipTimer = setTimeout(() => {
      const tip = TIPS[location.pathname];
      if (tip) {
        setTipText(tip);
        setShowTip(true);
        setTimeout(() => setShowTip(false), 4000);
      }
    }, 8000);
    timers.push(tipTimer);

    return () => timers.forEach(clearTimeout);
  }, [location.pathname, isHidden]);

  if (isHidden) return null;

  return (
    <>
      {/* Tip bubble */}
      {showTip && (
        <div
          className="fixed bottom-[108px] right-4 z-50 animate-fadeIn"
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
        className={`fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full shadow-lg overflow-hidden transition-all duration-300 ${isHovered ? "scale-110 shadow-xl" : ""} ${currentAnim}`}
        data-testid="myu-fab"
        style={{ background: "transparent" }}
      >
        <img
          src={MYU_ICON}
          alt="MYU"
          className="w-full h-full object-cover"
        />
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full border-2 border-[#4A90D9]/40 animate-ping opacity-30 pointer-events-none" />
      </button>
    </>
  );
}
