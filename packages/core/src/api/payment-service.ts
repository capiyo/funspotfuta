// Ported from funspot/lib/services/payment_service.dart — M-Pesa (Safaricom
// Kenya) STK push deposits, balance, and transaction history, against the
// same live backend. Admin-only B2C payouts / engagement-payout compute are
// included too since they're just typed wrappers around existing endpoints
// (no new capability introduced by porting them) — gate their UI to admins
// in whatever screen calls them.
//
// TransactionLocalStorage (SharedPreferences 5-minute balance/transaction
// cache in the original) is intentionally NOT ported — it was a pure
// offline-friendliness optimization for a mobile app with unreliable
// connectivity; on the web, re-fetching is simpler and always fresher.

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';
const REQUEST_TIMEOUT_MS = 30000;
const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_ATTEMPTS = 90; // 3 minutes

function buildHeaders(authToken?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '');
  // Kenyan mobile numbers: 07xx/01xx ranges, optionally prefixed 0 or 254.
  return /^(0|254)?(7[0-9]{8}|1(?:0[0-6]|1[0-5])[0-9]{6})$/.test(cleaned);
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) return `254${cleaned.slice(1)}`;
  if (cleaned.length === 9 && (cleaned.startsWith('7') || cleaned.startsWith('1'))) return `254${cleaned}`;
  return cleaned;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
export interface STKPushResult {
  success: boolean;
  message?: string;
  transactionId?: string;
  mpesaCode?: string;
  newBalance?: number;
}
export interface STKStatusResult {
  status: 'completed' | 'failed' | 'cancelled' | 'pending' | 'error';
  message?: string;
  transactionId?: string;
  mpesaCode?: string;
}
export interface B2CResult {
  success: boolean;
  message?: string;
  transactionId?: string;
  /**
   * Post-withdrawal balance as returned by the B2C endpoint. Present
   * only on success when the server includes `new_balance` in its
   * response. Matches the Flutter B2CResult.newBalance field.
   */
  newBalance?: number;
}
export interface AdminPayoutResult {
  success: boolean;
  message?: string;
  amount?: number;
  payoutType?: string;
  status?: string;
  computedAt?: Date;
}

export interface PaymentTransaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  createdAt: Date;
  [key: string]: any;
}

// ── Display helpers ─────────────────────────────────────────────────
// Ported from the Flutter PaymentTransaction computed getters
// (statusDisplay / typeDisplay / statusColor). The RN model keeps the
// raw `[key: string]: any` index signature, so any additional backend
// fields survive untouched — these helpers only cover what the Flutter
// source exposed as getters.

export function transactionStatusDisplay(tx: PaymentTransaction): string {
  switch (tx.status) {
    case 'pending':
      return '⏳ Pending';
    case 'processing':
      return '🔄 Processing';
    case 'completed':
      return '✅ Completed';
    case 'failed':
      return '❌ Failed';
    case 'cancelled':
      return '🚫 Cancelled';
    case 'refunded':
      return '↩️ Refunded';
    default:
      return tx.status;
  }
}

export function transactionTypeDisplay(tx: PaymentTransaction): string {
  switch (tx.type) {
    case 'deposit':
      return '💰 Deposit';
    case 'withdrawal':
      return '🏦 Withdrawal';
    case 'pledge':
      return '🎯 Pledge';
    case 'payout':
      return '🏆 Payout';
    case 'refund':
      return '↩️ Refund';
    case 'fee':
      return '💸 Fee';
    default:
      return tx.type;
  }
}

/**
 * Hex color string for a transaction status. These are the same values
 * the Flutter PaymentTransaction.statusColor getter returns, kept as
 * raw hex because they're status colors, not theme colors, and aren't
 * part of the FanColorPalette token set.
 */
export function transactionStatusColor(tx: PaymentTransaction): string {
  switch (tx.status) {
    case 'pending':
      return '#FFA726';
    case 'processing':
      return '#42A5F5';
    case 'completed':
      return '#66BB6A';
    case 'failed':
      return '#EF5350';
    case 'cancelled':
      return '#78909C';
    case 'refunded':
      return '#AB47BC';
    default:
      return '#9E9E9E';
  }
}

function paymentTransactionFromJson(json: any): PaymentTransaction {
  return {
    id: (json._id ?? json.id ?? '').toString(),
    type: json.type ?? 'unknown',
    status: json.status ?? 'unknown',
    amount: Number(json.amount ?? 0),
    createdAt: json.created_at ? new Date(json.created_at) : new Date(),
    ...json,
  };
}

function stkStatusFromJson(json: any): STKStatusResult {
  const status = (json.status ?? 'pending').toString().toLowerCase();
  // Normalizes to one of the four known values. Unknown server-side
  // statuses (e.g. 'expired', 'timeout') become 'pending' — the polling
  // loop keeps polling until MAX_POLLING_ATTEMPTS in that case, which
  // matches the Flutter behavior of falling through to its timeout.
  const normalized: STKStatusResult['status'] =
    status === 'completed' || status === 'failed' || status === 'cancelled'
      ? (status as any)
      : 'pending';
  return {
    status: normalized,
    message: json.message,
    transactionId: json.transaction_id?.toString(),
    mpesaCode: json.mpesa_code?.toString(),
  };
}

// ---------------------------------------------------------------------------
// STK PUSH (deposits)
// ---------------------------------------------------------------------------
export interface InitiateSTKPushParams {
  userId: string;
  username: string;
  amount: number;
  phoneNumber?: string;
  authToken?: string;
  purpose?: string;
  channelId?: string;
  fixtureId?: string;
  voteId?: string;
}

export async function initiateSTKPush(p: InitiateSTKPushParams): Promise<STKPushResult> {
  if (p.amount < 1.0) return { success: false, message: 'Minimum amount is KES 1.00' };
  if (p.amount > 100000.0) return { success: false, message: 'Maximum amount is KES 100,000.00' };

  let phone = p.phoneNumber ?? '';
  if (!phone) phone = await getUserPhone(p.userId, p.authToken);
  if (!phone || !isValidPhoneNumber(phone)) return { success: false, message: 'Valid phone number is required' };

  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/lipaclash/stk-push`,
      {
        method: 'POST',
        headers: buildHeaders(p.authToken),
        body: JSON.stringify({
          phone_number: normalizePhone(phone),
          amount: String(p.amount),
          account_reference: p.username,
          transaction_desc: p.purpose ?? 'Top up balance',
          user_id: p.userId,
          channel_id: p.channelId,
          fixture_id: p.fixtureId,
          vote_id: p.voteId,
          timestamp: new Date().toISOString(),
        }),
      },
      REQUEST_TIMEOUT_MS
    );

    if (!res.ok) return { success: false, message: 'Payment service unavailable' };
    const data = await res.json();
    if (data.success !== true) return { success: false, message: data.message ?? 'Payment initiation failed' };

    const checkoutRequestId = data.checkout_request_id?.toString() ?? '';
    return pollSTKStatus(checkoutRequestId, p.userId, p.authToken);
  } catch (e: any) {
    return { success: false, message: `Network error: ${e?.message ?? e}` };
  }
}

async function pollSTKStatus(checkoutRequestId: string, userId: string, authToken?: string): Promise<STKPushResult> {
  for (let attempts = 0; attempts < MAX_POLLING_ATTEMPTS; attempts++) {
    await new Promise((r) => setTimeout(r, POLLING_INTERVAL_MS));
    try {
      const result = await checkSTKStatus(checkoutRequestId, authToken);
      if (result.status === 'completed') {
        const balance = await getUserBalance(userId, authToken, true);
        return {
          success: true,
          transactionId: result.transactionId ?? '',
          mpesaCode: result.mpesaCode,
          newBalance: balance,
          message: 'Payment completed successfully',
        };
      }
      if (result.status === 'failed') return { success: false, message: result.message ?? 'Payment failed' };
      if (result.status === 'cancelled') return { success: false, message: 'Payment cancelled by user' };
    } catch {
      // continue polling on transient error, matching the original
    }
  }
  return {
    success: false,
    message: 'Payment is still processing. Please check your M-Pesa and refresh your balance.',
  };
}

// POST /api/lipaclash/check-payment-status
export async function checkSTKStatus(checkoutRequestId: string, authToken?: string): Promise<STKStatusResult> {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/lipaclash/check-payment-status`,
      {
        method: 'POST',
        headers: buildHeaders(authToken),
        body: JSON.stringify({ checkout_request_id: checkoutRequestId }),
      },
      10000
    );
    if (res.ok) return stkStatusFromJson(await res.json());
    return { status: 'pending' };
  } catch (e: any) {
    return { status: 'error', message: e?.message ?? String(e) };
  }
}

// ---------------------------------------------------------------------------
// B2C (admin withdrawals/payouts)
// ---------------------------------------------------------------------------
export interface InitiateB2CPaymentParams {
  userId: string;
  username: string;
  channelId: string;
  amount: number;
  phoneNumber: string;
  authToken?: string;
  remarks?: string;
  occasion?: string;
}

// POST /api/lipaclash/b2c/send
export async function initiateB2CPayment(p: InitiateB2CPaymentParams): Promise<B2CResult> {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/lipaclash/b2c/send`,
      {
        method: 'POST',
        headers: buildHeaders(p.authToken),
        body: JSON.stringify({
          user_id: p.userId,
          username: p.username,
          channel_id: p.channelId,
          amount: p.amount,
          phone_number: normalizePhone(p.phoneNumber),
          remarks: p.remarks,
          occasion: p.occasion,
        }),
      },
      REQUEST_TIMEOUT_MS
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        success: true,
        transactionId: data.transaction_id?.toString(),
        newBalance:
          data.new_balance != null ? Number(data.new_balance) : undefined,
        message: data.message,
      };
    }
    return { success: false, message: data.message ?? 'B2C payment failed' };
  } catch (e: any) {
    return { success: false, message: `Network error: ${e?.message ?? e}` };
  }
}

// POST /api/channels/:channelId/admin-payout/compute
export async function computeAdminPayout(channelId: string, authToken?: string): Promise<AdminPayoutResult> {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/channels/${channelId}/admin-payout/compute`,
      { method: 'POST', headers: buildHeaders(authToken) },
      REQUEST_TIMEOUT_MS
    );
    if (!res.ok) return { success: false, message: `Server error: ${res.status}` };
    const data = await res.json();
    if (data.success === true && data.payout) {
      return {
        success: true,
        amount: Number(data.payout.amount ?? 0),
        payoutType: data.payout.payout_type?.toString() ?? 'engagement_rate',
        status: data.payout.status?.toString() ?? 'pending',
        computedAt: data.payout.created_at ? new Date(data.payout.created_at) : new Date(),
      };
    }
    return { success: false, message: data.message ?? 'Failed to compute payout' };
  } catch (e: any) {
    return { success: false, message: `Network error: ${e?.message ?? e}` };
  }
}

// ---------------------------------------------------------------------------
// BALANCE
// ---------------------------------------------------------------------------

// GET /api/auth/user/id/:userId -> user.balance
export async function getUserBalance(userId: string, authToken?: string, forceRefresh = false): Promise<number> {
  try {
    const headers: Record<string, string> = { ...(buildHeaders(authToken) as Record<string, string>) };
    if (forceRefresh) headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    const res = await fetchWithTimeout(`${API_BASE_URL}/auth/user/id/${userId}`, { headers }, 10000);
    if (!res.ok) return 0;
    const data = await res.json();
    if (data.success === true) return Number(data.user?.balance ?? 0);
    return 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// PHONE PERSISTENCE
// Ported from the Flutter profile modal's _saveTopUpPhone / _saveWithdrawPhone
// and _fetchSavedPhones. The two endpoints store the last phone the user
// used for that flow so the dialogs can pre-fill it next time.
// ---------------------------------------------------------------------------

export type SavedPhoneKind = 'topup' | 'withdraw';

// GET /api/auth/user/:userId/topup-phone  or  /withdraw-phone
export async function getSavedPhone(
  userId: string,
  kind: SavedPhoneKind,
  authToken?: string
): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/auth/user/${userId}/${kind}-phone`,
      { headers: buildHeaders(authToken) },
      5000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success === true) {
      const phone = data.phone?.toString();
      if (phone && isValidPhoneNumber(phone)) return phone;
    }
    return null;
  } catch {
    return null;
  }
}

// POST /api/auth/user/:userId/topup-phone  or  /withdraw-phone
export async function savePhone(
  userId: string,
  kind: SavedPhoneKind,
  phone: string,
  authToken?: string
): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/auth/user/${userId}/${kind}-phone`,
      {
        method: 'POST',
        headers: buildHeaders(authToken),
        body: JSON.stringify({ phone }),
      },
      5000
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// Kept for API-shape compatibility with existing callers that pass a
// single kind to a function returning { topup, withdraw } — the profile
// modal fetches both via two parallel getSavedPhone() calls now.
export async function getSavedPhones(
  userId: string,
  authToken?: string
): Promise<{ topup: string | null; withdraw: string | null }> {
  const [topup, withdraw] = await Promise.all([
    getSavedPhone(userId, 'topup', authToken),
    getSavedPhone(userId, 'withdraw', authToken),
  ]);
  return { topup, withdraw };
}

// ---------------------------------------------------------------------------
// USER PHONE (fallback when no saved phone exists for a flow)
// ---------------------------------------------------------------------------

// GET /api/auth/user/id/:userId -> user.phone, with the topup-phone
// endpoint tried first (matching the Flutter _getUserPhone fallback chain).
export async function getUserPhone(userId: string, authToken?: string): Promise<string> {
  const saved = await getSavedPhone(userId, 'topup', authToken);
  if (saved) return saved;

  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/auth/user/id/${userId}`,
      { headers: buildHeaders(authToken) },
      10000
    );
    if (res.ok) {
      const data = await res.json();
      if (data.success === true) {
        const phone = data.user?.phone?.toString() ?? '';
        if (phone && isValidPhoneNumber(phone)) return phone;
      }
    }
  } catch {
    /* give up, matches original returning '' */
  }
  return '';
}

// ---------------------------------------------------------------------------
// TRANSACTION HISTORY
// ---------------------------------------------------------------------------

export interface TransactionHistoryResult {
  success: boolean;
  transactions: PaymentTransaction[];
  total: number;
  hasMore: boolean;
  error?: string;
}

export interface GetTransactionHistoryParams {
  userId: string;
  authToken?: string;
  limit?: number;
  offset?: number;
  type?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
}

// GET /api/transactions/user/:userId
export async function getTransactionHistory(p: GetTransactionHistoryParams): Promise<TransactionHistoryResult> {
  try {
    const params = new URLSearchParams({
      limit: String(p.limit ?? 50),
      offset: String(p.offset ?? 0),
    });
    if (p.type) params.set('type', p.type);
    if (p.status) params.set('status', p.status);
    if (p.fromDate) params.set('from', p.fromDate.toISOString());
    if (p.toDate) params.set('to', p.toDate.toISOString());

    const res = await fetchWithTimeout(
      `${API_BASE_URL}/transactions/user/${p.userId}?${params.toString()}`,
      { headers: buildHeaders(p.authToken) },
      REQUEST_TIMEOUT_MS
    );
    if (!res.ok) return { success: false, transactions: [], total: 0, hasMore: false, error: 'Failed to fetch transactions' };
    const data = await res.json();
    const transactions: PaymentTransaction[] = Array.isArray(data.data) ? data.data.map(paymentTransactionFromJson) : [];
    return { success: true, transactions, total: data.total ?? transactions.length, hasMore: data.has_more ?? false };
  } catch (e: any) {
    return { success: false, transactions: [], total: 0, hasMore: false, error: `Network error: ${e?.message ?? e}` };
  }
}