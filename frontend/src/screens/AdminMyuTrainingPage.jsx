import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bot,
  BrainCircuit,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminAPI } from "@/lib/api";
import BottomNav from "@/components/BottomNav";

const defaultTrainingConfig = {
  training_prompt: "",
  response_rules: "",
  personality: "umano_empatico_proattivo",
  default_language: "it",
  response_max_sentences: 8,
  allow_action_suggestions: true,
  assistant_name: "MYU",
  voice_tone: "umano_empatico_positivo",
  formality_level: "adattiva",
  response_style: "conversazionale_adattivo",
  average_length: "adattiva_al_contesto",
  commercial_approach: "consulenziale_empatico",
  educational_approach: "storytelling_pratico",
  empathy: "alta",
  emoji_enabled: true,
  follow_rules: "",
  avoid_rules: "",
  human_mode_enabled: true,
  adaptive_style_enabled: true,
  curiosity_level: "alta",
  humor_style: "leggera_irriverenza",
  surprise_insights_enabled: true,
  proactive_enabled: true,
  proactive_followups_enabled: true,
  proactive_checkins_enabled: true,
  proactivity_boundaries: "gentile_non_invadente",
};

const defaultCoachingEngine = {
  enabled: true,
  coaching_prompt: "",
  objective_notes: "",
  escalation_policy: "balanced",
  auto_suggestions: true,
};

const expectedTrainingDocumentCategories = [
  {
    key: "valori_aziendali",
    label: "Valori Aziendali",
    description: "Mission, valori e cultura aziendale.",
  },
  {
    key: "piano_compensi",
    label: "Piano Compensi",
    description: "Regole compensi, premi e commissioni.",
  },
  {
    key: "company_profile",
    label: "Company Profile",
    description: "Presentazione ufficiale dell'azienda.",
  },
  {
    key: "ruoli_union_holidays",
    label: "Ruoli Union Holidays",
    description: "Ruoli, responsabilita e perimetro operativo.",
  },
  {
    key: "vademecum_otp",
    label: "Vademecum OTP",
    description: "Procedure OTP e linee guida operative.",
  },
  {
    key: "firma_digitale",
    label: "Firma Digitale",
    description: "Flussi e conformita per firma digitale.",
  },
  {
    key: "offerte_energia",
    label: "Offerte Energia",
    description: "Catalogo offerte energia aggiornato.",
  },
];

const defaultTrainingDocuments = {
  categories: expectedTrainingDocumentCategories.map((item) => ({
    ...item,
    total_versions: 0,
    has_active_document: false,
    active_document: null,
    versions: [],
  })),
  expected_categories: expectedTrainingDocumentCategories.length,
  categories_with_active_document: 0,
  total_versions: 0,
  updated_at: null,
};

const defaultKnowledgeReadiness = {
  active_documents: 0,
  active_chunks: 0,
  usable_documents: 0,
  usable_chunks: 0,
  active_categories: [],
  usable_categories: [],
  missing_categories: [],
  is_ready: false,
  has_compensation_plan: false,
};

const defaultTrainingUploadForm = {
  documentKey: expectedTrainingDocumentCategories[0].key,
  displayName: "",
  notes: "",
  setActive: true,
  file: null,
};

const logActionMeta = {
  file_uploaded: {
    label: "Upload",
    className: "text-emerald-700 border-emerald-200 bg-emerald-50",
  },
  file_deleted: {
    label: "Delete",
    className: "text-red-700 border-red-200 bg-red-50",
  },
  file_previewed: {
    label: "Preview",
    className: "text-blue-700 border-blue-200 bg-blue-50",
  },
  coaching_updated: {
    label: "Coaching",
    className: "text-violet-700 border-violet-200 bg-violet-50",
  },
  config_updated: {
    label: "Config",
    className: "text-amber-700 border-amber-200 bg-amber-50",
  },
  training_document_uploaded: {
    label: "Upload PDF",
    className: "text-emerald-700 border-emerald-200 bg-emerald-50",
  },
  training_document_updated: {
    label: "Update",
    className: "text-sky-700 border-sky-200 bg-sky-50",
  },
  training_document_status_updated: {
    label: "Status",
    className: "text-indigo-700 border-indigo-200 bg-indigo-50",
  },
  training_document_deleted: {
    label: "Delete PDF",
    className: "text-red-700 border-red-200 bg-red-50",
  },
  training_document_extracted: {
    label: "Extract",
    className: "text-emerald-700 border-emerald-200 bg-emerald-50",
  },
  training_document_extraction_failed: {
    label: "Extract ERR",
    className: "text-red-700 border-red-200 bg-red-50",
  },
};

const extractionStatusMeta = {
  pending: {
    label: "Pending",
    className: "text-[#6B7280] border-black/10 bg-white",
  },
  processing: {
    label: "Processing",
    className: "text-blue-700 border-blue-200 bg-blue-50",
  },
  success: {
    label: "Success",
    className: "text-emerald-700 border-emerald-200 bg-emerald-50",
  },
  failed: {
    label: "Failed",
    className: "text-red-700 border-red-200 bg-red-50",
  },
};

const formatNumber = (value, fractionDigits = 0) =>
  new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value || 0);

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const getExtractionMeta = (status) =>
  extractionStatusMeta[status] || {
    label: status || "N/A",
    className: "text-[#6B7280] border-black/10 bg-white",
  };

const normalizeTrainingConfig = (payload = {}) => ({
  ...defaultTrainingConfig,
  ...payload,
  response_max_sentences: Number(payload.response_max_sentences ?? 8) || 8,
  allow_action_suggestions: payload.allow_action_suggestions !== false,
  emoji_enabled: payload.emoji_enabled === true,
  human_mode_enabled: payload.human_mode_enabled !== false,
  adaptive_style_enabled: payload.adaptive_style_enabled !== false,
  surprise_insights_enabled: payload.surprise_insights_enabled !== false,
  proactive_enabled: payload.proactive_enabled !== false,
  proactive_followups_enabled: payload.proactive_followups_enabled !== false,
  proactive_checkins_enabled: payload.proactive_checkins_enabled !== false,
  curiosity_level: payload.curiosity_level || defaultTrainingConfig.curiosity_level,
  humor_style: payload.humor_style || defaultTrainingConfig.humor_style,
  proactivity_boundaries:
    payload.proactivity_boundaries || defaultTrainingConfig.proactivity_boundaries,
});

const normalizeCoachingEngine = (payload = {}) => ({
  ...defaultCoachingEngine,
  ...payload,
  enabled: payload.enabled !== false,
  auto_suggestions: payload.auto_suggestions !== false,
});

export default function AdminMyuTrainingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("documents");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingCoaching, setSavingCoaching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingDocumentId, setSavingDocumentId] = useState("");
  const [statusDocumentId, setStatusDocumentId] = useState("");
  const [deletingDocumentId, setDeletingDocumentId] = useState("");
  const [openingDocumentId, setOpeningDocumentId] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [trainingConfig, setTrainingConfig] = useState(defaultTrainingConfig);
  const [coachingEngine, setCoachingEngine] = useState(defaultCoachingEngine);
  const [configMeta, setConfigMeta] = useState({
    updated_at: null,
    updated_by: null,
  });
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [trainingDocuments, setTrainingDocuments] = useState(defaultTrainingDocuments);
  const [knowledgeReadiness, setKnowledgeReadiness] = useState(defaultKnowledgeReadiness);
  const [uploadForm, setUploadForm] = useState(defaultTrainingUploadForm);
  const [editingDocumentId, setEditingDocumentId] = useState("");
  const [editDocumentForm, setEditDocumentForm] = useState({
    displayName: "",
    notes: "",
  });
  const [chatStats, setChatStats] = useState(null);
  const [documentLogs, setDocumentLogs] = useState([]);
  const [previewFileId, setPreviewFileId] = useState("");
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    fetchWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statCards = useMemo(
    () => [
      {
        key: "total_messages",
        label: "Messaggi totali",
        value: formatNumber(chatStats?.total_messages),
        icon: Activity,
        accent: "text-[#2B7AB8]",
      },
      {
        key: "messages_last_24h",
        label: "Messaggi ultime 24h",
        value: formatNumber(chatStats?.messages_last_24h),
        icon: Clock,
        accent: "text-[#E85A24]",
      },
      {
        key: "active_users_last_7d",
        label: "Utenti attivi (7g)",
        value: formatNumber(chatStats?.active_users_last_7d),
        icon: Users,
        accent: "text-emerald-600",
      },
      {
        key: "total_sessions",
        label: "Sessioni chat",
        value: formatNumber(chatStats?.total_sessions),
        icon: BarChart3,
        accent: "text-[#1A1A1A]",
      },
    ],
    [chatStats],
  );

  const trainingCategories = useMemo(() => {
    if (Array.isArray(trainingDocuments?.categories) && trainingDocuments.categories.length) {
      return trainingDocuments.categories;
    }
    return defaultTrainingDocuments.categories;
  }, [trainingDocuments]);

  const applyWorkspaceData = (data) => {
    const config = data?.config || {};
    const myuConfig = data?.myu_config || config?.myu_config || {};
    const baseBehavior = myuConfig?.base_behavior || config?.base_behavior || {};
    const coaching = data?.coaching_engine || config?.coaching_engine || {};

    setTrainingConfig(
      normalizeTrainingConfig({
        training_prompt: config?.training_prompt || "",
        response_rules: config?.response_rules || "",
        personality: myuConfig?.personality || defaultTrainingConfig.personality,
        default_language: myuConfig?.default_language || defaultTrainingConfig.default_language,
        response_max_sentences:
          myuConfig?.response_max_sentences ?? defaultTrainingConfig.response_max_sentences,
        allow_action_suggestions:
          myuConfig?.allow_action_suggestions ?? defaultTrainingConfig.allow_action_suggestions,
        assistant_name: baseBehavior?.assistant_name || defaultTrainingConfig.assistant_name,
        voice_tone: baseBehavior?.voice_tone || defaultTrainingConfig.voice_tone,
        formality_level: baseBehavior?.formality_level || defaultTrainingConfig.formality_level,
        response_style: baseBehavior?.response_style || defaultTrainingConfig.response_style,
        average_length: baseBehavior?.average_length || defaultTrainingConfig.average_length,
        commercial_approach:
          baseBehavior?.commercial_approach || defaultTrainingConfig.commercial_approach,
        educational_approach:
          baseBehavior?.educational_approach || defaultTrainingConfig.educational_approach,
        empathy: baseBehavior?.empathy || defaultTrainingConfig.empathy,
        emoji_enabled: baseBehavior?.emoji_enabled ?? defaultTrainingConfig.emoji_enabled,
        follow_rules: baseBehavior?.follow_rules || "",
        avoid_rules: baseBehavior?.avoid_rules || "",
        human_mode_enabled:
          baseBehavior?.human_mode_enabled ?? defaultTrainingConfig.human_mode_enabled,
        adaptive_style_enabled:
          baseBehavior?.adaptive_style_enabled ?? defaultTrainingConfig.adaptive_style_enabled,
        curiosity_level: baseBehavior?.curiosity_level || defaultTrainingConfig.curiosity_level,
        humor_style: baseBehavior?.humor_style || defaultTrainingConfig.humor_style,
        surprise_insights_enabled:
          baseBehavior?.surprise_insights_enabled ?? defaultTrainingConfig.surprise_insights_enabled,
        proactive_enabled:
          baseBehavior?.proactive_enabled ?? defaultTrainingConfig.proactive_enabled,
        proactive_followups_enabled:
          baseBehavior?.proactive_followups_enabled ??
          defaultTrainingConfig.proactive_followups_enabled,
        proactive_checkins_enabled:
          baseBehavior?.proactive_checkins_enabled ??
          defaultTrainingConfig.proactive_checkins_enabled,
        proactivity_boundaries:
          baseBehavior?.proactivity_boundaries || defaultTrainingConfig.proactivity_boundaries,
      }),
    );
    setCoachingEngine(normalizeCoachingEngine(coaching));
    setConfigMeta({
      updated_at: config?.updated_at || null,
      updated_by: config?.updated_by || null,
    });

    const files = data?.knowledge_files || [];
    setKnowledgeFiles(files);
    const nextTrainingDocuments =
      data?.training_documents && Array.isArray(data.training_documents.categories)
        ? data.training_documents
        : defaultTrainingDocuments;
    setTrainingDocuments(nextTrainingDocuments);
    setKnowledgeReadiness(data?.knowledge_readiness || defaultKnowledgeReadiness);
    setUploadForm((prev) => {
      const categoryKeys = (nextTrainingDocuments.categories || []).map((item) => item.key);
      if (!categoryKeys.length) {
        return prev;
      }
      const safeDocumentKey = categoryKeys.includes(prev.documentKey)
        ? prev.documentKey
        : categoryKeys[0];
      return {
        ...prev,
        documentKey: safeDocumentKey,
      };
    });
    setChatStats(data?.chat_stats || null);

    const currentPreviewStillExists = files.some((file) => file.id === previewFileId);
    const nextPreviewFileId = currentPreviewStillExists ? previewFileId : files[0]?.id || "";
    setPreviewFileId(nextPreviewFileId);
    if (!nextPreviewFileId) {
      setPreviewData(null);
    }

    if (Array.isArray(data?.document_logs)) {
      setDocumentLogs(data.document_logs);
    }
  };

  const fetchWorkspace = async (options = {}) => {
    const { silent = false } = options;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await adminAPI.getMyuTrainingWorkspace();
      applyWorkspaceData(data);
      if (!data?.training_documents) {
        try {
          const docs = await adminAPI.getMyuTrainingDocuments();
          setTrainingDocuments(docs || defaultTrainingDocuments);
        } catch (_) {
          setTrainingDocuments(defaultTrainingDocuments);
        }
      }
    } catch (err) {
      try {
        const fallback = await adminAPI.getMyuTrainingOverview();
        applyWorkspaceData(fallback);
        const logsResponse = await adminAPI.getMyuDocumentLogs(120);
        setDocumentLogs(logsResponse?.logs || []);
        if (!fallback?.training_documents) {
          try {
            const docs = await adminAPI.getMyuTrainingDocuments();
            setTrainingDocuments(docs || defaultTrainingDocuments);
          } catch (_) {
            setTrainingDocuments(defaultTrainingDocuments);
          }
        }
      } catch (fallbackErr) {
        toast.error("Errore nel caricamento pagina MYU Training");
      }
    }

    setLoading(false);
    setRefreshing(false);
  };

  const refreshLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await adminAPI.getMyuDocumentLogs(150);
      setDocumentLogs(data?.logs || []);
    } catch (err) {
      toast.error("Errore nel caricamento log documenti");
    }
    setLogsLoading(false);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const payload = {
        training_prompt: trainingConfig.training_prompt,
        response_rules: trainingConfig.response_rules,
        personality: trainingConfig.personality,
        default_language: trainingConfig.default_language,
        response_max_sentences: Number(trainingConfig.response_max_sentences) || 8,
        allow_action_suggestions: trainingConfig.allow_action_suggestions,
        assistant_name: trainingConfig.assistant_name,
        voice_tone: trainingConfig.voice_tone,
        formality_level: trainingConfig.formality_level,
        response_style: trainingConfig.response_style,
        average_length: trainingConfig.average_length,
        commercial_approach: trainingConfig.commercial_approach,
        educational_approach: trainingConfig.educational_approach,
        empathy: trainingConfig.empathy,
        emoji_enabled: trainingConfig.emoji_enabled,
        follow_rules: trainingConfig.follow_rules,
        avoid_rules: trainingConfig.avoid_rules,
        human_mode_enabled: trainingConfig.human_mode_enabled,
        adaptive_style_enabled: trainingConfig.adaptive_style_enabled,
        curiosity_level: trainingConfig.curiosity_level,
        humor_style: trainingConfig.humor_style,
        surprise_insights_enabled: trainingConfig.surprise_insights_enabled,
        proactive_enabled: trainingConfig.proactive_enabled,
        proactive_followups_enabled: trainingConfig.proactive_followups_enabled,
        proactive_checkins_enabled: trainingConfig.proactive_checkins_enabled,
        proactivity_boundaries: trainingConfig.proactivity_boundaries,
      };
      const result = await adminAPI.updateMyuTrainingConfig(payload);
      if (result?.config) {
        const updatedConfig = result.config;
        const myuConfig = updatedConfig?.myu_config || {};
        const baseBehavior = myuConfig?.base_behavior || {};
        setConfigMeta({
          updated_at: updatedConfig?.updated_at || null,
          updated_by: updatedConfig?.updated_by || null,
        });
        setTrainingConfig(
          normalizeTrainingConfig({
            training_prompt: updatedConfig?.training_prompt || "",
            response_rules: updatedConfig?.response_rules || "",
            personality: myuConfig?.personality || trainingConfig.personality,
            default_language: myuConfig?.default_language || trainingConfig.default_language,
            response_max_sentences:
              myuConfig?.response_max_sentences ?? trainingConfig.response_max_sentences,
            allow_action_suggestions:
              myuConfig?.allow_action_suggestions ?? trainingConfig.allow_action_suggestions,
            assistant_name: baseBehavior?.assistant_name || trainingConfig.assistant_name,
            voice_tone: baseBehavior?.voice_tone || trainingConfig.voice_tone,
            formality_level: baseBehavior?.formality_level || trainingConfig.formality_level,
            response_style: baseBehavior?.response_style || trainingConfig.response_style,
            average_length: baseBehavior?.average_length || trainingConfig.average_length,
            commercial_approach:
              baseBehavior?.commercial_approach || trainingConfig.commercial_approach,
            educational_approach:
              baseBehavior?.educational_approach || trainingConfig.educational_approach,
            empathy: baseBehavior?.empathy || trainingConfig.empathy,
            emoji_enabled: baseBehavior?.emoji_enabled ?? trainingConfig.emoji_enabled,
            follow_rules: baseBehavior?.follow_rules || trainingConfig.follow_rules,
            avoid_rules: baseBehavior?.avoid_rules || trainingConfig.avoid_rules,
            human_mode_enabled:
              baseBehavior?.human_mode_enabled ?? trainingConfig.human_mode_enabled,
            adaptive_style_enabled:
              baseBehavior?.adaptive_style_enabled ?? trainingConfig.adaptive_style_enabled,
            curiosity_level: baseBehavior?.curiosity_level || trainingConfig.curiosity_level,
            humor_style: baseBehavior?.humor_style || trainingConfig.humor_style,
            surprise_insights_enabled:
              baseBehavior?.surprise_insights_enabled ?? trainingConfig.surprise_insights_enabled,
            proactive_enabled: baseBehavior?.proactive_enabled ?? trainingConfig.proactive_enabled,
            proactive_followups_enabled:
              baseBehavior?.proactive_followups_enabled ??
              trainingConfig.proactive_followups_enabled,
            proactive_checkins_enabled:
              baseBehavior?.proactive_checkins_enabled ??
              trainingConfig.proactive_checkins_enabled,
            proactivity_boundaries:
              baseBehavior?.proactivity_boundaries || trainingConfig.proactivity_boundaries,
          }),
        );
      }
      toast.success("Configurazione MYU aggiornata");
      refreshLogs();
    } catch (err) {
      toast.error("Errore nel salvataggio configurazione");
    }
    setSavingConfig(false);
  };

  const handleSaveCoaching = async () => {
    setSavingCoaching(true);
    try {
      const result = await adminAPI.updateMyuCoachingEngine(coachingEngine);
      if (result?.coaching_engine) {
        setCoachingEngine(normalizeCoachingEngine(result.coaching_engine));
      }
      toast.success("Coaching Engine aggiornato");
      refreshLogs();
    } catch (err) {
      toast.error("Errore nel salvataggio Coaching Engine");
    }
    setSavingCoaching(false);
  };

  const handleUploadTrainingDocument = async () => {
    if (!uploadForm.file) {
      toast.error("Seleziona un PDF da caricare");
      return;
    }
    if (
      uploadForm.file.type &&
      uploadForm.file.type !== "application/pdf" &&
      !uploadForm.file.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.error("Formato non valido: carica un PDF");
      return;
    }

    setUploading(true);
    try {
      await adminAPI.uploadMyuTrainingDocument({
        file: uploadForm.file,
        documentKey: uploadForm.documentKey,
        displayName: uploadForm.displayName,
        notes: uploadForm.notes,
        setActive: uploadForm.setActive,
      });
      toast.success("Documento training caricato");
      setUploadForm((prev) => ({
        ...prev,
        displayName: "",
        notes: "",
        setActive: true,
        file: null,
      }));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchWorkspace({ silent: true });
      await refreshLogs();
    } catch (err) {
      toast.error(err?.message || "Errore upload documento");
    }
    setUploading(false);
  };

  const startEditTrainingDocument = (document) => {
    setEditingDocumentId(document.id);
    setEditDocumentForm({
      displayName: document.display_name || "",
      notes: document.notes || "",
    });
  };

  const cancelEditTrainingDocument = () => {
    setEditingDocumentId("");
    setEditDocumentForm({
      displayName: "",
      notes: "",
    });
  };

  const handleSaveTrainingDocument = async (documentId) => {
    const nextName = editDocumentForm.displayName.trim();
    if (!nextName) {
      toast.error("Inserisci un nome documento valido");
      return;
    }

    setSavingDocumentId(documentId);
    try {
      await adminAPI.updateMyuTrainingDocument(documentId, {
        display_name: nextName,
        notes: editDocumentForm.notes,
      });
      toast.success("Documento aggiornato");
      cancelEditTrainingDocument();
      await fetchWorkspace({ silent: true });
      await refreshLogs();
    } catch (err) {
      toast.error(err?.message || "Errore aggiornamento documento");
    }
    setSavingDocumentId("");
  };

  const handleToggleTrainingDocumentStatus = async (document, nextActive) => {
    setStatusDocumentId(document.id);
    try {
      await adminAPI.setMyuTrainingDocumentStatus(document.id, nextActive);
      toast.success(nextActive ? "Versione attivata" : "Versione disattivata");
      await fetchWorkspace({ silent: true });
      await refreshLogs();
    } catch (err) {
      toast.error(err?.message || "Errore aggiornamento stato");
    }
    setStatusDocumentId("");
  };

  const handleDeleteTrainingDocument = async (document) => {
    const confirmed = window.confirm(
      `Confermi eliminazione di ${document.display_name || document.original_name} (${document.version_tag})?`,
    );
    if (!confirmed) return;

    setDeletingDocumentId(document.id);
    try {
      await adminAPI.deleteMyuTrainingDocument(document.id);
      toast.success("Documento eliminato");
      await fetchWorkspace({ silent: true });
      await refreshLogs();
    } catch (err) {
      toast.error(err?.message || "Errore eliminazione documento");
    }
    setDeletingDocumentId("");
  };

  const handleOpenTrainingDocument = async (document) => {
    if (!document?.id) return;
    setOpeningDocumentId(document.id);
    try {
      const { blob } = await adminAPI.downloadMyuTrainingDocument(document.id);
      const blobUrl = window.URL.createObjectURL(blob);
      const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        const a = window.document.createElement("a");
        a.href = blobUrl;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.click();
      }
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      toast.error(err?.message || "Errore apertura PDF");
    }
    setOpeningDocumentId("");
  };

  const handleLoadPreview = async (targetFileId = previewFileId) => {
    if (!targetFileId) {
      toast.error("Seleziona un documento");
      return;
    }
    setPreviewLoading(true);
    try {
      const data = await adminAPI.getMyuKnowledgePreview(targetFileId, 3000);
      setPreviewData(data);
    } catch (err) {
      setPreviewData(null);
      toast.error(err?.message || "Errore caricamento preview");
    }
    setPreviewLoading(false);
  };

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p>Accesso negato</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-safe" data-testid="admin-myu-training-page">
      <div className="px-6 pt-8 pb-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-8 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-[#E85A24]" />
            <div>
              <h1 className="font-heading text-2xl font-bold text-[#1A1A1A]">MYU Training</h1>
              <p className="text-sm text-[#6B7280]">
                Addestramento, file di conoscenza e statistiche chat
              </p>
            </div>
          </div>
          <Button
            onClick={() => fetchWorkspace({ silent: true })}
            variant="outline"
            className="h-9 rounded-lg border-black/10 bg-white text-[#1A1A1A]"
            data-testid="refresh-myu-training-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-[#2B7AB8]" />
            <h2 className="font-semibold text-[#1A1A1A]">Statistiche chat MYU</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.key} className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs uppercase tracking-wide text-[#6B7280]">{card.label}</p>
                    <Icon className={`w-4 h-4 ${card.accent}`} />
                  </div>
                  <p className="font-mono text-2xl font-bold text-[#1A1A1A]">{card.value}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4">
              <p className="text-xs uppercase tracking-wide text-[#6B7280] mb-1">Fallback rate (7g)</p>
              <p className="font-mono text-xl font-bold text-[#1A1A1A]">
                {formatNumber(chatStats?.fallback_rate_last_7d, 2)}%
              </p>
            </div>
            <div className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4">
              <p className="text-xs uppercase tracking-wide text-[#6B7280] mb-1">
                Costo medio stimato (7g)
              </p>
              <p className="font-mono text-xl font-bold text-[#1A1A1A]">
                ${formatNumber(chatStats?.avg_estimated_cost_last_7d, 6)}
              </p>
            </div>
            <div className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4">
              <p className="text-xs uppercase tracking-wide text-[#6B7280] mb-1">
                Media messaggi/sessione
              </p>
              <p className="font-mono text-xl font-bold text-[#1A1A1A]">
                {formatNumber(chatStats?.avg_messages_per_session, 2)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4 mb-4">
            <p className="text-sm font-semibold text-[#1A1A1A]">
              Knowledge readiness: {formatNumber(knowledgeReadiness?.usable_documents)} documenti usabili ·{" "}
              {formatNumber(knowledgeReadiness?.usable_chunks)} chunk usabili
            </p>
            {!knowledgeReadiness?.is_ready ? (
              <p className="text-xs text-red-600 mt-1">
                Knowledge non ancora pronta: verifica PDF leggibili o ri-carica versioni OCR-friendly.
              </p>
            ) : null}
            {Array.isArray(knowledgeReadiness?.missing_categories) &&
            knowledgeReadiness.missing_categories.length ? (
              <p className="text-xs text-[#B45309] mt-1">
                Categorie mancanti: {knowledgeReadiness.missing_categories.join(", ")}
              </p>
            ) : (
              <p className="text-xs text-emerald-700 mt-1">Copertura categorie completa</p>
            )}
          </div>

          <div className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4">
            <p className="text-sm font-semibold text-[#1A1A1A] mb-3">
              Intent principali (ultimi 7 giorni)
            </p>
            {chatStats?.top_intents_last_7d?.length ? (
              <div className="space-y-2">
                {chatStats.top_intents_last_7d.map((row) => (
                  <div key={`${row.domain}-${row.intent}`} className="flex items-center justify-between text-sm">
                    <p className="text-[#1A1A1A]">
                      <span className="font-medium">{row.intent}</span>
                      <span className="text-[#6B7280]"> · {row.domain}</span>
                    </p>
                    <p className="font-mono font-bold text-[#2B7AB8]">{formatNumber(row.count)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6B7280]">Nessun dato disponibile negli ultimi 7 giorni.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-[#E85A24]" />
            <h2 className="font-semibold text-[#1A1A1A]">Area MYU Training</h2>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-xl bg-[#F5F5F5] p-1">
              <TabsTrigger value="documents" className="rounded-lg data-[state=active]:bg-white">
                <FileText className="w-4 h-4 mr-2" />
                Documenti Training
              </TabsTrigger>
              <TabsTrigger value="coaching" className="rounded-lg data-[state=active]:bg-white">
                <BrainCircuit className="w-4 h-4 mr-2" />
                Coaching Engine
              </TabsTrigger>
              <TabsTrigger value="config" className="rounded-lg data-[state=active]:bg-white">
                <Settings2 className="w-4 h-4 mr-2" />
                Configurazione MYU
              </TabsTrigger>
              <TabsTrigger value="preview" className="rounded-lg data-[state=active]:bg-white">
                <Eye className="w-4 h-4 mr-2" />
                Preview Knowledge
              </TabsTrigger>
              <TabsTrigger value="logs" className="rounded-lg data-[state=active]:bg-white">
                <ClipboardList className="w-4 h-4 mr-2" />
                Log Documenti
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4">
                  <p className="text-xs uppercase tracking-wide text-[#6B7280] mb-1">
                    Categorie previste
                  </p>
                  <p className="font-mono text-xl font-bold text-[#1A1A1A]">
                    {formatNumber(trainingDocuments?.expected_categories)}
                  </p>
                </div>
                <div className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4">
                  <p className="text-xs uppercase tracking-wide text-[#6B7280] mb-1">
                    Categorie coperte
                  </p>
                  <p className="font-mono text-xl font-bold text-[#2B7AB8]">
                    {formatNumber(trainingDocuments?.categories_with_active_document)}
                  </p>
                </div>
                <div className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4">
                  <p className="text-xs uppercase tracking-wide text-[#6B7280] mb-1">Versioni totali PDF</p>
                  <p className="font-mono text-xl font-bold text-[#E85A24]">
                    {formatNumber(trainingDocuments?.total_versions)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4 mb-4">
                <p className="text-sm font-semibold text-[#1A1A1A] mb-3">Carica nuova versione PDF</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                      Categoria documento
                    </label>
                    <select
                      value={uploadForm.documentKey}
                      onChange={(e) =>
                        setUploadForm((prev) => ({ ...prev, documentKey: e.target.value }))
                      }
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    >
                      {trainingCategories.map((category) => (
                        <option key={category.key} value={category.key}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                      Nome visualizzato
                    </label>
                    <input
                      type="text"
                      value={uploadForm.displayName}
                      onChange={(e) =>
                        setUploadForm((prev) => ({ ...prev, displayName: e.target.value }))
                      }
                      placeholder="Es. Piano compensi 2026"
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="text-xs font-medium text-[#6B7280] mb-2 block">Note</label>
                  <textarea
                    value={uploadForm.notes}
                    onChange={(e) => setUploadForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    placeholder="Dettagli utili per il team admin..."
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                  />
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(event) =>
                      setUploadForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))
                    }
                    className="w-full md:flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] file:mr-3 file:rounded-md file:border-0 file:bg-[#2B7AB8]/10 file:px-2 file:py-1 file:text-[#2B7AB8]"
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-[#1A1A1A]">
                    <input
                      type="checkbox"
                      checked={uploadForm.setActive}
                      onChange={(e) =>
                        setUploadForm((prev) => ({ ...prev, setActive: e.target.checked }))
                      }
                    />
                    Imposta come versione attiva
                  </label>
                  <Button
                    onClick={handleUploadTrainingDocument}
                    disabled={uploading}
                    className="h-10 rounded-xl bg-[#E85A24] hover:bg-[#D14E1A] text-white md:min-w-[170px]"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? "Caricamento..." : "Upload PDF"}
                  </Button>
                </div>
                {uploadForm.file ? (
                  <p className="text-xs text-[#6B7280] mt-2">
                    File selezionato: {uploadForm.file.name} ({formatBytes(uploadForm.file.size)})
                  </p>
                ) : null}
              </div>

              <div className="space-y-3">
                {trainingCategories.map((category) => (
                  <div key={category.key} className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1A1A1A]">{category.label}</p>
                        <p className="text-xs text-[#6B7280]">{category.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#6B7280]">
                          Versioni: {formatNumber(category.total_versions)}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border ${
                            category.has_active_document
                              ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                              : "text-[#6B7280] border-black/10 bg-white"
                          }`}
                        >
                          {category.has_active_document ? "Attivo" : "Nessuna attiva"}
                        </span>
                      </div>
                    </div>

                    {!category.versions?.length ? (
                      <div className="rounded-lg border border-black/5 bg-white px-3 py-3 text-xs text-[#6B7280]">
                        Nessuna versione PDF caricata per questa categoria.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {category.versions.map((document) => {
                          const extractionMeta = getExtractionMeta(document.extraction_status);
                          return (
                            <div
                              key={document.id}
                              className="rounded-lg border border-black/5 bg-white px-3 py-3"
                            >
                              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <p className="text-sm font-medium text-[#1A1A1A]">
                                      {document.display_name || document.original_name}
                                    </p>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-black/10 bg-[#F5F5F5] text-[#1A1A1A]">
                                      {document.version_tag || `v${document.version_number}`}
                                    </span>
                                    <span
                                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                        document.is_active
                                          ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                                          : "text-[#6B7280] border-black/10 bg-[#F9F9F9]"
                                      }`}
                                    >
                                      {document.is_active ? "Attiva" : "Inattiva"}
                                    </span>
                                    <span
                                      className={`text-[11px] px-2 py-0.5 rounded-full border ${extractionMeta.className}`}
                                    >
                                      Estrazione {extractionMeta.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#6B7280]">
                                    {formatBytes(document.size_bytes)} · Caricato il{" "}
                                    {formatDate(document.uploaded_at)}
                                  </p>
                                  <p className="text-xs text-[#6B7280] mt-1">
                                    Ultima estrazione: {formatDate(document.extracted_at)}
                                  </p>
                                  {editingDocumentId === document.id ? (
                                    <div className="mt-3 space-y-2">
                                      <input
                                        type="text"
                                        value={editDocumentForm.displayName}
                                        onChange={(e) =>
                                          setEditDocumentForm((prev) => ({
                                            ...prev,
                                            displayName: e.target.value,
                                          }))
                                        }
                                        className="w-full rounded-lg border border-black/10 bg-[#F5F5F5] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                                      />
                                      <textarea
                                        value={editDocumentForm.notes}
                                        onChange={(e) =>
                                          setEditDocumentForm((prev) => ({
                                            ...prev,
                                            notes: e.target.value,
                                          }))
                                        }
                                        rows={2}
                                        className="w-full rounded-lg border border-black/10 bg-[#F5F5F5] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                                      />
                                      <div className="flex items-center gap-2">
                                        <Button
                                          onClick={() => handleSaveTrainingDocument(document.id)}
                                          disabled={savingDocumentId === document.id}
                                          className="h-9 rounded-lg bg-[#E85A24] hover:bg-[#D14E1A] text-white"
                                        >
                                          {savingDocumentId === document.id ? "Salvataggio..." : "Salva"}
                                        </Button>
                                        <Button
                                          onClick={cancelEditTrainingDocument}
                                          variant="outline"
                                          className="h-9 rounded-lg border-black/10 bg-white text-[#1A1A1A]"
                                        >
                                          Annulla
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-[#6B7280] mt-2">
                                      {document.notes || "Nessuna nota"}
                                    </p>
                                  )}
                                  {document.extraction_status === "failed" && document.extraction_error ? (
                                    <p className="text-xs text-red-600 mt-1">
                                      Errore estrazione: {document.extraction_error}
                                    </p>
                                  ) : null}
                                  <p className="text-xs text-[#6B7280] mt-1">
                                    KB sync: {document.kb_sync_status || "pending"} · chunk{" "}
                                    {formatNumber(document.knowledge_chunk_count || 0)}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                  <button
                                    onClick={() => handleOpenTrainingDocument(document)}
                                    disabled={openingDocumentId === document.id}
                                    className="text-xs text-[#2B7AB8] hover:underline disabled:opacity-60"
                                  >
                                    {openingDocumentId === document.id ? "Apertura..." : "Apri PDF"}
                                  </button>
                                  {editingDocumentId !== document.id ? (
                                    <button
                                      onClick={() => startEditTrainingDocument(document)}
                                      className="text-xs text-[#2B7AB8] hover:underline"
                                    >
                                      Modifica
                                    </button>
                                  ) : null}
                                  <button
                                    onClick={() =>
                                      handleToggleTrainingDocumentStatus(document, !document.is_active)
                                    }
                                    disabled={statusDocumentId === document.id}
                                    className="text-xs text-[#1A1A1A] hover:underline disabled:opacity-60"
                                  >
                                    {document.is_active ? "Disattiva" : "Attiva"}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTrainingDocument(document)}
                                    disabled={deletingDocumentId === document.id}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-60"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="coaching" className="mt-4">
              <div className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4 mb-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#1A1A1A]">Coaching Engine attivo</p>
                  <label className="inline-flex items-center gap-2 text-sm text-[#1A1A1A]">
                    <input
                      type="checkbox"
                      checked={coachingEngine.enabled}
                      onChange={(e) =>
                        setCoachingEngine((prev) => ({ ...prev, enabled: e.target.checked }))
                      }
                    />
                    {coachingEngine.enabled ? "ON" : "OFF"}
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                    Prompt coaching
                  </label>
                  <textarea
                    value={coachingEngine.coaching_prompt}
                    onChange={(e) =>
                      setCoachingEngine((prev) => ({ ...prev, coaching_prompt: e.target.value }))
                    }
                    rows={5}
                    className="w-full rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    placeholder="Definisci regole coaching per casi complessi..."
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                    Obiettivi coaching
                  </label>
                  <textarea
                    value={coachingEngine.objective_notes}
                    onChange={(e) =>
                      setCoachingEngine((prev) => ({ ...prev, objective_notes: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    placeholder="KPI e obiettivi per la qualita risposte..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                      Escalation policy
                    </label>
                    <select
                      value={coachingEngine.escalation_policy}
                      onChange={(e) =>
                        setCoachingEngine((prev) => ({
                          ...prev,
                          escalation_policy: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    >
                      <option value="balanced">Balanced</option>
                      <option value="strict">Strict</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2 flex items-center justify-between">
                    <p className="text-sm text-[#1A1A1A]">Auto suggestions</p>
                    <label className="inline-flex items-center gap-2 text-sm text-[#1A1A1A]">
                      <input
                        type="checkbox"
                        checked={coachingEngine.auto_suggestions}
                        onChange={(e) =>
                          setCoachingEngine((prev) => ({
                            ...prev,
                            auto_suggestions: e.target.checked,
                          }))
                        }
                      />
                      {coachingEngine.auto_suggestions ? "ON" : "OFF"}
                    </label>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSaveCoaching}
                disabled={savingCoaching}
                className="mt-4 h-11 rounded-xl bg-[#E85A24] hover:bg-[#D14E1A] text-white"
                data-testid="save-coaching-engine-btn"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingCoaching ? "Salvataggio..." : "Salva Coaching Engine"}
              </Button>
            </TabsContent>

            <TabsContent value="config" className="mt-4">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                    Prompt di addestramento
                  </label>
                  <textarea
                    value={trainingConfig.training_prompt}
                    onChange={(e) =>
                      setTrainingConfig((prev) => ({ ...prev, training_prompt: e.target.value }))
                    }
                    rows={5}
                    className="w-full rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    placeholder="Linee guida principali per MYU..."
                    data-testid="training-prompt-input"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                    Regole di risposta
                  </label>
                  <textarea
                    value={trainingConfig.response_rules}
                    onChange={(e) =>
                      setTrainingConfig((prev) => ({ ...prev, response_rules: e.target.value }))
                    }
                    rows={4}
                    className="w-full rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    placeholder="Stile, vincoli, compliance..."
                    data-testid="response-rules-input"
                  />
                </div>

                <div className="rounded-xl border border-black/10 bg-[#F9FAFB] p-4">
                  <p className="text-sm font-semibold text-[#1A1A1A] mb-3">
                    Comportamento base MYU
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                        Nome assistente
                      </label>
                      <input
                        type="text"
                        value={trainingConfig.assistant_name}
                        onChange={(e) =>
                          setTrainingConfig((prev) => ({
                            ...prev,
                            assistant_name: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                        placeholder="MYU"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                        Tono di voce
                      </label>
                      <select
                        value={trainingConfig.voice_tone}
                        onChange={(e) =>
                          setTrainingConfig((prev) => ({ ...prev, voice_tone: e.target.value }))
                        }
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                      >
                        <option value="umano_empatico_positivo">Umano empatico positivo</option>
                        <option value="amichevole">Amichevole</option>
                        <option value="professionale">Professionale</option>
                        <option value="consulenziale">Consulenziale</option>
                        <option value="energetico">Energetico</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                        Livello di formalita
                      </label>
                      <select
                        value={trainingConfig.formality_level}
                        onChange={(e) =>
                          setTrainingConfig((prev) => ({
                            ...prev,
                            formality_level: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                      >
                        <option value="adattiva">Adattiva</option>
                        <option value="informale">Informale</option>
                        <option value="bilanciato">Bilanciato</option>
                        <option value="formale">Formale</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                        Stile risposta
                      </label>
                      <select
                        value={trainingConfig.response_style}
                        onChange={(e) =>
                          setTrainingConfig((prev) => ({
                            ...prev,
                            response_style: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                      >
                        <option value="conversazionale_adattivo">Conversazionale adattivo</option>
                        <option value="sintetico">Sintetico</option>
                        <option value="bilanciato">Bilanciato</option>
                        <option value="dettagliato">Dettagliato</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                        Lunghezza media
                      </label>
                      <select
                        value={trainingConfig.average_length}
                        onChange={(e) =>
                          setTrainingConfig((prev) => ({
                            ...prev,
                            average_length: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                      >
                        <option value="adattiva_al_contesto">Adattiva al contesto</option>
                        <option value="breve">Breve</option>
                        <option value="media">Media</option>
                        <option value="estesa">Estesa</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                        Approccio commerciale
                      </label>
                      <select
                        value={trainingConfig.commercial_approach}
                        onChange={(e) =>
                          setTrainingConfig((prev) => ({
                            ...prev,
                            commercial_approach: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                      >
                        <option value="consulenziale_empatico">Consulenziale empatico</option>
                        <option value="soft">Soft</option>
                        <option value="bilanciato">Bilanciato</option>
                        <option value="proattivo">Proattivo</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                        Approccio educativo
                      </label>
                      <select
                        value={trainingConfig.educational_approach}
                        onChange={(e) =>
                          setTrainingConfig((prev) => ({
                            ...prev,
                            educational_approach: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                      >
                        <option value="storytelling_pratico">Storytelling pratico</option>
                        <option value="pratico">Pratico</option>
                        <option value="guidato">Guidato</option>
                        <option value="didattico">Didattico</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                        Empatia
                      </label>
                      <select
                        value={trainingConfig.empathy}
                        onChange={(e) =>
                          setTrainingConfig((prev) => ({ ...prev, empathy: e.target.value }))
                        }
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                      >
                        <option value="alta">Alta</option>
                        <option value="media">Media</option>
                        <option value="bassa">Bassa</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 rounded-xl border border-black/10 bg-white px-3 py-2 flex items-center justify-between">
                      <p className="text-sm text-[#1A1A1A]">Emoji</p>
                      <label className="inline-flex items-center gap-2 text-sm text-[#1A1A1A]">
                        <input
                          type="checkbox"
                          checked={trainingConfig.emoji_enabled}
                          onChange={(e) =>
                            setTrainingConfig((prev) => ({
                              ...prev,
                              emoji_enabled: e.target.checked,
                            }))
                          }
                        />
                        {trainingConfig.emoji_enabled ? "ON" : "OFF"}
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                        Regole da seguire
                      </label>
                      <textarea
                        value={trainingConfig.follow_rules}
                        onChange={(e) =>
                          setTrainingConfig((prev) => ({
                            ...prev,
                            follow_rules: e.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                        placeholder="Linee guida operative obbligatorie..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                        Cose da evitare
                      </label>
                      <textarea
                        value={trainingConfig.avoid_rules}
                        onChange={(e) =>
                          setTrainingConfig((prev) => ({
                            ...prev,
                            avoid_rules: e.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                        placeholder="Comportamenti da non usare mai..."
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                      Personality (tecnico)
                    </label>
                    <input
                      type="text"
                      value={trainingConfig.personality}
                      onChange={(e) =>
                        setTrainingConfig((prev) => ({ ...prev, personality: e.target.value }))
                      }
                      className="w-full rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                      Lingua default
                    </label>
                    <input
                      type="text"
                      value={trainingConfig.default_language}
                      onChange={(e) =>
                        setTrainingConfig((prev) => ({
                          ...prev,
                          default_language: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#6B7280] mb-2 block">
                      Soglia sintesi iniziale (frasi)
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={16}
                      value={trainingConfig.response_max_sentences}
                      onChange={(e) =>
                        setTrainingConfig((prev) => ({
                          ...prev,
                          response_max_sentences: Number(e.target.value) || 8,
                        }))
                      }
                      className="w-full rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    />
                  </div>
                  <div className="rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2 flex items-center justify-between">
                    <p className="text-sm text-[#1A1A1A]">Action suggestions</p>
                    <label className="inline-flex items-center gap-2 text-sm text-[#1A1A1A]">
                      <input
                        type="checkbox"
                        checked={trainingConfig.allow_action_suggestions}
                        onChange={(e) =>
                          setTrainingConfig((prev) => ({
                            ...prev,
                            allow_action_suggestions: e.target.checked,
                          }))
                        }
                      />
                      {trainingConfig.allow_action_suggestions ? "ON" : "OFF"}
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#6B7280]">
                  Ultimo aggiornamento: {formatDate(configMeta.updated_at)}
                </p>
                <Button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="h-11 rounded-xl bg-[#E85A24] hover:bg-[#D14E1A] text-white"
                  data-testid="save-training-config-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingConfig ? "Salvataggio..." : "Salva Configurazione MYU"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              {knowledgeFiles.length === 0 ? (
                <div className="rounded-xl bg-[#F5F5F5] border border-black/5 px-4 py-5 text-sm text-[#6B7280]">
                  Carica almeno un documento training per vedere la preview.
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <select
                      value={previewFileId}
                      onChange={(e) => {
                        const nextFileId = e.target.value;
                        setPreviewFileId(nextFileId);
                        setPreviewData(null);
                      }}
                      className="flex-1 rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    >
                      {knowledgeFiles.map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.original_name}
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={() => handleLoadPreview(previewFileId)}
                      disabled={previewLoading || !previewFileId}
                      variant="outline"
                      className="h-10 rounded-lg border-[#2B7AB8]/40 text-[#2B7AB8] hover:bg-[#2B7AB8]/5"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {previewLoading ? "Caricamento..." : "Carica Preview"}
                    </Button>
                  </div>

                  {!previewData ? (
                    <div className="rounded-xl bg-[#F5F5F5] border border-black/5 px-4 py-5 text-sm text-[#6B7280]">
                      Seleziona un documento e premi "Carica Preview".
                    </div>
                  ) : (
                    <div className="rounded-xl border border-black/5 bg-[#F5F5F5] p-4">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-[#6B7280]">
                        <span>
                          File: <span className="text-[#1A1A1A]">{previewData?.file?.original_name}</span>
                        </span>
                        <span>Dimensione: {formatBytes(previewData?.file?.size_bytes)}</span>
                        <span>Troncato: {previewData?.truncated ? "si" : "no"}</span>
                      </div>
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[#1A1A1A] max-h-[360px] overflow-y-auto">
                        {previewData?.preview_text || "Nessuna anteprima disponibile"}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-[#1A1A1A]">Eventi documentali MYU</p>
                <Button
                  onClick={refreshLogs}
                  variant="outline"
                  className="h-9 rounded-lg border-black/10 bg-white text-[#1A1A1A]"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${logsLoading ? "animate-spin" : ""}`} />
                  Aggiorna log
                </Button>
              </div>

              {documentLogs.length === 0 ? (
                <div className="rounded-xl bg-[#F5F5F5] border border-black/5 px-4 py-5 text-sm text-[#6B7280]">
                  Nessun evento documentale disponibile.
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {documentLogs.map((row) => {
                    const meta = logActionMeta[row.action] || {
                      label: row.action || "event",
                      className: "text-[#1A1A1A] border-black/10 bg-white",
                    };
                    return (
                      <div
                        key={row.id}
                        className="rounded-xl border border-black/5 bg-[#F5F5F5] px-3 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${meta.className}`}>
                              {meta.label}
                            </span>
                            <span className="text-[#1A1A1A] font-medium">{row.file_name || "-"}</span>
                          </div>
                          <span className="text-xs text-[#6B7280]">{formatDate(row.created_at)}</span>
                        </div>
                        <p className="text-xs text-[#6B7280]">
                          {row.detail || "Nessun dettaglio"} · {row.performed_by_name || "Admin"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <BottomNav active="home" />
    </div>
  );
}
