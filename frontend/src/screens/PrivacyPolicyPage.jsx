import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { contentAPI } from "@/lib/api";

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const [content, setContent] = useState({ title: "", content: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contentAPI.getPublic("privacy_policy").then(data => {
      setContent(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
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

      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-[#2B7AB8]" />
        <h1 className="font-heading text-2xl font-bold text-[#1A1A1A]">
          {content.title || "Privacy Policy"}
        </h1>
      </div>

      <div className="prose prose-sm max-w-none text-[#1A1A1A]">
        {content.content?.split('\n').map((paragraph, i) => (
          paragraph.trim() ? (
            <p key={i} className="text-[#6B7280] leading-relaxed mb-4">{paragraph}</p>
          ) : null
        ))}
      </div>
    </div>
  );
}
