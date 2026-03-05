// API Service - Backend REST API integration
// Use relative URLs - works on any domain (preview, custom, localhost)

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

  let response;
  try {
    response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    throw new Error('Errore di rete. Controlla la connessione.');
  }

  if (!response.ok) {
    let errorMessage = '';
    const responseText = await response.text().catch(() => '');
    if (responseText) {
      try {
        const data = JSON.parse(responseText);
        if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMessage = data.detail.map(d => d.msg || d.message).join(', ');
        } else if (data.message) {
          errorMessage = data.message;
        }
      } catch (_) {
        errorMessage = responseText.substring(0, 200);
      }
    }
    if (!errorMessage) {
      if (response.status === 401) errorMessage = 'Credenziali non valide';
      else if (response.status === 422) errorMessage = 'Dati mancanti o non validi';
      else errorMessage = `Errore (${response.status})`;
    }
    throw new Error(errorMessage);
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
  },

  async depositEur(amount) {
    return apiRequest('/sim/deposit-eur', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  async createBonifico(data) {
    return apiRequest('/sim/bonifico', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async convertToUp(eurAmount) {
    return apiRequest('/sim/convert-to-up', {
      method: 'POST',
      body: JSON.stringify({ eur_amount: eurAmount }),
    });
  },

  async getTransactions() {
    return apiRequest('/sim/transactions');
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

// ========================
// TASKS API
// ========================

export const tasksAPI = {
  async getMyTasks() {
    return apiRequest('/tasks');
  },

  async uploadDocument(taskId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`/api/tasks/${taskId}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Errore di rete' }));
      throw new Error(error.detail || 'Errore del server');
    }

    return response.json();
  }
};

// ========================
// GIFT CARDS API
// ========================

export const giftcardAPI = {
  async getAll() {
    return apiRequest('/giftcards');
  },

  async purchase(giftcard_id, amount, payment_method) {
    return apiRequest('/giftcards/purchase', {
      method: 'POST',
      body: JSON.stringify({ giftcard_id, amount, payment_method }),
    });
  },

  async purchaseWithDetails(data) {
    return apiRequest('/giftcards/purchase', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMyPurchases() {
    return apiRequest('/giftcards/my-purchases');
  },

  async getLinkedCard() {
    return apiRequest('/giftcards/linked-card');
  },

  async linkCard(data) {
    return apiRequest('/giftcards/link-card', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async unlinkCard() {
    return apiRequest('/giftcards/unlink-card', { method: 'DELETE' });
  },

  // Admin
  async adminGetAll() {
    return apiRequest('/giftcards/admin/all');
  },

  async adminCreate(data) {
    return apiRequest('/giftcards/admin/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async adminUpdate(giftcard_id, data) {
    return apiRequest(`/giftcards/admin/${giftcard_id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async adminUpdateApiConfig(giftcard_id, data) {
    return apiRequest(`/giftcards/admin/${giftcard_id}/api-config`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async adminTestApi(giftcard_id) {
    return apiRequest(`/giftcards/admin/${giftcard_id}/test-api`, {
      method: 'POST',
    });
  },

  async adminUploadLogo(giftcard_id, file) {
    const formData = new FormData();
    formData.append('file', file);
    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`/api/giftcards/admin/${giftcard_id}/logo`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const err = await response.text().catch(() => '');
      try { throw new Error(JSON.parse(err).detail); } catch { throw new Error('Errore upload'); }
    }
    return response.json();
  }
};

// ========================
// MENU API
// ========================

export const menuAPI = {
  async getMyItems() {
    return apiRequest('/menu/my-items');
  },
  async createItem(data) {
    return apiRequest('/menu/items', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateItem(itemId, data) {
    return apiRequest(`/menu/items/${itemId}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteItem(itemId) {
    return apiRequest(`/menu/items/${itemId}`, { method: 'DELETE' });
  },
  async uploadItemImage(itemId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`/api/menu/items/${itemId}/image`, { method: 'POST', headers, body: formData });
    if (!response.ok) throw new Error('Errore upload immagine');
    return response.json();
  },
  async uploadCoverImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch('/api/menu/cover-image', { method: 'POST', headers, body: formData });
    if (!response.ok) throw new Error('Errore upload copertina');
    return response.json();
  },
  async getPublicMenu(merchantId) {
    const response = await fetch(`/api/menu/public/${merchantId}`);
    if (!response.ok) throw new Error('Menu non disponibile');
    return response.json();
  },
};
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
