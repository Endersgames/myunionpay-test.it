"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/App";
import { syncPushSubscription } from "@/lib/push-subscription";
import { toast } from "sonner";

export default function PwaBootstrap() {
  const { user } = useAuth();
  const audioContextRef = useRef(null);
  const audioArmedRef = useRef(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === "false") {
      return undefined;
    }

    if (!("serviceWorker" in navigator)) {
      return undefined;
    }

    let intervalId;
    let refreshing = false;
    let pushChannel;

    const AudioContextCtor =
      typeof window !== "undefined"
        ? window.AudioContext || window.webkitAudioContext
        : null;

    const ensureAudioContext = async () => {
      if (!AudioContextCtor) {
        return null;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextCtor();
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      return audioContextRef.current.state === "running" ? audioContextRef.current : null;
    };

    const playTone = (context, offset, frequency, duration, peakGain) => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + offset);

      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.04);
    };

    const armAudio = async () => {
      const context = await ensureAudioContext();
      if (!context || audioArmedRef.current) {
        return;
      }

      // A tiny warm-up chirp after a real user gesture makes later foreground beeps
      // much more reliable on mobile Chrome.
      playTone(context, 0, 660, 0.03, 0.008);
      audioArmedRef.current = true;
    };

    const showForegroundToast = (payload) => {
      const title = payload?.title || "myUup";
      const body = payload?.body || "Hai una nuova notifica";
      toast(title, {
        description: body,
        duration: 7000,
      });
    };

    const playPushFeedback = async (payload) => {
      if (document.visibilityState !== "visible") {
        return;
      }

      showForegroundToast(payload);

      if ("vibrate" in navigator) {
        navigator.vibrate([180, 80, 180, 80, 220]);
      }

      const context = await ensureAudioContext();
      if (!context) {
        return;
      }

      playTone(context, 0, 880, 0.1, 0.06);
      playTone(context, 0.16, 988, 0.1, 0.07);
      playTone(context, 0.34, 1174, 0.12, 0.08);
    };

    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    const handleServiceWorkerMessage = (event) => {
      if (!event.data || event.data.type !== "PUSH_RECEIVED") {
        return;
      }

      void playPushFeedback(event.data.data);
    };

    const handleBroadcastMessage = (event) => {
      if (!event.data || event.data.type !== "PUSH_RECEIVED") {
        return;
      }

      void playPushFeedback(event.data.data);
    };

    const registerWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/service-worker.js", {
          scope: "/",
          updateViaCache: "none",
        });

        registration.update();
        intervalId = window.setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) {
            return;
          }

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      } catch (error) {
        console.log("myUup.com SW registration failed:", error);
      }
    };

    const startRegistration = () => {
      void registerWorker();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    if ("BroadcastChannel" in window) {
      pushChannel = new BroadcastChannel("myuup-push");
      pushChannel.addEventListener("message", handleBroadcastMessage);
    }
    window.addEventListener("pointerdown", armAudio, { passive: true });
    window.addEventListener("click", armAudio, { passive: true });
    window.addEventListener("keydown", armAudio);
    window.addEventListener("touchstart", armAudio, { passive: true });
    startRegistration();

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }

      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
      if (pushChannel) {
        pushChannel.removeEventListener("message", handleBroadcastMessage);
        pushChannel.close();
      }
      window.removeEventListener("pointerdown", armAudio);
      window.removeEventListener("click", armAudio);
      window.removeEventListener("keydown", armAudio);
      window.removeEventListener("touchstart", armAudio);
    };
  }, []);

  useEffect(() => {
    if (
      process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === "false" ||
      !user?.id ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    let cancelled = false;
    const syncCurrentPushSubscription = async () => {
      try {
        if (cancelled) {
          return;
        }
        await syncPushSubscription();
      } catch (error) {
        console.log("myUup.com push sync failed:", error);
      }
    };

    void syncCurrentPushSubscription();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return null;
}
