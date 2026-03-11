import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { 
  ArrowLeft, Smartphone, Check, Wifi, MessageSquare, 
  Phone, Shield, ChevronRight, CreditCard, Gift, MapPin, Truck
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
    // Portability
    portability: false,
    current_operator: "",
    phone_to_port: "",
    // Personal data
    fiscal_code: "",
    birth_date: "",
    birth_place: "",
    // Shipping address
    shipping_name: user?.full_name || "",
    shipping_address: "",
    shipping_cap: "",
    shipping_city: "",
    shipping_province: "",
    shipping_phone: user?.phone || "",
    // Document
    document_type: "carta_identita",
    document_number: ""
  });

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await simAPI.activate({
        ...formData,
        address: formData.shipping_address,
        cap: formData.shipping_cap,
        city: formData.shipping_city
      });
      toast.success("Conto UP attivato con successo!");
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
           formData.document_type && formData.document_number;
  };

  const validateStep3 = () => {
    return formData.shipping_name && formData.shipping_address && 
           formData.shipping_cap && formData.shipping_city && 
           formData.shipping_province && formData.shipping_phone;
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
          {[1, 2, 3, 4].map((s) => (
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
          <h1 className="font-heading text-2xl font-bold mb-2 text-[#1A1A1A]">Attiva il Conto UP</h1>
          <p className="text-[#6B7280] mb-6">Card + SIM voce e dati in omaggio</p>

          {/* Card Preview */}
          <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] rounded-2xl p-5 mb-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-[#E85A24]" />
              <span className="text-sm font-medium text-[#E85A24]">Incluso nel Conto UP</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/10 rounded-xl p-4">
                <CreditCard className="w-6 h-6 text-[#E85A24] mb-2" />
                <p className="font-semibold">Card UP</p>
                <p className="text-xs text-white/60">Carta di debito fisica</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <Smartphone className="w-6 h-6 text-[#2B7AB8] mb-2" />
                <p className="font-semibold">SIM Omaggio</p>
                <p className="text-xs text-white/60">100GB + Min illimitati</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-white/60">Attivazione una tantum</span>
              <span className="font-mono text-2xl font-bold text-[#E85A24]">15,99€</span>
            </div>
          </div>

          {/* SIM Details */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
            <h3 className="font-semibold mb-3 text-[#1A1A1A]">La tua SIM include:</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <Phone className="w-6 h-6 mx-auto mb-1 text-[#2B7AB8]" />
                <p className="text-sm font-semibold text-[#1A1A1A]">Illimitati</p>
                <p className="text-xs text-[#6B7280]">Minuti</p>
              </div>
              <div className="text-center">
                <MessageSquare className="w-6 h-6 mx-auto mb-1 text-[#E85A24]" />
                <p className="text-sm font-semibold text-[#1A1A1A]">100</p>
                <p className="text-xs text-[#6B7280]">SMS</p>
              </div>
              <div className="text-center">
                <Wifi className="w-6 h-6 mx-auto mb-1 text-green-600" />
                <p className="text-sm font-semibold text-[#1A1A1A]">100 GB</p>
                <p className="text-xs text-[#6B7280]">Internet</p>
              </div>
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
          <p className="text-[#6B7280] mb-6">Dati per l'attivazione del conto</p>

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

      {/* Step 3: Indirizzo di Spedizione */}
      {step === 3 && (
        <div className="px-6 animate-slideUp">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#E85A24]/10 flex items-center justify-center">
              <Truck className="w-6 h-6 text-[#E85A24]" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-[#1A1A1A]">Spedizione</h1>
              <p className="text-[#6B7280]">Dove vuoi ricevere Card e SIM?</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1A1A1A]">Nome e Cognome</Label>
              <Input
                placeholder="Mario Rossi"
                value={formData.shipping_name}
                onChange={handleChange("shipping_name")}
                className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A]"
                data-testid="shipping-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#1A1A1A]">Indirizzo</Label>
              <Input
                placeholder="Via Roma 1, Scala A, Interno 5"
                value={formData.shipping_address}
                onChange={handleChange("shipping_address")}
                className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A]"
                data-testid="shipping-address-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#1A1A1A]">CAP</Label>
                <Input
                  placeholder="00186"
                  value={formData.shipping_cap}
                  onChange={handleChange("shipping_cap")}
                  className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A]"
                  maxLength={5}
                  data-testid="shipping-cap-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#1A1A1A]">Provincia</Label>
                <Input
                  placeholder="RM"
                  value={formData.shipping_province}
                  onChange={handleChange("shipping_province")}
                  className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A] uppercase"
                  maxLength={2}
                  data-testid="shipping-province-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[#1A1A1A]">Città</Label>
              <Input
                placeholder="Roma"
                value={formData.shipping_city}
                onChange={handleChange("shipping_city")}
                className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A]"
                data-testid="shipping-city-input"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#1A1A1A]">Telefono per il corriere</Label>
              <Input
                type="tel"
                placeholder="+39 333 1234567"
                value={formData.shipping_phone}
                onChange={handleChange("shipping_phone")}
                className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#1A1A1A]"
                data-testid="shipping-phone-input"
              />
            </div>
          </div>

          <div className="bg-[#2B7AB8]/10 rounded-xl p-4 mt-6 flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#2B7AB8] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-[#1A1A1A]">Spedizione gratuita</p>
              <p className="text-sm text-[#6B7280]">Consegna in 3-5 giorni lavorativi con corriere espresso</p>
            </div>
          </div>

          <Button
            onClick={() => setStep(4)}
            disabled={!validateStep3()}
            className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold mt-6 disabled:opacity-50"
            data-testid="next-step-3"
          >
            Continua
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}

      {/* Step 4: Riepilogo e Conferma */}
      {step === 4 && (
        <div className="px-6 animate-slideUp">
          <h1 className="font-heading text-2xl font-bold mb-2 text-[#1A1A1A]">Conferma Ordine</h1>
          <p className="text-[#6B7280] mb-6">Verifica i dati prima di procedere</p>

          {/* What you get */}
          <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] rounded-2xl p-5 mb-4 text-white">
            <h3 className="font-semibold mb-3">Il tuo Conto UP include:</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-[#E85A24]" />
                <span>Card UP fisica (spedizione gratuita)</span>
              </div>
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-[#2B7AB8]" />
                <span>SIM con 100GB, minuti illimitati, 100 SMS</span>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-green-500" />
                <span>Conto UP con IBAN italiano</span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-[#E85A24]" />
              <h3 className="font-semibold text-[#1A1A1A]">Indirizzo di Spedizione</h3>
            </div>
            <p className="text-[#1A1A1A]">{formData.shipping_name}</p>
            <p className="text-[#6B7280]">{formData.shipping_address}</p>
            <p className="text-[#6B7280]">{formData.shipping_cap} {formData.shipping_city} ({formData.shipping_province})</p>
            <p className="text-[#6B7280]">Tel: {formData.shipping_phone}</p>
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

          {/* Dati Personali */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
            <h3 className="font-semibold mb-3 text-[#1A1A1A]">Dati Personali</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Codice Fiscale</span>
                <span className="font-mono text-[#1A1A1A]">{formData.fiscal_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Nato a</span>
                <span className="text-[#1A1A1A]">{formData.birth_place}, {formData.birth_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Documento</span>
                <span className="font-mono text-[#1A1A1A]">{formData.document_number}</span>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="bg-[#2B7AB8]/10 rounded-2xl p-5 border border-[#2B7AB8]/20 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#1A1A1A]">Totale da pagare</p>
                <p className="text-sm text-[#6B7280]">Addebito dal wallet UP</p>
              </div>
              <span className="font-mono text-3xl font-bold text-[#2B7AB8]">15,99€</span>
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
                Attiva Conto UP
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
