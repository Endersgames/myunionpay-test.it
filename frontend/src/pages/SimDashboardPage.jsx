import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { 
  ArrowLeft, Phone, MessageSquare, Wifi, 
  Calendar, User, Mail, CreditCard, RefreshCw, Copy, Eye, EyeOff
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
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="#E5E5E5"
            strokeWidth="6"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-[#1A1A1A]">
            {isUnlimited ? "∞" : remaining}
          </span>
          <span className="text-xs text-[#6B7280]">{sublabel}</span>
        </div>
      </div>
      <p className="mt-2 font-semibold text-sm text-[#1A1A1A]">{label}</p>
    </div>
  );
};

export default function SimDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sim, setSim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);

  // Fake card number based on phone
  const cardNumber = sim?.phone_number ? 
    `4532 ${sim.phone_number.slice(-8, -4) || '1234'} ${sim.phone_number.slice(-4) || '5678'} ${Math.floor(Math.random() * 9000) + 1000}` :
    '4532 •••• •••• ••••';

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
      month: 'short',
      year: 'numeric'
    });
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+39 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  };

  const copyCardNumber = () => {
    navigator.clipboard.writeText(cardNumber.replace(/\s/g, ''));
    toast.success("Numero carta copiato!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sim) return null;

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-safe">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] text-white px-6 pt-8 pb-6">
        <button 
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Profilo</span>
        </button>

        <div className="flex items-center justify-between mb-2">
          <h1 className="font-heading text-2xl font-bold">Conto UP</h1>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            sim.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
          }`}>
            {sim.status === 'active' ? 'Attivo' : 'In attivazione'}
          </span>
        </div>
        <p className="text-white/60 text-sm">{user?.full_name}</p>
      </div>

      {/* Card Section */}
      <div className="px-6 -mt-2">

      {/* SIM Usage */}
      <div className="px-6 mt-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">La tua SIM</h2>
              <p className="text-sm text-[#6B7280]">{formatPhoneNumber(sim.phone_number)}</p>
            </div>
            <Button
              onClick={simulateUsage}
              disabled={simulating}
              variant="ghost"
              size="sm"
              className="text-[#2B7AB8]"
            >
              <RefreshCw className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <CircularProgress
              value={0}
              max={1}
              label="Minuti"
              sublabel=""
              color="#2B7AB8"
              isUnlimited={true}
            />
            <CircularProgress
              value={sim.sms_used}
              max={sim.sms_total}
              label="SMS"
              sublabel={`/${sim.sms_total}`}
              color="#E85A24"
              isUnlimited={false}
            />
            <CircularProgress
              value={sim.gb_used}
              max={sim.gb_total}
              label="GB"
              sublabel={`/${sim.gb_total}`}
              color="#10B981"
              isUnlimited={false}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-[#6B7280]">Piano: {sim.plan_name}</span>
            <span className="font-semibold text-[#E85A24]">{sim.plan_price.toFixed(2)}€/mese</span>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="px-6 mt-6 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold mb-4 text-[#1A1A1A]">Dettagli Account</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#F5F5F5] flex items-center justify-center">
                <Phone className="w-5 h-5 text-[#6B7280]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#6B7280]">Numero</p>
                <p className="font-mono font-medium text-[#1A1A1A]">{formatPhoneNumber(sim.phone_number)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#F5F5F5] flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#6B7280]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#6B7280]">Email</p>
                <p className="font-medium text-[#1A1A1A]">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#F5F5F5] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#6B7280]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#6B7280]">Attivato il</p>
                <p className="font-medium text-[#1A1A1A]">{formatDate(sim.activation_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#F5F5F5] flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#6B7280]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#6B7280]">Prossimo rinnovo</p>
                <p className="font-medium text-[#1A1A1A]">{formatDate(sim.expiry_date)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
