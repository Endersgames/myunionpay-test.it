import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { 
  ArrowLeft, Smartphone, Check, Wifi, MessageSquare, 
  Phone, Shield, ChevronRight, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

// API
import { simAPI } from "@/lib/api";

const OPERATORS = [
  "TIM", "Vodafone", "WindTre", "Iliad", "PosteMobile", 
  "ho. Mobile", "Kena Mobile", "Very Mobile", "Fastweb", "Altro"
];

export default function SimActivationPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    portability: true,
    current_operator: "",
    phone_to_port: "",
    fiscal_code: "",
    birth_date: "",
    birth_place: "",
    address: "",
    cap: "",
    city: "",
    document_type: "carta_identita",
    document_number: ""
  });

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await simAPI.activate(formData);
      toast.success("SIM attivata con successo!");
      await refreshUser();
      navigate("/sim-dashboard");
    } catch (err) {
      toast.error(err.message || "Errore nell'attivazione");
    }
    setLoading(false);
  };

  const validateStep1 = () => {
    if (formData.portability) {
      return formData.current_operator && formData.phone_to_port;
    }
    return true;
  };

  const validateStep2 = () => {
    return formData.fiscal_code && formData.birth_date && formData.birth_place &&
           formData.address && formData.cap && formData.city &&
           formData.document_type && formData.document_number;
  };

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <button 
          onClick={() => step > 1 ? setStep(step - 1) : navigate("/profile")}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-6 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{step > 1 ? "Indietro" : "Profilo"}</span>
        </button>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div 
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-[#2B7AB8]' : 'bg-[#E5E5E5]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Piano e Portabilità */}
      {step === 1 && (
        <div className="px-6 animate-slideUp">
          <h1 className="font-heading text-2xl font-bold mb-2 text-[#1A1A1A]">Attiva la tua SIM</h1>
          <p className="text-[#6B7280] mb-6">Scegli il tuo piano e le opzioni</p>

          {/* Piano */}
          <div className="bg-gradient-to-br from-[#2B7AB8] to-[#1E5F8A] rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium opacity-80">Piano Selezionato</span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">
                SMART X TE 240 TOP
              </span>
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-bold">15,99</span>
              <span className="text-xl">€/mese</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <Phone className="w-6 h-6 mx-auto mb-1 opacity-80" />
                <p className="text-sm font-semibold">Illimitati</p>
                <p className="text-xs opacity-70">Minuti</p>
              </div>
              <div className="text-center">
                <MessageSquare className="w-6 h-6 mx-auto mb-1 opacity-80" />
                <p className="text-sm font-semibold">100</p>
                <p className="text-xs opacity-70">SMS</p>
              </div>
              <div className="text-center">
                <Wifi className="w-6 h-6 mx-auto mb-1 opacity-80" />
                <p className="text-sm font-semibold">240 GB</p>
                <p className="text-xs opacity-70">Internet 4G/5G</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm opacity-80">
              <Shield className="w-4 h-4" />
              <span>Attivazione e spedizione gratuite</span>
            </div>
          </div>

          {/* Portabilità */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-[#1A1A1A]">Vuoi portare il tuo numero?</h3>
                <p className="text-sm text-[#6B7280]">Mantieni il numero attuale</p>
              </div>
              <Switch
                checked={formData.portability}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, portability: checked }))}
                data-testid="portability-switch"
              />
            </div>

            {formData.portability && (
              <div className="space-y-4 pt-4 border-t border-black/5 animate-slideUp">
                <div className="space-y-2">
                  <Label className="text-[#1A1A1A]">Operatore Attuale</Label>
                  <Select 
                    value={formData.current_operator} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, current_operator: v }))}
                  >
                    <SelectTrigger className="h-12 bg-white border-black/10 rounded-xl">
                      <SelectValue placeholder="Seleziona operatore" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[#1A1A1A]">Numero da Portare</Label>
                  <Input
                    type="tel"
                    placeholder="+39 333 1234567"
                    value={formData.phone_to_port}
                    onChange={handleChange("phone_to_port")}
                    className="h-12 bg-white border-black/10 rounded-xl text-[#1A1A1A]"
                    data-testid="phone-to-port-input"
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={() => setStep(2)}
            disabled={!validateStep1()}
            className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold disabled:opacity-50"
            data-testid="next-step-1"
          >
            Continua
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}

      {/* Step 2: Dati Personali */}
      {step === 2 && (
        <div className="px-6 animate-slideUp">
          <h1 className="font-heading text-2xl font-bold mb-2 text-[#1A1A1A]">I tuoi dati</h1>
          <p className="text-[#6B7280] mb-6">Inserisci i dati per l'attivazione</p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1A1A1A]">Codice Fiscale</Label>
              <Input
                placeholder="RSSMRA85M01H501Z"
                value={formData.fiscal_code}
                onChange={handleChange("fiscal_code")}
                className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A] uppercase"
                maxLength={16}
                data-testid="fiscal-code-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#1A1A1A]">Data di Nascita</Label>
                <Input
                  type="date"
                  value={formData.birth_date}
                  onChange={handleChange("birth_date")}
                  className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A]"
                  data-testid="birth-date-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#1A1A1A]">Luogo di Nascita</Label>
                <Input
                  placeholder="Roma"
                  value={formData.birth_place}
                  onChange={handleChange("birth_place")}
                  className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A]"
                  data-testid="birth-place-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[#1A1A1A]">Indirizzo di Residenza</Label>
              <Input
                placeholder="Via Roma 1"
                value={formData.address}
                onChange={handleChange("address")}
                className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A]"
                data-testid="address-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#1A1A1A]">CAP</Label>
                <Input
                  placeholder="00186"
                  value={formData.cap}
                  onChange={handleChange("cap")}
                  className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A]"
                  maxLength={5}
                  data-testid="cap-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#1A1A1A]">Città</Label>
                <Input
                  placeholder="Roma"
                  value={formData.city}
                  onChange={handleChange("city")}
                  className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A]"
                  data-testid="city-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[#1A1A1A]">Tipo Documento</Label>
              <Select 
                value={formData.document_type} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, document_type: v }))}
              >
                <SelectTrigger className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="carta_identita">Carta d'Identità</SelectItem>
                  <SelectItem value="patente">Patente</SelectItem>
                  <SelectItem value="passaporto">Passaporto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[#1A1A1A]">Numero Documento</Label>
              <Input
                placeholder="CA12345AB"
                value={formData.document_number}
                onChange={handleChange("document_number")}
                className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A] uppercase"
                data-testid="document-number-input"
              />
            </div>
          </div>

          <Button
            onClick={() => setStep(3)}
            disabled={!validateStep2()}
            className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold mt-6 disabled:opacity-50"
            data-testid="next-step-2"
          >
            Continua
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}

      {/* Step 3: Riepilogo e Conferma */}
      {step === 3 && (
        <div className="px-6 animate-slideUp">
          <h1 className="font-heading text-2xl font-bold mb-2 text-[#1A1A1A]">Conferma Ordine</h1>
          <p className="text-[#6B7280] mb-6">Verifica i dati prima di procedere</p>

          {/* Piano Riepilogo */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-4">
            <h3 className="font-semibold mb-3 text-[#1A1A1A]">Piano Scelto</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#2B7AB8]/10 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-[#2B7AB8]" />
                </div>
                <div>
                  <p className="font-semibold text-[#1A1A1A]">SMART X TE 240 TOP</p>
                  <p className="text-sm text-[#6B7280]">Illimitati + 100 SMS + 240 GB</p>
                </div>
              </div>
              <span className="font-mono text-xl font-bold text-[#2B7AB8]">15,99€</span>
            </div>
          </div>

          {/* Portabilità Riepilogo */}
          {formData.portability && (
            <div className="bg-[#E85A24]/10 rounded-2xl p-5 border border-[#E85A24]/20 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-5 h-5 text-[#E85A24]" />
                <h3 className="font-semibold text-[#1A1A1A]">Portabilità Numero</h3>
              </div>
              <p className="text-[#6B7280]">
                Da <span className="font-semibold">{formData.current_operator}</span>: {formData.phone_to_port}
              </p>
            </div>
          )}

          {/* Dati Personali Riepilogo */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
            <h3 className="font-semibold mb-3 text-[#1A1A1A]">Dati Personali</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Codice Fiscale</span>
                <span className="font-mono text-[#1A1A1A]">{formData.fiscal_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Indirizzo</span>
                <span className="text-[#1A1A1A]">{formData.address}, {formData.cap} {formData.city}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Documento</span>
                <span className="font-mono text-[#1A1A1A]">{formData.document_number}</span>
              </div>
            </div>
          </div>

          {/* Pagamento */}
          <div className="bg-[#2B7AB8]/5 rounded-2xl p-5 border border-[#2B7AB8]/20 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5 text-[#2B7AB8]" />
              <h3 className="font-semibold text-[#1A1A1A]">Pagamento</h3>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#6B7280]">Addebito dal tuo wallet UP</span>
              <span className="font-mono text-2xl font-bold text-[#2B7AB8]">15,99 UP</span>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-14 rounded-full bg-[#E85A24] hover:bg-[#D14E1A] text-lg font-semibold text-white"
            data-testid="confirm-activation"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Conferma e Attiva
              </>
            )}
          </Button>

          <p className="text-center text-xs text-[#6B7280] mt-4">
            Procedendo accetti i Termini e Condizioni del servizio
          </p>
        </div>
      )}
    </div>
  );
}
