import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { profileAPI } from "@/lib/api";

export default function TrattamentoDatiPage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await profileAPI.getDataTreatment();
      setSections(data.sections || []);
    } catch (err) {
      toast.error("Errore nel caricamento");
    }
    setLoading(false);
  };

  const handleToggle = async (sectionKey, currentValue) => {
    const keyNum = sectionKey.replace("data_treatment_", "section_");
    const newValue = !currentValue;

    setSections(prev =>
      prev.map(s => s.key === sectionKey ? { ...s, authorized: newValue } : s)
    );

    try {
      await profileAPI.updateDataTreatment({ [keyNum]: newValue });
      toast.success(newValue ? "Autorizzazione concessa" : "Autorizzazione revocata");
    } catch (err) {
      setSections(prev =>
        prev.map(s => s.key === sectionKey ? { ...s, authorized: currentValue } : s)
      );
      toast.error("Errore nell'aggiornamento");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeCount = sections.filter(s => s.authorized).length;

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

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-[#2B7AB8]" />
          <h1 className="font-heading text-2xl font-bold text-[#1A1A1A]">Trattamento Dati</h1>
        </div>
        <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
          activeCount > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        }`}>
          {activeCount > 0 ? "Attivo" : "Non attivo"}
        </span>
      </div>

      <p className="text-sm text-[#6B7280] mb-6">
        Gestisci le autorizzazioni per il trattamento dei tuoi dati personali.
      </p>

      <div className="space-y-4">
        {sections.map((section) => (
          <div
            key={section.key}
            className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5"
            data-testid={`treatment-${section.key}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-[#1A1A1A] mb-2">{section.title}</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">{section.content}</p>
              </div>
              <button
                onClick={() => handleToggle(section.key, section.authorized)}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 mt-1 ${
                  section.authorized ? "bg-[#2B7AB8]" : "bg-gray-300"
                }`}
                data-testid={`switch-${section.key}`}
              >
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  section.authorized ? "translate-x-5" : "translate-x-0.5"
                }`} />
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-black/5">
              <span className={`text-xs font-medium ${
                section.authorized ? "text-green-600" : "text-gray-400"
              }`}>
                {section.authorized ? "Autorizzato" : "Non autorizzato"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
