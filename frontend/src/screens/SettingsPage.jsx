import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import {
  User, Gift, BarChart3, Shield, XCircle, LogOut, ChevronRight, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { profileAPI } from "@/lib/api";
import BottomNav from "@/components/BottomNav";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [treatmentStatus, setTreatmentStatus] = useState("Non attivo");

  useEffect(() => {
    profileAPI.getDataTreatment().then(data => {
      setTreatmentStatus(data.status || "Non attivo");
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const menuItems = [
    {
      icon: User,
      label: "Dati Personali",
      desc: "Nome, email, telefono, indirizzo",
      path: "/settings/personal",
    },
    {
      icon: Gift,
      label: "Le mie Gift Card",
      desc: "Gift card acquistate",
      path: "/settings/gift-cards",
    },
    {
      icon: BarChart3,
      label: "Trattamento dati",
      desc: "Gestisci le tue preferenze",
      path: "/settings/data-treatment",
      badge: treatmentStatus,
    },
    {
      icon: Shield,
      label: "Privacy Policy",
      desc: "Informativa sulla privacy",
      path: "/settings/privacy",
    },
    {
      icon: XCircle,
      label: "Rimuovi account",
      desc: "Elimina il tuo account",
      path: "/settings/delete-account",
      danger: true,
    },
  ];

  return (
    <div className="min-h-screen bg-white pb-safe">
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#2B7AB8]/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#2B7AB8]" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-[#1A1A1A]">Impostazioni</h1>
        </div>

        <div className="divide-y divide-black/5">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-4 py-4 hover:bg-[#F5F5F5]/50 transition-colors -mx-2 px-2 rounded-xl"
              data-testid={`settings-${item.path.split('/').pop()}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                item.danger ? "bg-red-50" : "bg-[#2B7AB8]/10"
              }`}>
                <item.icon className={`w-5 h-5 ${item.danger ? "text-red-500" : "text-[#2B7AB8]"}`} />
              </div>
              <div className="flex-1 text-left">
                <p className={`font-medium ${item.danger ? "text-red-500" : "text-[#1A1A1A]"}`}>
                  {item.label}
                </p>
                <p className="text-sm text-[#6B7280]">{item.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    item.badge === "Attivo"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {item.badge}
                  </span>
                )}
                <ChevronRight className="w-5 h-5 text-[#6B7280]" />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-10">
          <Button
            onClick={handleLogout}
            className="w-full h-14 rounded-full bg-red-500 hover:bg-red-600 text-white text-lg font-semibold"
            data-testid="settings-logout-btn"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Log Out
          </Button>
        </div>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
