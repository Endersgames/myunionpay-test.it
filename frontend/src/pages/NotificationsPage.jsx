import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { toast } from "sonner";
import {
  Bell, Check, Gift, Store, Tag, Calendar, Heart,
  Megaphone, ChevronDown, ChevronUp, MapPin, Bookmark,
  ExternalLink, Wallet, ListTodo, MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { notificationAPI } from "@/lib/api";

const MYU_ICON = "/myu-icon.png";

const TYPE_CONFIG = {
  promo_offer:     { icon: Tag, color: "bg-[#E85A24]", label: "Promo" },
  new_menu:        { icon: Store, color: "bg-emerald-500", label: "Menu" },
  event:           { icon: Calendar, color: "bg-purple-500", label: "Evento" },
  welcome:         { icon: Heart, color: "bg-pink-500", label: "Benvenuto" },
  generic:         { icon: Megaphone, color: "bg-[#2B7AB8]", label: "Info" },
  merchant_notification: { icon: Store, color: "bg-[#2B7AB8]", label: "Merchant" },
  system_notification:   { icon: Bell, color: "bg-gray-500", label: "Sistema" },
  wallet_notification:   { icon: Wallet, color: "bg-emerald-500", label: "Wallet" },
  task_notification:     { icon: ListTodo, color: "bg-[#E85A24]", label: "Task" },
  myu_message:           { icon: MessageCircle, color: "bg-[#4A90D9]", label: "MYU" },
};

const MYU_EMPTY_MESSAGES = [
  "Ciao! Qui troverai le novita dai posti che ti interessano.",
  "Nessuna novita per ora, ma posso aiutarti a scoprire qualcosa di interessante.",
  "Tutto tranquillo! Quando i merchant avranno qualcosa per te, lo vedrai qui.",
];

const MYU_COMMENTS = [
  "Questo posto sembra promettente.",
  "C'e qualcosa di interessante qui.",
  "Vuoi dare un'occhiata?",
  "Potrebbe piacerti!",
];

function MyuEmptyState({ onChatClick }) {
  const [msgIdx] = useState(Math.floor(Math.random() * MYU_EMPTY_MESSAGES.length));
  const [anim, setAnim] = useState("myu-wave");

  useEffect(() => {
    const t = setTimeout(() => setAnim("myu-bounce"), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center py-12 px-6" data-testid="notif-empty-state">
      <div className={`w-24 h-24 rounded-full overflow-hidden mb-5 ${anim}`}>
        <img src={MYU_ICON} alt="MYU" className="w-full h-full object-cover" />
      </div>
      <p className="text-center text-[#1A1A1A] text-sm leading-relaxed max-w-[260px] mb-6">
        {MYU_EMPTY_MESSAGES[msgIdx]}
      </p>
      <Button
        onClick={onChatClick}
        className="rounded-full bg-[#2B7AB8] hover:bg-[#236699] px-6"
        data-testid="notif-chat-myu"
      >
        <MessageCircle className="w-4 h-4 mr-2" />
        Chatta con MYU
      </Button>
    </div>
  );
}

function MyuBubble({ text, position, onClick }) {
  return (
    <div
      className={`flex items-end gap-2 my-3 ${position === "right" ? "justify-end" : "justify-start"}`}
      style={{ animation: "myuFadeIn 0.4s ease" }}
    >
      {position !== "right" && (
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 myu-peek-right">
          <img src={MYU_ICON} alt="MYU" className="w-full h-full object-cover" />
        </div>
      )}
      <button
        onClick={onClick}
        className="bg-[#EBF4FC] border border-[#2B7AB8]/15 rounded-2xl rounded-bl-sm px-3.5 py-2 max-w-[240px] hover:bg-[#D9ECFA] transition"
        data-testid="myu-bubble"
      >
        <p className="text-xs text-[#1A1A1A] leading-tight">{text}</p>
      </button>
      {position === "right" && (
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 myu-look-around">
          <img src={MYU_ICON} alt="MYU" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

function NotificationCard({ notif, onRead, onClick, onCtaClick, expanded, onToggle }) {
  const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.merchant_notification;
  const Icon = config.icon;

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
        notif.is_read ? "border-black/5" : "border-[#2B7AB8]/30 shadow-sm"
      }`}
      data-testid={`notification-${notif.id}`}
    >
      {/* Compact View */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => {
          if (!notif.is_read) onRead(notif.id);
          onToggle(notif.id);
          onClick(notif.id);
        }}
      >
        {/* Icon / Logo */}
        <div className={`w-10 h-10 rounded-xl ${config.color} flex items-center justify-center flex-shrink-0`}>
          {notif.merchant_logo ? (
            <img src={notif.merchant_logo} alt="" className="w-full h-full rounded-xl object-cover" />
          ) : (
            <Icon className="w-5 h-5 text-white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-[#1A1A1A] truncate">{notif.merchant_name || "Sistema"}</p>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${config.color}`}>
                  {config.label}
                </span>
              </div>
              <p className="font-medium text-sm text-[#1A1A1A] mt-0.5">{notif.title}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-[#6B7280]">{formatDate(notif.created_at)}</span>
              {expanded ? <ChevronUp className="w-4 h-4 text-[#6B7280]" /> : <ChevronDown className="w-4 h-4 text-[#6B7280]" />}
            </div>
          </div>

          {!expanded && (
            <p className="text-xs text-[#6B7280] mt-1 line-clamp-1">{notif.message}</p>
          )}

          {/* Reward badge always visible */}
          {notif.reward_amount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-[#E85A24]/10 rounded-full">
                <Gift className="w-3 h-3 text-[#E85A24]" />
                <span className="text-[10px] font-mono font-semibold text-[#E85A24]">+{notif.reward_amount?.toFixed?.(2) || "0.00"} UP</span>
              </div>
              {notif.is_read && (
                <span className="flex items-center gap-0.5 text-[10px] text-[#6B7280]"><Check className="w-3 h-3" />Letta</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded View */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-black/5 mt-0" style={{ animation: "myuFadeIn 0.3s ease" }}>
          {notif.image_url && (
            <div className="rounded-xl overflow-hidden mb-3 mt-3">
              <img src={notif.image_url} alt="" className="w-full h-32 object-cover" />
            </div>
          )}
          <p className="text-sm text-[#1A1A1A] leading-relaxed mt-2">{notif.message}</p>

          <div className="flex flex-wrap gap-2 mt-4">
            {notif.cta_text && (
              <Button
                onClick={(e) => { e.stopPropagation(); onCtaClick(notif); }}
                className="rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-xs h-8 px-4"
                data-testid="notif-cta"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                {notif.cta_text}
              </Button>
            )}
            {notif.merchant_id && (
              <Button
                onClick={(e) => { e.stopPropagation(); onCtaClick({ cta_url: `/merchant/${notif.merchant_id}` }); }}
                variant="outline"
                className="rounded-full text-xs h-8 px-4 border-black/10"
                data-testid="notif-merchant-btn"
              >
                <Store className="w-3.5 h-3.5 mr-1" />
                Vai al negozio
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (mins < 1) return "Ora";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}g`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [myuVisible, setMyuVisible] = useState(false);
  const [myuComment, setMyuComment] = useState("");

  useEffect(() => {
    if (user?.id) fetchNotifications();
  }, [user?.id]);

  useEffect(() => {
    if (notifications.length > 0 && !loading) {
      const unread = notifications.filter(n => !n.is_read);
      if (unread.length > 0) {
        const timer = setTimeout(() => {
          setMyuComment(MYU_COMMENTS[Math.floor(Math.random() * MYU_COMMENTS.length)]);
          setMyuVisible(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [notifications, loading]);

  const fetchNotifications = async () => {
    try {
      const notifs = await notificationAPI.getMyNotifications();
      setNotifications(notifs);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const markAsRead = useCallback(async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  }, []);

  const trackClick = useCallback(async (id) => {
    try { await notificationAPI.trackClick(id); } catch {}
  }, []);

  const handleToggle = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleCta = useCallback((notif) => {
    if (notif.cta_url) {
      if (notif.cta_url.startsWith("http")) {
        window.open(notif.cta_url, "_blank");
      } else {
        navigate(notif.cta_url);
      }
    }
  }, [navigate]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-24" data-testid="notifications-page">
      {/* Header */}
      <div className="bg-white border-b border-black/5 px-5 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-xl text-[#1A1A1A]">Notifiche</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {unreadCount > 0 ? `${unreadCount} da leggere` : "Tutte lette"}
            </p>
          </div>
          <button
            onClick={() => navigate("/myu")}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#4A90D9]/20 hover:border-[#4A90D9]/50 transition"
            data-testid="notif-myu-btn"
          >
            <img src={MYU_ICON} alt="MYU" className="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {notifications.length === 0 ? (
          <MyuEmptyState onChatClick={() => navigate("/myu")} />
        ) : (
          <div className="space-y-3">
            {/* MYU contextual bubble */}
            {myuVisible && (
              <MyuBubble
                text={myuComment}
                position="left"
                onClick={() => navigate("/myu")}
              />
            )}

            {notifications.map((notif, idx) => (
              <div key={notif.id} className="animate-slideUp" style={{ animationDelay: `${idx * 0.03}s` }}>
                <NotificationCard
                  notif={notif}
                  expanded={expandedId === notif.id}
                  onRead={markAsRead}
                  onClick={trackClick}
                  onCtaClick={handleCta}
                  onToggle={handleToggle}
                />
              </div>
            ))}

            {/* MYU at bottom */}
            {notifications.length > 3 && (
              <MyuBubble
                text="Vuoi scoprire nuovi merchant?"
                position="right"
                onClick={() => navigate("/marketplace")}
              />
            )}
          </div>
        )}
      </div>

      <BottomNav active="notifications" unreadCount={unreadCount} />
    </div>
  );
}
