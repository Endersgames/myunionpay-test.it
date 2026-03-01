import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { 
  ArrowLeft, Phone, MessageSquare, Wifi, 
  Calendar, User, Mail, CreditCard, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

// API
import { simAPI } from "@/lib/api";

// Circular Progress Component
const CircularProgress = ({ value, max, label, sublabel, color, isUnlimited }) => {
  const percentage = isUnlimited ? 100 : Math.min((value / max) * 100, 100);
  const remaining = isUnlimited ? "Illimitati" : `${(max - value).toFixed(max >= 100 ? 0 : 2)}`;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="#E5E5E5"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#1A1A1A]">
            {isUnlimited ? "∞" : remaining}
          </span>
          <span className="text-xs text-[#6B7280]">{sublabel}</span>
        </div>
      </div>
      <p className="mt-2 font-semibold text-[#1A1A1A]">{label}</p>
      {!isUnlimited && (
        <p className="text-xs text-[#6B7280]">
          {value.toFixed(max >= 100 ? 0 : 2)} / {max} usati
        </p>
      )}
    </div>
  );
};

export default function SimDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sim, setSim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    fetchSim();
  }, []);

  const fetchSim = async () => {
    try {
      const simData = await simAPI.getMySim();
      if (simData) {
        setSim(simData);
      } else {
        navigate("/sim-activation");
      }
    } catch (err) {
      console.error("Error fetching SIM:", err);
    }
    setLoading(false);
  };

  const simulateUsage = async () => {
    setSimulating(true);
    try {
      const result = await simAPI.useData();
      setSim(prev => ({
        ...prev,
        gb_used: result.gb_used,
        sms_used: result.sms_used
      }));
      toast.success("Consumo aggiornato!");
    } catch (err) {
      toast.error("Errore nell'aggiornamento");
    }
    setSimulating(false);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return "";
    // Format as +39 XXX XXX XXXX
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+39 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sim) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-safe">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2B7AB8] to-[#1E5F8A] text-white px-6 pt-8 pb-12 rounded-b-3xl">
        <button 
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Profilo</span>
        </button>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-sm">La tua linea mobile</p>
            <h1 className="font-heading text-2xl font-bold">{sim.plan_name}</h1>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-sm">Credito</p>
            <p className="font-mono text-2xl font-bold">0,10 €</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            sim.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
          }`}>
            {sim.status === 'active' ? 'Attiva' : 'In attivazione'}
          </span>
          {sim.portability_status === 'in_corso' && (
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#E85A24]">
              Portabilità in corso
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 -mt-6">
        {/* Usage Cards */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg text-[#1A1A1A]">I tuoi consumi</h2>
            <Button
              onClick={simulateUsage}
              disabled={simulating}
              variant="ghost"
              size="sm"
              className="text-[#2B7AB8]"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${simulating ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <CircularProgress
              value={0}
              max={1}
              label="Minuti"
              sublabel="minuti"
              color="#2B7AB8"
              isUnlimited={true}
            />
            <CircularProgress
              value={sim.sms_used}
              max={sim.sms_total}
              label="SMS"
              sublabel="SMS"
              color="#E85A24"
              isUnlimited={false}
            />
            <CircularProgress
              value={sim.gb_used}
              max={sim.gb_total}
              label="Internet"
              sublabel="GB"
              color="#10B981"
              isUnlimited={false}
            />
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B7280]">Scadenza offerta</span>
              <span className="font-semibold text-[#1A1A1A]">{formatDate(sim.expiry_date)}</span>
            </div>
          </div>
        </div>

        {/* Plan Details */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-lg mb-4 text-[#1A1A1A]">Il tuo piano include</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#2B7AB8]/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-[#2B7AB8]" />
              </div>
              <div>
                <p className="font-medium text-[#1A1A1A]">Minuti illimitati</p>
                <p className="text-sm text-[#6B7280]">Verso tutti i numeri nazionali</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E85A24]/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[#E85A24]" />
              </div>
              <div>
                <p className="font-medium text-[#1A1A1A]">100 SMS</p>
                <p className="text-sm text-[#6B7280]">Verso tutti i numeri nazionali</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Wifi className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-[#1A1A1A]">240 GB in 4G/5G</p>
                <p className="text-sm text-[#6B7280]">Navigazione ad alta velocità</p>
              </div>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-lg mb-4 text-[#1A1A1A]">Dati account</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Phone className="w-5 h-5 text-[#6B7280]" />
              </div>
              <div>
                <p className="text-sm text-[#6B7280]">Numero di telefono</p>
                <p className="font-mono font-semibold text-[#1A1A1A]">{formatPhoneNumber(sim.phone_number)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <User className="w-5 h-5 text-[#6B7280]" />
              </div>
              <div>
                <p className="text-sm text-[#6B7280]">Intestatario</p>
                <p className="font-semibold text-[#1A1A1A]">{user?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#6B7280]" />
              </div>
              <div>
                <p className="text-sm text-[#6B7280]">Email</p>
                <p className="font-semibold text-[#1A1A1A]">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#6B7280]" />
              </div>
              <div>
                <p className="text-sm text-[#6B7280]">Data attivazione</p>
                <p className="font-semibold text-[#1A1A1A]">{formatDate(sim.activation_date)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cost */}
        <div className="bg-gradient-to-r from-[#E85A24] to-[#D14E1A] rounded-2xl p-6 text-white mb-6">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-6 h-6" />
            <span className="font-semibold">Costo mensile</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">{sim.plan_price.toFixed(2)}</span>
            <span className="text-xl">€/mese</span>
          </div>
          <p className="text-white/80 text-sm mt-2">
            Prossimo rinnovo: {formatDate(sim.expiry_date)}
          </p>
        </div>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
