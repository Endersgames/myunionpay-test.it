"use client";

import { useState } from "react";
import { BellRing, BellOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ensurePushSubscription,
  getNotificationPermissionState,
  supportsPushNotifications,
} from "@/lib/push-subscription";

export default function PostRegistrationNotificationsStep({ onContinue }) {
  const [submitting, setSubmitting] = useState(false);
  const [permission, setPermission] = useState(() => getNotificationPermissionState());

  const supported = supportsPushNotifications();
  const permissionDenied = permission === "denied";

  const handleEnableNotifications = async () => {
    if (!supported) {
      onContinue();
      return;
    }

    setSubmitting(true);
    try {
      const result = await ensurePushSubscription({ requestPermission: true });
      setPermission(result.permission);

      if (result.permission === "granted") {
        toast.success("Notifiche attivate");
        onContinue();
        return;
      }

      if (result.permission === "denied") {
        toast.error("Permesso negato. Attiva le notifiche dalle impostazioni del browser.");
        return;
      }

      toast.error("Conferma il consenso del browser per attivare le notifiche.");
    } catch (error) {
      toast.error(error?.message || "Impossibile attivare le notifiche");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 py-8">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[420px] h-[420px] bg-[#2B7AB8] opacity-5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-md mx-auto pt-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-[28px] bg-[#2B7AB8] text-white flex items-center justify-center mx-auto shadow-lg shadow-[#2B7AB8]/20 mb-5">
            {permissionDenied ? <BellOff className="w-10 h-10" /> : <BellRing className="w-10 h-10" />}
          </div>
          <h1 className="font-heading text-3xl font-bold mb-3 text-[#1A1A1A]">
            Attiva le notifiche
          </h1>
          <p className="text-[#6B7280]">
            Serve un ultimo passaggio per ricevere avvisi a schermo e un segnale sonoro quando arriva una notifica.
          </p>
        </div>

        <Card className="rounded-[28px] border-black/5 shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="rounded-2xl bg-[#F5F7FA] px-4 py-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2B7AB8]/10 text-[#2B7AB8] flex items-center justify-center shrink-0">
                <span className="font-semibold">1</span>
              </div>
              <div>
                <p className="font-semibold text-[#1A1A1A]">Tocca "Attiva notifiche"</p>
                <p className="text-sm text-[#6B7280]">Il browser aprira subito la richiesta di consenso.</p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#F5F7FA] px-4 py-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E85A24]/10 text-[#E85A24] flex items-center justify-center shrink-0">
                <span className="font-semibold">2</span>
              </div>
              <div>
                <p className="font-semibold text-[#1A1A1A]">Conferma nel browser</p>
                <p className="text-sm text-[#6B7280]">Abilita notifiche per vedere banner e provare anche il suono.</p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#F5F7FA] px-4 py-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1FA06A]/10 text-[#1FA06A] flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-[#1A1A1A]">
                  {permissionDenied ? "Permesso gia negato" : "Avvisi in primo piano"}
                </p>
                <p className="text-sm text-[#6B7280]">
                  {permissionDenied
                    ? "Il browser non puo richiedere di nuovo il consenso da solo. Puoi continuare e riattivarlo dalle impostazioni del sito."
                    : "Con permesso attivo registriamo subito il device per mostrare notifiche a schermo."}
                </p>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <Button
                type="button"
                onClick={handleEnableNotifications}
                disabled={submitting}
                className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-base font-semibold text-white"
                data-testid="enable-notifications-btn"
              >
                {submitting ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : permissionDenied ? (
                  "Riprova consenso"
                ) : (
                  "Attiva notifiche"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onContinue}
                className="w-full h-14 rounded-full border-black/10"
                data-testid="continue-without-notifications-btn"
              >
                Continua senza notifiche
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
