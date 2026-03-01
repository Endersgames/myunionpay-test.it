// API Service - Backend REST API integration
const API_URL = process.env.REACT_APP_BACKEND_URL;

// Token management
let authToken = localStorage.getItem('auth_token');

export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getAuthToken = () => authToken;

export const clearAuth = () => {
  authToken = null;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_id');
};

// API Helper
const apiRequest = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}/api${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Errore di rete' }));
    throw new Error(error.detail || 'Errore del server');
  }

  return response.json();
};

// ========================
// AUTH API
// ========================

export const authAPI = {
  async register(data) {
    const result = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setAuthToken(result.token);
    localStorage.setItem('user_id', result.user_id);
    return result;
  },

  async login(email, password) {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(result.token);
    localStorage.setItem('user_id', result.user_id);
    return result;
  },

  async getMe() {
    return apiRequest('/auth/me');
  },

  logout() {
    clearAuth();
  }
};

// ========================
// WALLET API
// ========================

export const walletAPI = {
  async getWallet() {
    return apiRequest('/wallet');
  },

  async deposit(amount) {
    return apiRequest('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }
};

// ========================
// PAYMENT API
// ========================

export const paymentAPI = {
  async sendPayment(recipientQr, amount, note = '') {
    return apiRequest('/payments/send', {
      method: 'POST',
      body: JSON.stringify({
        recipient_qr: recipientQr,
        amount,
        note,
      }),
    });
  },

  async getHistory() {
    return apiRequest('/payments/history');
  },

  async getUserByQR(qrCode) {
    return apiRequest(`/payments/user/${qrCode}`);
  },

  async getReferralFromQR(qrCode) {
    return apiRequest(`/qr/referral/${qrCode}`);
  }
};

// ========================
// MERCHANT API
// ========================

export const merchantAPI = {
  async create(data) {
    return apiRequest('/merchants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getAll(category = null) {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return apiRequest(`/merchants${query}`);
  },

  async getMyMerchant() {
    return apiRequest('/merchants/me');
  },

  async getById(merchantId) {
    return apiRequest(`/merchants/${merchantId}`);
  },

  async getCategories() {
    return apiRequest('/merchants/categories/list');
  }
};

// ========================
// NOTIFICATION API
// ========================

export const notificationAPI = {
  async send(data) {
    return apiRequest('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async preview(data) {
    return apiRequest('/notifications/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMyNotifications() {
    return apiRequest('/notifications/me');
  },

  async markAsRead(notificationId) {
    return apiRequest(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  async getUnreadCount() {
    return apiRequest('/notifications/unread-count');
  }
};

// ========================
// PROFILE API
// ========================

export const profileAPI = {
  async getTags() {
    return apiRequest('/profile/tags');
  },

  async getMyTags() {
    return apiRequest('/profile/my-tags');
  },

  async updateTags(tags) {
    return apiRequest('/profile/tags', {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
  }
};

// ========================
// REFERRAL API
// ========================

export const referralAPI = {
  async getStats() {
    return apiRequest('/referrals/stats');
  }
};

// ========================
// SIM API
// ========================

export const simAPI = {
  async getMySim() {
    return apiRequest('/sim/my-sim');
  },

  async activate(data) {
    return apiRequest('/sim/activate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async useData() {
    return apiRequest('/sim/use-data', {
      method: 'POST',
    });
  }
};

// ========================
// PUSH NOTIFICATIONS API
// ========================

export const pushAPI = {
  async getVapidKey() {
    return apiRequest('/push/vapid-key');
  },

  async subscribe(subscription) {
    return apiRequest('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    });
  },

  async unsubscribe() {
    return apiRequest('/push/unsubscribe', {
      method: 'DELETE',
    });
  }
};

// Common constants
export const PROFILE_TAGS = [
  "tech", "fashion", "food", "fitness", "travel", 
  "music", "sports", "gaming", "beauty", "health",
  "shopping", "entertainment", "finance", "education", "art"
];

export const MERCHANT_CATEGORIES = [
  "Ristorante", "Bar/Caffetteria", "Abbigliamento", "Elettronica",
  "Palestra/Fitness", "Bellezza/Spa", "Alimentari", "Farmacia",
  "Servizi", "Intrattenimento", "Altro"
];
