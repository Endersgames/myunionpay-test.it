import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { authAPI } from "@/lib/api";

export default function RimuoviAccountPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [step, setStep] = useState("info"); // info | confirm | done
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await authAPI.deleteAccount();
      setStep("done");
      toast.success("Account disattivato");
    } catch (err) {
      toast.error(err.message || "Errore nella disattivazione");
    }
    setLoading(false);
  };

  const handleLogoutAfterDelete = () => {
    logout();
    navigate("/");
  };

  if (step === "done") {
    return (
      <div className="min-h-screen bg-white px-6 py-8">
        <div className="max-w-md mx-auto mt-12 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-4 text-[#1A1A1A]">
            Account Disattivato
          </h1>
          <p className="text-[#6B7280] mb-2">
            Il tuo account è stato disattivato immediatamente.
          </p>
          <p className="text-[#6B7280] mb-2">
            Tutti i dati saranno <strong>eliminati definitivamente dopo 30 giorni</strong>.
          </p>
          <p className="text-sm text-[#2B7AB8] mb-8">
            Puoi annullare l'eliminazione effettuando il login entro i 30 giorni.
          </p>
          <Button
            onClick={handleLogoutAfterDelete}
            className="w-full h-14 rounded-full bg-[#1A1A1A] hover:bg-[#333] text-white text-lg font-semibold"
            data-testid="logout-after-delete-btn"
          >
            Esci
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6 py-8">
      <button
        onClick={() => navigate("/settings")}
        className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-8 transition-colors"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Impostazioni</span>
      </button>

      <div className="max-w-md mx-auto">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-6">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>

        <h1 className="font-heading text-2xl font-bold mb-4 text-[#1A1A1A]">
          Rimuovi Account
        </h1>

        <div className="space-y-4 mb-8">
          <p className="text-[#6B7280]">
            Se rimuovi il tuo account:
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
              <span className="text-[#6B7280]">L'account viene <strong className="text-[#1A1A1A]">disattivato immediatamente</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
              <span className="text-[#6B7280]">Tutti i dati vengono <strong className="text-[#1A1A1A]">eliminati definitivamente dopo 30 giorni</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2B7AB8] mt-2 shrink-0" />
              <span className="text-[#6B7280]">Puoi <strong className="text-[#2B7AB8]">annullare l'eliminazione</strong> effettuando il login entro i 30 giorni</span>
            </li>
          </ul>
        </div>

        {step === "info" && (
          <Button
            onClick={() => setStep("confirm")}
            variant="outline"
            className="w-full h-14 rounded-full border-red-300 text-red-500 hover:bg-red-50 text-lg font-semibold"
            data-testid="delete-account-btn"
          >
            Procedi con l'eliminazione
          </Button>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-red-600 font-medium text-center">
                Sei sicuro di voler eliminare il tuo account?
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setStep("info")}
                variant="outline"
                className="flex-1 h-12 rounded-full"
                data-testid="cancel-delete-btn"
              >
                Annulla
              </Button>
              <Button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white"
                data-testid="confirm-delete-btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Elimina"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
