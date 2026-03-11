import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Download } from "lucide-react";
import { useAuth } from "@/App";
import {
  clearQueuedPostRegistrationInstall,
  hasQueuedPostRegistrationInstall,
} from "@/lib/pwa-install-state";
import { usePwaInstall } from "@/lib/usePwaInstall";

const MYU_ICON = "/myu-icon.png";
const TIP_VISIBLE_MS = 4200;
const TIP_INITIAL_DELAY_MS = 7000;
const TIP_ROTATION_DELAY_MS = 18000;
const POST_REGISTRATION_AUTO_INSTALL_DELAY_MS = 900;
const WANDER_CONTAINER_WIDTH = 220;
const WANDER_TOP_GAP = 88;
const WANDER_BOTTOM_GAP = 116;
const WANDER_SIDE_GAP = 16;
const WANDER_MIN_STEP = 82;

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getBubbleFootprint(showInstallBubble, showTip) {
  if (showInstallBubble) {
    return 188;
  }

  if (showTip) {
    return 132;
  }

  return 86;
}

function getInitialWanderPosition(viewport, footprintHeight) {
  return {
    left: Math.max(
      WANDER_SIDE_GAP,
      viewport.width - WANDER_CONTAINER_WIDTH - WANDER_SIDE_GAP,
    ),
    top: Math.max(
      WANDER_TOP_GAP,
      viewport.height - footprintHeight - WANDER_BOTTOM_GAP,
    ),
    rotate: 0,
    durationMs: 0,
  };
}

function getNextWanderPosition(viewport, current, footprintHeight) {
  const maxLeft = Math.max(
    WANDER_SIDE_GAP,
    viewport.width - WANDER_CONTAINER_WIDTH - WANDER_SIDE_GAP,
  );
  const maxTop = Math.max(
    WANDER_TOP_GAP,
    viewport.height - footprintHeight - WANDER_BOTTOM_GAP,
  );

  let left = randomBetween(WANDER_SIDE_GAP, maxLeft);
  let top = randomBetween(WANDER_TOP_GAP, maxTop);

  if (current) {
    let attempts = 0;
    while (
      attempts < 6 &&
      Math.hypot(left - current.left, top - current.top) < WANDER_MIN_STEP
    ) {
      left = randomBetween(WANDER_SIDE_GAP, maxLeft);
      top = randomBetween(WANDER_TOP_GAP, maxTop);
      attempts += 1;
    }
  }

  return {
    left,
    top,
    rotate: randomBetween(-9, 9),
    durationMs: randomBetween(2400, 4300),
  };
}

const PAGE_CONFIGS = [
  {
    match: (pathname) => pathname === "/merchant-dashboard",
    behaviors: [
      { animation: "myu-wave", delay: 4000 },
      { animation: "myu-point-up", delay: 11000 },
      { animation: "myu-bounce", delay: 18000 },
    ],
    tips: [
      "Che c'e di nuovo nel locale oggi?",
      "Tutte cose buone, eh?",
      "Hai qualche piatto nuovo da far vedere?",
      "Mi raccomando: metti in risalto anche qualcosa di salutare.",
    ],
    installMessage: "Ti metto in Home? Cosi controlli menu e novita con un tap.",
  },
  {
    match: (pathname) => pathname === "/menu-manage",
    behaviors: [
      { animation: "myu-look-around", delay: 4000 },
      { animation: "myu-point-up", delay: 12000 },
    ],
    tips: [
      "Che c'e di nuovo tra i piatti?",
      "Un menu curioso si fa notare subito.",
      "Tutte cose buone, eh?",
      "Segnami bene anche le proposte piu leggere.",
    ],
    installMessage: "Ti metto in Home? Cosi aggiungi piatti nuovi senza perdere tempo.",
  },
  {
    match: (pathname) => pathname === "/marketplace" || pathname.startsWith("/merchant/"),
    behaviors: [
      { animation: "myu-look-around", delay: 3500 },
      { animation: "myu-peek-right", delay: 11000 },
      { animation: "myu-point-up", delay: 18500 },
    ],
    tips: [
      "Che c'e di nuovo qui intorno?",
      "Dai un occhio ai locali nuovi.",
      "Tutte cose buone, eh?",
      "Oggi scegliamo anche qualcosa di salutare?",
    ],
    installMessage: "Ti metto in Home? Cosi torni al volo su locali e novita.",
  },
  {
    match: (pathname) => pathname === "/notifications",
    behaviors: [
      { animation: "myu-peek-right", delay: 3000 },
      { animation: "myu-nod", delay: 12000 },
    ],
    tips: [
      "Vediamo se c'e qualcosa di nuovo?",
      "Apri prima quelle piu interessanti.",
      "Qui dentro potrebbe esserci una bella sorpresa.",
      "Occhio a quello che scade prima.",
    ],
    installMessage: "Ti metto in Home? Cosi le novita le vedi appena arrivano.",
  },
  {
    match: (pathname) =>
      pathname === "/profile" ||
      pathname === "/settings" ||
      pathname === "/dati-personali",
    behaviors: [
      { animation: "myu-nod", delay: 5000 },
      { animation: "myu-wave", delay: 15000 },
    ],
    tips: [
      "Sistemiamo due dettagli e torniamo in giro?",
      "Piu il profilo e preciso, meglio ti accompagno.",
      "Tienimi aggiornato e ti porto cose piu giuste.",
      "Un'occhiata alle preferenze ci sta sempre.",
    ],
    installMessage: "Ti metto in Home? Cosi mi ritrovi subito quando ti servo.",
  },
  {
    match: (pathname) => pathname === "/sim-dashboard",
    behaviors: [
      { animation: "myu-nod", delay: 5000 },
      { animation: "myu-peek-right", delay: 14000 },
    ],
    tips: [
      "Controlliamo tutto e poi torniamo in pista.",
      "Una verifica rapida e sei a posto.",
      "Meglio dare un'occhiata ora che inseguire problemi dopo.",
    ],
    installMessage: "Ti metto in Home? Cosi rientri qui in un attimo quando serve.",
  },
  {
    match: (pathname) => pathname.startsWith("/pay/"),
    behaviors: [
      { animation: "myu-nod", delay: 4500 },
      { animation: "myu-wave", delay: 15000 },
    ],
    tips: [
      "Controlla bene importo e destinatario, poi vai tranquillo.",
      "Un check in piu qui vale sempre.",
      "Fatto bene una volta e siamo a posto.",
    ],
    installMessage: "Ti metto in Home? Cosi il prossimo pagamento lo fai ancora piu veloce.",
  },
  {
    match: (pathname) => pathname === "/scanner",
    behaviors: [
      { animation: "myu-bounce", delay: 4000 },
      { animation: "myu-look-around", delay: 13000 },
    ],
    tips: [
      "Inquadra bene e al resto penso io.",
      "Ferma la mano un secondo e lo prendo subito.",
      "Se il codice e pulito, andiamo lisci.",
    ],
    installMessage: "Ti metto in Home? Cosi apri la scansione con un tocco.",
  },
  {
    match: (pathname) => pathname === "/dashboard",
    behaviors: [
      { animation: "myu-wave", delay: 5000 },
      { animation: "myu-peek-right", delay: 12000 },
      { animation: "myu-bounce", delay: 20000 },
    ],
    tips: [
      "Che c'e di nuovo oggi?",
      "Hai visto qualcosa di interessante in giro?",
      "Magari oggi salta fuori proprio il posto giusto.",
      "Tutte cose buone, eh?",
    ],
    installMessage: "Ti metto in Home? Cosi entri al volo ogni volta che vuoi curiosare.",
  },
];

const DEFAULT_PAGE_CONFIG = {
  behaviors: [
    { animation: "myu-wave", delay: 5000 },
    { animation: "myu-peek-right", delay: 14000 },
  ],
  tips: [
    "Che c'e di nuovo qui?",
    "Vediamo se troviamo qualcosa di curioso.",
    "Tutte cose buone, eh?",
    "Mi raccomando: oggi occhio anche a qualcosa di salutare.",
  ],
  installMessage: "Ti metto in Home? Un tap e mi ritrovi subito.",
};

function getPageConfig(pathname) {
  return PAGE_CONFIGS.find((config) => config.match(pathname)) || DEFAULT_PAGE_CONFIG;
}

export default function MyuMascot() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const {
    isInstalled,
    installing,
    triggerInstall,
    isIOS,
    nativePromptReady,
  } = usePwaInstall();
  const [currentAnim, setCurrentAnim] = useState("");
  const [showTip, setShowTip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [tipText, setTipText] = useState("");
  const [showInstallBubble, setShowInstallBubble] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [postRegistrationInstallPending, setPostRegistrationInstallPending] = useState(false);
  const [autoInstallAttempted, setAutoInstallAttempted] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [wanderPosition, setWanderPosition] = useState({
    left: 0,
    top: 0,
    rotate: 0,
    durationMs: 0,
  });
  const wanderPositionRef = useRef(wanderPosition);
  const wanderTimerRef = useRef(null);

  const hiddenPrefixes = ["/google-auth/", "/menu/", "/s/"];
  const hiddenPaths = ["/myu", "/login", "/register", "/", "/menu"];
  const isHidden =
    hiddenPaths.includes(location.pathname) ||
    hiddenPrefixes.some((prefix) => location.pathname.startsWith(prefix));
  const pageConfig = getPageConfig(location.pathname);
  const installFlowReady = isIOS || nativePromptReady;
  const bubbleFootprint = getBubbleFootprint(showInstallBubble, showTip);
  const movementPaused = showInstallBubble || showTip || isHovered;
  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;

  useEffect(() => {
    wanderPositionRef.current = wanderPosition;
  }, [wanderPosition]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!viewportWidth || !viewportHeight || isHidden) {
      return;
    }

    setWanderPosition((current) => {
      if (current.left === 0 && current.top === 0) {
        return getInitialWanderPosition(
          { width: viewportWidth, height: viewportHeight },
          bubbleFootprint,
        );
      }

      const maxLeft = Math.max(
        WANDER_SIDE_GAP,
        viewportWidth - WANDER_CONTAINER_WIDTH - WANDER_SIDE_GAP,
      );
      const maxTop = Math.max(
        WANDER_TOP_GAP,
        viewportHeight - bubbleFootprint - WANDER_BOTTOM_GAP,
      );

      return {
        ...current,
        left: clamp(current.left, WANDER_SIDE_GAP, maxLeft),
        top: clamp(current.top, WANDER_TOP_GAP, maxTop),
      };
    });
  }, [bubbleFootprint, isHidden, viewportHeight, viewportWidth]);

  useEffect(() => {
    if (!viewportWidth || !viewportHeight || isHidden || movementPaused) {
      if (wanderTimerRef.current) {
        window.clearTimeout(wanderTimerRef.current);
        wanderTimerRef.current = null;
      }
      return undefined;
    }

    let cancelled = false;

    const moveAgain = () => {
      if (cancelled) {
        return;
      }

      const next = getNextWanderPosition(
        { width: viewportWidth, height: viewportHeight },
        wanderPositionRef.current,
        bubbleFootprint,
      );
      setWanderPosition(next);
      setCurrentAnim(Math.random() > 0.5 ? "myu-bounce" : "myu-look-around");
      window.setTimeout(() => setCurrentAnim(""), 1600);

      wanderTimerRef.current = window.setTimeout(
        moveAgain,
        next.durationMs + randomBetween(1400, 3200),
      );
    };

    wanderTimerRef.current = window.setTimeout(
      moveAgain,
      randomBetween(1200, 2600),
    );

    return () => {
      cancelled = true;
      if (wanderTimerRef.current) {
        window.clearTimeout(wanderTimerRef.current);
        wanderTimerRef.current = null;
      }
    };
  }, [
    bubbleFootprint,
    isHidden,
    movementPaused,
    viewportHeight,
    viewportWidth,
  ]);

  useEffect(() => {
    if (!user?.id || isInstalled) {
      setPostRegistrationInstallPending(false);
      if (isInstalled) {
        clearQueuedPostRegistrationInstall();
      }
      return;
    }

    setPostRegistrationInstallPending(hasQueuedPostRegistrationInstall());
  }, [isInstalled, user?.id]);

  useEffect(() => {
    if (!postRegistrationInstallPending) {
      setAutoInstallAttempted(false);
      setInstallDismissed(false);
      setShowInstallBubble(false);
    }
  }, [postRegistrationInstallPending]);

  useEffect(() => {
    if (
      isHidden ||
      isInstalled ||
      installDismissed ||
      !postRegistrationInstallPending ||
      !user?.id ||
      !installFlowReady
    ) {
      setShowInstallBubble(false);
      return;
    }

    setShowInstallBubble(true);
  }, [
    installDismissed,
    installFlowReady,
    isHidden,
    isInstalled,
    postRegistrationInstallPending,
    user?.id,
  ]);

  useEffect(() => {
    if (
      isHidden ||
      isInstalled ||
      !postRegistrationInstallPending ||
      !user?.id ||
      !installFlowReady ||
      autoInstallAttempted
    ) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setAutoInstallAttempted(true);
      const installed = await triggerInstall();
      if (installed) {
        clearQueuedPostRegistrationInstall();
        setPostRegistrationInstallPending(false);
        setShowInstallBubble(false);
      }
    }, POST_REGISTRATION_AUTO_INSTALL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    autoInstallAttempted,
    installFlowReady,
    isHidden,
    isInstalled,
    postRegistrationInstallPending,
    triggerInstall,
    user?.id,
  ]);

  useEffect(() => {
    if (isHidden || showInstallBubble) {
      setShowTip(false);
      return undefined;
    }

    const timers = [];

    pageConfig.behaviors.forEach(({ animation, delay }) => {
      const timer = window.setTimeout(() => {
        setCurrentAnim(animation);
        window.setTimeout(() => setCurrentAnim(""), 2000);
      }, delay);
      timers.push(timer);
    });

    let tipIndex = 0;
    const showNextTip = () => {
      const nextTip = pageConfig.tips[tipIndex % pageConfig.tips.length];
      tipIndex += 1;
      setTipText(nextTip);
      setShowTip(true);
      const hideTimer = window.setTimeout(() => setShowTip(false), TIP_VISIBLE_MS);
      timers.push(hideTimer);
    };

    const initialTip = window.setTimeout(showNextTip, TIP_INITIAL_DELAY_MS);
    const recurringTips = window.setInterval(showNextTip, TIP_ROTATION_DELAY_MS);
    timers.push(initialTip, recurringTips);

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [isHidden, pageConfig, showInstallBubble]);

  const handleInstall = useCallback(async () => {
    const installed = await triggerInstall();
    if (installed) {
      clearQueuedPostRegistrationInstall();
      setPostRegistrationInstallPending(false);
      setShowInstallBubble(false);
      setInstallDismissed(true);
    }
  }, [triggerInstall]);

  const dismissInstall = useCallback(() => {
    setShowInstallBubble(false);
    setInstallDismissed(true);
    window.setTimeout(() => setInstallDismissed(false), 45000);
  }, []);

  if (isHidden || !viewport.width || !viewport.height) {
    return null;
  }

  return (
    <div
      className="fixed z-50 flex w-[220px] flex-col items-end gap-2 pointer-events-none"
      style={{
        left: `${wanderPosition.left}px`,
        top: `${wanderPosition.top}px`,
        transitionProperty: "left, top",
        transitionDuration: `${wanderPosition.durationMs}ms`,
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      data-testid="myu-wanderer"
    >
      {showInstallBubble && !isInstalled && (
        <div
          className="pointer-events-auto"
          style={{ animation: "myuFadeIn 0.3s ease" }}
          data-testid="myu-install-bubble"
        >
          <div className="bg-white rounded-2xl rounded-br-sm px-3 py-3 shadow-xl border border-[#2B7AB8]/15 max-w-[220px]">
            <p className="text-[11px] text-[#2B7AB8] font-bold uppercase tracking-[0.08em] mb-1">
              Ora siamo dentro
            </p>
            <p className="text-xs text-[#1A1A1A] leading-tight font-medium mb-2">
              {pageConfig.installMessage}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-1 bg-[#2B7AB8] text-white text-[10px] font-bold px-2 py-1.5 rounded-lg hover:bg-[#236699] transition-colors"
                data-testid="myu-install-btn"
                disabled={installing}
              >
                <Download className="w-3 h-3" />
                {installing ? "..." : "Metti in Home"}
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

      {showTip && !showInstallBubble && (
        <div
          className="pointer-events-none"
          style={{ animation: "myuFadeIn 0.3s ease, myuFadeOut 0.3s ease 3.7s forwards" }}
        >
          <div className="bg-white rounded-2xl rounded-br-sm px-3 py-2 shadow-lg border border-black/5 max-w-[200px]">
            <p className="text-xs text-[#1A1A1A] leading-tight">{tipText}</p>
          </div>
        </div>
      )}

      <div
        className="flex w-full justify-end"
        style={{
          transform: `rotate(${wanderPosition.rotate}deg)`,
          transitionProperty: "transform",
          transitionDuration: `${wanderPosition.durationMs}ms`,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <button
          onClick={() => navigate("/myu")}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`pointer-events-auto relative z-50 w-14 h-14 rounded-full shadow-lg overflow-hidden transition-all duration-300 ${
            isHovered ? "scale-110 shadow-xl" : ""
          } ${currentAnim}`}
          data-testid="myu-fab"
          style={{ background: "transparent" }}
        >
          <img src={MYU_ICON} alt="MYU" className="w-full h-full object-cover" />
          <span className="absolute inset-0 rounded-full border-2 border-[#4A90D9]/40 animate-ping opacity-30 pointer-events-none" />
        </button>
      </div>
    </div>
  );
}
