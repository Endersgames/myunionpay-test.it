import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Bell, Check, Gift, Store } from "lucide-react";
import BottomNav from "@/components/BottomNav";

// Firestore
import { getUserNotifications, markNotificationRead } from "@/lib/firestore";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    }
  }, [user?.id]);

  const fetchNotifications = async () => {
    try {
      const notifs = await getUserNotifications(user.id);
      setNotifications(notifs);
    } catch (err) {
      console.error("Notifications fetch error:", err);
    }
    setLoading(false);
  };

  const markAsRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error("Mark read error:", err);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return "Adesso";
    if (hours < 24) return `${hours}h fa`;
    if (days < 7) return `${days}g fa`;
    return date.toLocaleDateString('it-IT');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] pb-safe">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="font-heading text-2xl font-bold mb-2">Notifiche</h1>
        <p className="text-[#A1A1AA]">Le tue notifiche dai merchant</p>
      </div>

      {/* Notifications List */}
      <div className="px-6 py-4">
        {notifications.length === 0 ? (
          <div className="bg-[#121212] rounded-2xl p-8 text-center">
            <Bell className="w-12 h-12 text-[#A1A1AA] mx-auto mb-4" />
            <p className="text-[#A1A1AA]">Nessuna notifica</p>
            <p className="text-sm text-[#A1A1AA]/60 mt-2">
              Riceverai qui le notifiche dai merchant
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif, index) => (
              <div
                key={notif.id}
                onClick={() => !notif.is_read && markAsRead(notif.id)}
                className={`bg-[#121212] rounded-xl p-4 border transition-colors cursor-pointer animate-slideUp ${
                  notif.is_read ? 'border-white/5' : 'border-[#2B7AB8]/50'
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
                data-testid={`notification-${notif.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    notif.is_read ? 'bg-white/5' : 'bg-[#2B7AB8]/20'
                  }`}>
                    <Store className={`w-5 h-5 ${notif.is_read ? 'text-[#A1A1AA]' : 'text-[#2B7AB8]'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{notif.merchant_name}</p>
                        <p className="font-medium mt-1">{notif.title}</p>
                      </div>
                      <span className="text-xs text-[#A1A1AA] flex-shrink-0">
                        {formatDate(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-[#A1A1AA] mt-1 line-clamp-2">{notif.message}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex items-center gap-1 px-2 py-1 bg-[#E85A24]/10 rounded-full">
                        <Gift className="w-3 h-3 text-[#E85A24]" />
                        <span className="text-xs font-mono text-[#E85A24]">
                          +{notif.reward_amount.toFixed(2)} UP
                        </span>
                      </div>
                      {notif.is_read && (
                        <div className="flex items-center gap-1 text-xs text-[#A1A1AA]">
                          <Check className="w-3 h-3" />
                          Letta
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="notifications" />
    </div>
  );
}
