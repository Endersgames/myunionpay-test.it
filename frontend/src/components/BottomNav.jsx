import { useNavigate } from "react-router-dom";
import { Home, Store, QrCode, Bell, User } from "lucide-react";

export const BottomNav = ({ active, unreadCount = 0 }) => {
  const navigate = useNavigate();

  const navItems = [
    { id: "home", icon: Home, label: "Home", path: "/dashboard" },
    { id: "marketplace", icon: Store, label: "Negozi", path: "/marketplace" },
    { id: "qr", icon: QrCode, label: "QR Code", path: "/qr" },
    { id: "notifications", icon: Bell, label: "Notifiche", path: "/notifications", badge: unreadCount },
    { id: "profile", icon: User, label: "Profilo", path: "/profile" }
  ];

  return (
    <div className="bottom-nav">
      <div className="bottom-nav-inner">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className={`nav-item ${active === item.id ? 'active' : ''}`}
            data-testid={`nav-${item.id}`}
          >
            <div className="relative">
              <item.icon className="w-5 h-5" />
              {item.badge > 0 && (
                <span className="notification-badge">{item.badge}</span>
              )}
            </div>
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BottomNav;
