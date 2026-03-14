// API Service - Backend REST API integration
// Use relative URLs - works on any domain (preview, custom, localhost)

import { withApiPath } from "@/lib/runtime-config";
import { optimizeImageForUpload } from "@/lib/image-upload";

const extractErrorMessage = (responseText, status, fallbackMessage) => {
  let errorMessage = "";

  if (responseText) {
    try {
      const data = JSON.parse(responseText);
      if (typeof data.detail === "string") {
        errorMessage = data.detail;
      } else if (
        data.detail &&
        typeof data.detail === "object" &&
        typeof data.detail.message === "string"
      ) {
        errorMessage = data.detail.message;
      } else if (Array.isArray(data.detail)) {
        errorMessage = data.detail.map((detail) => detail.msg || detail.message).join(", ");
      } else if (typeof data.message === "string") {
        errorMessage = data.message;
      }
    } catch (_) {
      const trimmed = responseText.trim();
      if (trimmed && !trimmed.startsWith("<")) {
        errorMessage = trimmed.substring(0, 200);
      }
    }
  }

  if (!errorMessage) {
    if (status === 401) errorMessage = "Credenziali non valide";
    else if (status === 402) errorMessage = "Saldo insufficiente";
    else if (status === 413) errorMessage = "Immagine troppo grande. Usa una foto piu leggera.";
    else if (status === 404) errorMessage = fallbackMessage || "Risorsa non trovata";
    else if (status === 422) errorMessage = "Dati mancanti o non validi";
    else errorMessage = fallbackMessage || `Errore (${status})`;
  }

  return errorMessage;
};

const getResponseErrorMessage = async (response, fallbackMessage) => {
  const responseText = await response.text().catch(() => "");
  return extractErrorMessage(responseText, response.status, fallbackMessage);
};

// Token management
let authToken =
  typeof window !== "undefined" ? window.localStorage.getItem("auth_token") : null;

export const setAuthToken = (token) => {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem("auth_token", token);
    } else {
      window.localStorage.removeItem("auth_token");
    }
  }
};

export const getAuthToken = () => authToken;

export const clearAuth = () => {
  authToken = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("auth_token");
    window.localStorage.removeItem("user_id");
  }
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
    response = await fetch(withApiPath(endpoint), {
      ...options,
      headers,
    });
  } catch (networkErr) {
    throw new Error('Errore di rete. Controlla la connessione.');
  }

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem("user_id", result.user_id);
    }
    return result;
  },

  async login(email, password) {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(result.token);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("user_id", result.user_id);
    }
    return result;
  },

  async getMe() {
    return apiRequest('/auth/me');
  },

  async googleCallback(sessionId) {
    return apiRequest('/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  async googleComplete(sessionId, phone, extra = {}) {
    const result = await apiRequest('/auth/google/complete', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, phone, ...extra }),
    });
    setAuthToken(result.token);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("user_id", result.user_id);
    }
    return result;
  },

  logout() {
    clearAuth();
  },

  async deleteAccount() {
    return apiRequest('/auth/delete-account', { method: 'POST' });
  },
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

  async getAll(categoryOrOptions = null, maybeOptions = {}) {
    const options = typeof categoryOrOptions === 'object' && categoryOrOptions !== null
      ? categoryOrOptions
      : { ...maybeOptions, category: categoryOrOptions };
    const params = new URLSearchParams();

    if (options.category) params.set('category', options.category);
    if (options.city) params.set('city', options.city);
    if (options.prioritizeCity) params.set('prioritize_city', 'true');

    const query = params.toString() ? `?${params.toString()}` : '';
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
  },

  async uploadVisura(file) {
    const optimizedFile = await optimizeImageForUpload(file, {
      maxBytes: 850 * 1024,
      maxDimension: 1800,
    });
    const formData = new FormData();
    formData.append('file', optimizedFile);
    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(withApiPath("/merchant/ai/upload-visura"), {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response, 'Errore upload visura'));
    }
    return response.json();
  },

  async scanMenu(file) {
    const optimizedFile = await optimizeImageForUpload(file, {
      maxBytes: 850 * 1024,
      maxDimension: 1800,
    });
    const formData = new FormData();
    formData.append('file', optimizedFile);
    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(withApiPath("/merchant/ai/scan-menu"), {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response, 'Errore scansione menu'));
    }
    return response.json();
  },
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
  },

  async trackClick(notificationId) {
    return apiRequest(`/notifications/${notificationId}/click`, { method: 'PUT' });
  },

  async getTemplates() {
    return apiRequest('/notifications/templates');
  },

  async sendMerchantNotification(data) {
    return apiRequest('/notifications/merchant/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
  },

  async updatePersonalData(data) {
    return apiRequest('/profile/personal', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async uploadPicture(file) {
    const formData = new FormData();
    formData.append('file', file);
    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(withApiPath("/profile/picture"), {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error(await getResponseErrorMessage(response, 'Errore upload'));
    return response.json();
  },

  async getDataTreatment() {
    return apiRequest('/profile/data-treatment');
  },

  async updateDataTreatment(data) {
    return apiRequest('/profile/data-treatment', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
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

    const response = await fetch(withApiPath(`/tasks/${taskId}/upload`), {
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
    const response = await fetch(withApiPath(`/giftcards/admin/${giftcard_id}/logo`), {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error(await getResponseErrorMessage(response, 'Errore upload'));
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
    const response = await fetch(withApiPath(`/menu/items/${itemId}/image`), { method: 'POST', headers, body: formData });
    if (!response.ok) throw new Error(await getResponseErrorMessage(response, 'Errore upload immagine'));
    return response.json();
  },
  async uploadCoverImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(withApiPath("/menu/cover-image"), { method: 'POST', headers, body: formData });
    if (!response.ok) throw new Error(await getResponseErrorMessage(response, 'Errore upload copertina'));
    return response.json();
  },
  async getPublicMenu(merchantId) {
    const response = await fetch(withApiPath(`/menu/public/${merchantId}`));
    if (!response.ok) throw new Error('Menu non disponibile');
    return response.json();
  },
};
// ========================
// MYU AI API
// ========================
export const myuAPI = {
  async chat(text, latitude = null, longitude = null) {
    try {
      const body = { text };
      if (latitude && longitude) {
        body.latitude = latitude;
        body.longitude = longitude;
      }
      return await apiRequest('/myu/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (err.message?.includes('402') || err.message?.includes('Saldo')) {
        throw new Error('Saldo insufficiente per chattare con MYU');
      }
      throw err;
    }
  },
  async getHistory(limit = 30) {
    return apiRequest(`/myu/history?limit=${limit}`);
  },
  async newSession() {
    return apiRequest('/myu/new-session', { method: 'POST' });
  },
  async getTasks() {
    return apiRequest('/myu/tasks');
  },
  async updateTask(taskId, status) {
    return apiRequest(`/myu/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
  async getSuggestions() {
    return apiRequest('/myu/suggestions');
  },
  async updateLocation(latitude, longitude) {
    return apiRequest('/myu/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    });
  },
  async getLocation() {
    return apiRequest('/myu/location');
  },
  async confirmCity(city) {
    return apiRequest('/myu/location/confirm', {
      method: 'POST',
      body: JSON.stringify({ city }),
    });
  },
  async getRequestCost(requestId) {
    return apiRequest(`/myu/costs/${requestId}`);
  },
  async getCoachingProfile() {
    return apiRequest('/myu/coaching-profile');
  },
  async updateCoachingProfile(data) {
    return apiRequest('/myu/coaching-profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async getCoachingPlan(financialGoal = "") {
    return apiRequest('/myu/coaching-plan', {
      method: 'POST',
      body: JSON.stringify({ financial_goal: financialGoal }),
    });
  },
  async getProactiveSignals() {
    return apiRequest('/myu/proactive/signals');
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

// ========================
// CONTENT API (Public + Admin)
// ========================

export const contentAPI = {
  async getPublic(key) {
    return apiRequest(`/content/${key}`);
  },

  async adminGetAll() {
    return apiRequest('/admin/content');
  },

  async adminGet(key) {
    return apiRequest(`/admin/content/${key}`);
  },

  async adminUpdate(key, data) {
    return apiRequest(`/admin/content/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

export const adminAPI = {
  async getDashboardSummary() {
    return apiRequest('/admin/dashboard');
  },

  async getMyuTrainingWorkspace() {
    return apiRequest('/admin/myu-training/workspace');
  },

  async getMyuTrainingOverview() {
    return apiRequest('/admin/myu-training/overview');
  },

  async updateMyuTrainingConfig(data) {
    return apiRequest('/admin/myu-training/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateMyuCoachingEngine(data) {
    return apiRequest('/admin/myu-training/coaching-engine', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getMyuTrainingDocuments() {
    return apiRequest('/admin/myu-training/training-documents');
  },

  async uploadMyuTrainingDocument({ file, documentKey, displayName = '', notes = '', setActive = true }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_key', documentKey);
    formData.append('display_name', displayName);
    formData.append('notes', notes);
    formData.append('set_active', setActive ? 'true' : 'false');

    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(withApiPath('/admin/myu-training/training-documents'), {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response, 'Errore upload documento training'));
    }
    return response.json();
  },

  async updateMyuTrainingDocument(documentId, data) {
    return apiRequest(`/admin/myu-training/training-documents/${documentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async setMyuTrainingDocumentStatus(documentId, isActive) {
    return apiRequest(`/admin/myu-training/training-documents/${documentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  async deleteMyuTrainingDocument(documentId) {
    return apiRequest(`/admin/myu-training/training-documents/${documentId}`, {
      method: 'DELETE',
    });
  },

  async downloadMyuTrainingDocument(documentId) {
    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(
      withApiPath(`/admin/myu-training/training-documents/${documentId}/download`),
      {
        method: 'GET',
        headers,
      },
    );
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response, 'Errore apertura PDF'));
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
    return {
      blob,
      filename: filenameMatch?.[1] || 'documento-training.pdf',
    };
  },

  async uploadMyuKnowledgeFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(withApiPath('/admin/myu-training/files'), {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error(await getResponseErrorMessage(response, 'Errore upload file'));
    return response.json();
  },

  async deleteMyuKnowledgeFile(fileId) {
    return apiRequest(`/admin/myu-training/files/${fileId}`, {
      method: 'DELETE',
    });
  },

  async getMyuKnowledgePreview(fileId, maxChars = 2500) {
    const params = new URLSearchParams();
    if (fileId) params.set('file_id', fileId);
    if (maxChars) params.set('max_chars', String(maxChars));
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/admin/myu-training/knowledge/preview${query}`);
  },

  async getMyuDocumentLogs(limit = 100, action = '') {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (action) params.set('action', action);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/admin/myu-training/document-logs${query}`);
  },
};

// ========================
// FEATURES API (Public + Admin)
// ========================

export const featuresAPI = {
  async getPublic() {
    return apiRequest('/admin/features/public');
  },

  async getPublicPricing() {
    return apiRequest('/admin/features/public/pricing');
  },

  async adminGet() {
    return apiRequest('/admin/features');
  },

  async adminUpdate(toggles) {
    return apiRequest('/admin/features', {
      method: 'PUT',
      body: JSON.stringify(toggles),
    });
  },

  async adminGetApiConfig() {
    return apiRequest('/admin/features/api-config');
  },

  async adminUpdateApiConfig(section, data) {
    return apiRequest(`/admin/features/api-config/${section}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async adminGetPricing() {
    return apiRequest('/admin/features/pricing');
  },

  async adminUpdatePricing(data) {
    return apiRequest('/admin/features/pricing', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
