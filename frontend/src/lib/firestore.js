// Firestore Database Service
import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  increment,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';

// ========================
// USER FUNCTIONS
// ========================

/**
 * Create a new user profile in Firestore
 */
export async function createUserProfile(uid, userData) {
  const qrCode = `UP${uid.substring(0, 12).toUpperCase()}`;
  const referralCode = `REF${uid.substring(0, 8).toUpperCase()}`;
  
  const userDoc = {
    id: uid,
    email: userData.email,
    phone: userData.phone,
    full_name: userData.full_name,
    qr_code: qrCode,
    referral_code: referralCode,
    up_points: 0,
    profile_tags: [],
    is_merchant: false,
    created_at: new Date().toISOString()
  };
  
  await setDoc(doc(db, 'users', uid), userDoc);
  
  // Create wallet with 100 UP starting balance
  const walletDoc = {
    user_id: uid,
    balance: 100,
    currency: 'UP',
    created_at: new Date().toISOString()
  };
  await setDoc(doc(db, 'wallets', uid), walletDoc);
  
  return userDoc;
}

/**
 * Get user profile by UID
 */
export async function getUserProfile(uid) {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

/**
 * Get user by QR code
 */
export async function getUserByQRCode(qrCode) {
  const q = query(collection(db, 'users'), where('qr_code', '==', qrCode), limit(1));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  return null;
}

/**
 * Get user by referral code
 */
export async function getUserByReferralCode(referralCode) {
  const q = query(collection(db, 'users'), where('referral_code', '==', referralCode), limit(1));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  return null;
}

/**
 * Update user profile tags
 */
export async function updateUserTags(uid, tags) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { profile_tags: tags });
}

/**
 * Process referral - give 1 UP to both users
 */
export async function processReferral(referrerUid, newUserUid) {
  // Credit 1 UP to referrer's wallet
  const referrerWalletRef = doc(db, 'wallets', referrerUid);
  await updateDoc(referrerWalletRef, { balance: increment(1) });
  
  // Credit 1 UP to new user's wallet
  const newUserWalletRef = doc(db, 'wallets', newUserUid);
  await updateDoc(newUserWalletRef, { balance: increment(1) });
  
  // Update UP points for stats
  const referrerRef = doc(db, 'users', referrerUid);
  await updateDoc(referrerRef, { up_points: increment(1) });
  
  const newUserRef = doc(db, 'users', newUserUid);
  await updateDoc(newUserRef, { up_points: increment(1) });
  
  // Record referral
  const referralDoc = {
    referrer_id: referrerUid,
    referred_id: newUserUid,
    bonus_amount: 1,
    created_at: new Date().toISOString()
  };
  await setDoc(doc(db, 'referrals', `${referrerUid}_${newUserUid}`), referralDoc);
}

// ========================
// WALLET FUNCTIONS
// ========================

/**
 * Get wallet for user
 */
export async function getWallet(uid) {
  const docRef = doc(db, 'wallets', uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { user_id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

/**
 * Subscribe to wallet changes (real-time)
 */
export function subscribeToWallet(uid, callback) {
  const docRef = doc(db, 'wallets', uid);
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback({ user_id: doc.id, ...doc.data() });
    }
  });
}

/**
 * Deposit to wallet
 */
export async function depositToWallet(uid, amount, userName) {
  const walletRef = doc(db, 'wallets', uid);
  await updateDoc(walletRef, { balance: increment(amount) });
  
  // Record transaction
  const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const txDoc = {
    id: txId,
    sender_id: 'SYSTEM',
    sender_name: 'Deposito',
    recipient_id: uid,
    recipient_name: userName,
    amount: amount,
    note: 'Ricarica wallet',
    transaction_type: 'deposit',
    created_at: new Date().toISOString()
  };
  await setDoc(doc(db, 'transactions', txId), txDoc);
  
  return await getWallet(uid);
}

// ========================
// PAYMENT FUNCTIONS
// ========================

/**
 * Send payment to another user
 */
export async function sendPayment(senderUid, senderName, recipientQRCode, amount, note) {
  // Find recipient
  const recipient = await getUserByQRCode(recipientQRCode);
  if (!recipient) {
    throw new Error('Destinatario non trovato');
  }
  
  if (recipient.id === senderUid) {
    throw new Error('Non puoi pagare te stesso');
  }
  
  // Check sender balance
  const senderWallet = await getWallet(senderUid);
  if (senderWallet.balance < amount) {
    throw new Error('Saldo insufficiente');
  }
  
  // Execute transfer
  const senderWalletRef = doc(db, 'wallets', senderUid);
  const recipientWalletRef = doc(db, 'wallets', recipient.id);
  
  await updateDoc(senderWalletRef, { balance: increment(-amount) });
  await updateDoc(recipientWalletRef, { balance: increment(amount) });
  
  // Record transaction
  const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const txDoc = {
    id: txId,
    sender_id: senderUid,
    sender_name: senderName,
    recipient_id: recipient.id,
    recipient_name: recipient.full_name,
    amount: amount,
    note: note || '',
    transaction_type: 'payment',
    created_at: new Date().toISOString()
  };
  await setDoc(doc(db, 'transactions', txId), txDoc);
  
  return txDoc;
}

/**
 * Get payment history for user
 */
export async function getPaymentHistory(uid) {
  const sentQuery = query(
    collection(db, 'transactions'),
    where('sender_id', '==', uid),
    orderBy('created_at', 'desc'),
    limit(50)
  );
  
  const receivedQuery = query(
    collection(db, 'transactions'),
    where('recipient_id', '==', uid),
    orderBy('created_at', 'desc'),
    limit(50)
  );
  
  const [sentSnap, receivedSnap] = await Promise.all([
    getDocs(sentQuery),
    getDocs(receivedQuery)
  ]);
  
  const transactions = [];
  sentSnap.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));
  receivedSnap.forEach(doc => {
    // Avoid duplicates
    if (!transactions.find(t => t.id === doc.id)) {
      transactions.push({ id: doc.id, ...doc.data() });
    }
  });
  
  // Sort by date descending
  transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  return transactions.slice(0, 100);
}

// ========================
// MERCHANT FUNCTIONS
// ========================

/**
 * Create merchant profile
 */
export async function createMerchant(uid, merchantData) {
  const merchantId = `merchant_${Date.now()}`;
  const qrCode = `UPMERCH${merchantId.substring(0, 8).toUpperCase()}`;
  
  const merchantDoc = {
    id: merchantId,
    user_id: uid,
    business_name: merchantData.business_name,
    description: merchantData.description,
    category: merchantData.category,
    address: merchantData.address,
    image_url: merchantData.image_url || null,
    qr_code: qrCode,
    created_at: new Date().toISOString()
  };
  
  await setDoc(doc(db, 'merchants', merchantId), merchantDoc);
  
  // Update user as merchant
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { is_merchant: true });
  
  return merchantDoc;
}

/**
 * Get merchant by user ID
 */
export async function getMerchantByUserId(uid) {
  const q = query(collection(db, 'merchants'), where('user_id', '==', uid), limit(1));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  return null;
}

/**
 * Get all merchants (optionally filtered by category)
 */
export async function getMerchants(category = null) {
  let q;
  if (category) {
    q = query(collection(db, 'merchants'), where('category', '==', category));
  } else {
    q = query(collection(db, 'merchants'));
  }
  
  const querySnapshot = await getDocs(q);
  const merchants = [];
  querySnapshot.forEach(doc => merchants.push({ id: doc.id, ...doc.data() }));
  
  return merchants;
}

/**
 * Get merchant by ID
 */
export async function getMerchantById(merchantId) {
  const docRef = doc(db, 'merchants', merchantId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

// ========================
// NOTIFICATION FUNCTIONS
// ========================

/**
 * Send notification (merchant only)
 */
export async function sendNotification(merchantId, merchantName, senderUid, notificationData) {
  // Get all users (for broadcast) or filtered by tags
  let usersQuery;
  if (notificationData.target_tags && notificationData.target_tags.length > 0) {
    usersQuery = query(
      collection(db, 'users'),
      where('profile_tags', 'array-contains-any', notificationData.target_tags)
    );
  } else {
    // Broadcast - get all users
    usersQuery = query(collection(db, 'users'));
  }
  
  const usersSnap = await getDocs(usersQuery);
  const targetUsers = [];
  usersSnap.forEach(doc => {
    if (doc.id !== senderUid) { // Exclude sender
      targetUsers.push({ id: doc.id, ...doc.data() });
    }
  });
  
  const totalRecipients = targetUsers.length;
  const totalCost = totalRecipients * notificationData.reward_amount;
  
  // Check merchant balance
  const merchantWallet = await getWallet(senderUid);
  if (merchantWallet.balance < totalCost) {
    throw new Error(`Saldo insufficiente. Costo totale: ${totalCost.toFixed(2)} UP`);
  }
  
  // Deduct from merchant
  const merchantWalletRef = doc(db, 'wallets', senderUid);
  await updateDoc(merchantWalletRef, { balance: increment(-totalCost) });
  
  // Create notification record
  const notificationId = `notif_${Date.now()}`;
  const notificationDoc = {
    id: notificationId,
    merchant_id: merchantId,
    merchant_name: merchantName,
    title: notificationData.title,
    message: notificationData.message,
    target_tags: notificationData.target_tags || [],
    reward_amount: notificationData.reward_amount,
    total_recipients: totalRecipients,
    total_cost: totalCost,
    created_at: new Date().toISOString()
  };
  
  await setDoc(doc(db, 'notifications', notificationId), notificationDoc);
  
  // Create user notifications and credit rewards
  for (const targetUser of targetUsers) {
    const userNotifId = `unotif_${Date.now()}_${targetUser.id.substring(0, 8)}`;
    const userNotifDoc = {
      id: userNotifId,
      notification_id: notificationId,
      user_id: targetUser.id,
      merchant_name: merchantName,
      title: notificationData.title,
      message: notificationData.message,
      reward_amount: notificationData.reward_amount,
      is_read: false,
      created_at: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'user_notifications', userNotifId), userNotifDoc);
    
    // Credit reward to user
    const userWalletRef = doc(db, 'wallets', targetUser.id);
    await updateDoc(userWalletRef, { balance: increment(notificationData.reward_amount) });
  }
  
  return notificationDoc;
}

/**
 * Get user's notifications
 */
export async function getUserNotifications(uid) {
  const q = query(
    collection(db, 'user_notifications'),
    where('user_id', '==', uid),
    orderBy('created_at', 'desc'),
    limit(100)
  );
  
  const querySnapshot = await getDocs(q);
  const notifications = [];
  querySnapshot.forEach(doc => notifications.push({ id: doc.id, ...doc.data() }));
  
  return notifications;
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId) {
  const notifRef = doc(db, 'user_notifications', notificationId);
  await updateDoc(notifRef, { is_read: true });
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(uid) {
  const q = query(
    collection(db, 'user_notifications'),
    where('user_id', '==', uid),
    where('is_read', '==', false)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.size;
}

// ========================
// REFERRAL FUNCTIONS
// ========================

/**
 * Get referral stats for user
 */
export async function getReferralStats(uid, user) {
  const q = query(
    collection(db, 'referrals'),
    where('referrer_id', '==', uid)
  );
  
  const querySnapshot = await getDocs(q);
  
  return {
    referral_code: user.referral_code,
    total_referrals: querySnapshot.size,
    up_points: user.up_points || 0
  };
}

// ========================
// CONSTANTS
// ========================

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
