import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Product,
  SiteSettings,
  AnnouncementBanner,
  OrderRecord,
  PromoCode,
  ProductReview,
} from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { STATIC_DEMO_PRODUCT_IDS } from '../data/products';
import { DEMO_ORDER_IDS, DEFAULT_SITE_SETTINGS } from '../data/initialData';

/**
 * Real-time Multi-Device & Multi-Tab Synchronization Architecture
 * (Cloud Firestore Real-Time + Supabase REST/Realtime + Backend Sync + BroadcastChannel)
 *
 * Ensures customer & store data (products, orders, siteSettings, banner, categories, carModels, promoCodes, reviews)
 * stay synchronized in real-time between phone and desktop browsers.
 *
 * Security & Cleanliness Guarantees:
 * - Admin accounts and sessions are NEVER synced across devices.
 * - Deleted or static demo products (Zimmer LED, Optra Stop, etc.) and temporary test orders
 *   are strictly stripped and never reloaded when localStorage is empty or refreshed.
 */

export interface RavonSyncPayload {
  products?: Product[];
  orders?: OrderRecord[];
  siteSettings?: SiteSettings;
  announcementBanner?: AnnouncementBanner;
  carModels?: string[];
  categories?: string[];
  promoCodes?: PromoCode[];
  reviews?: ProductReview[];
  updatedAt?: number;
}

const SUPABASE_URL = (
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
    ? String(import.meta.env.VITE_SUPABASE_URL)
    : ''
)
  .trim()
  .replace(/\/+$/, '');

const SUPABASE_ANON_KEY = (
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY
    ? String(import.meta.env.VITE_SUPABASE_ANON_KEY)
    : ''
).trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const CHANNEL_NAME = 'ravon_realtime_sync_v1';
const SYNC_DOC_PATH = 'ravon_sync/main';
let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  broadcastChannel = null;
}

const LEGACY_ADDRESS_PATTERNS = [
  'toshkent',
  'sergeli',
  'sirg‘ali',
  "sirg'ali",
  'sirgali',
  'moshina bozor',
  'mashina bozor',
  '4-blok',
  '18-do‘kon',
  "18-do'kon",
  '18-dokon',
  'farhod',
];

function containsLegacyAddress(value: unknown): boolean {
  if (!value || typeof value !== 'string') return false;
  const lower = value.toLowerCase();
  return LEGACY_ADDRESS_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Ensures siteSettings never retains old Toshkent / Sergeli addresses or old phone numbers,
 * always enforcing "Namangan viloyati, Uychi tumani".
 */
export function sanitizeSiteSettings(raw: Partial<SiteSettings> | undefined | null): {
  settings: SiteSettings;
  wasModified: boolean;
} {
  if (!raw || typeof raw !== 'object') {
    return { settings: { ...DEFAULT_SITE_SETTINGS }, wasModified: true };
  }

  const hasLegacyAddr =
    raw.addressCity !== 'Namangan viloyati, Uychi tumani' ||
    containsLegacyAddress(raw.addressCity) ||
    containsLegacyAddress(raw.addressBazaar) ||
    containsLegacyAddress(raw.addressDetails) ||
    containsLegacyAddress(raw.mapLocationUrl);

  const hasLegacyPhone =
    !raw.phonePrimary ||
    String(raw.phonePrimary).includes('463-37-36') ||
    raw.telegramUsername === 'RavonAutoTuningUz';

  const settings: SiteSettings = {
    ...DEFAULT_SITE_SETTINGS,
    ...raw,
    addressCity: 'Namangan viloyati, Uychi tumani',
    addressBazaar: containsLegacyAddress(raw.addressBazaar)
      ? DEFAULT_SITE_SETTINGS.addressBazaar
      : raw.addressBazaar || DEFAULT_SITE_SETTINGS.addressBazaar,
    addressDetails: containsLegacyAddress(raw.addressDetails)
      ? DEFAULT_SITE_SETTINGS.addressDetails
      : raw.addressDetails || DEFAULT_SITE_SETTINGS.addressDetails,
    mapLocationUrl: containsLegacyAddress(raw.mapLocationUrl)
      ? DEFAULT_SITE_SETTINGS.mapLocationUrl
      : raw.mapLocationUrl || DEFAULT_SITE_SETTINGS.mapLocationUrl,
    ...(hasLegacyPhone
      ? {
          phonePrimary: DEFAULT_SITE_SETTINGS.phonePrimary,
          phoneSecondary: DEFAULT_SITE_SETTINGS.phoneSecondary,
          telegramUsername: DEFAULT_SITE_SETTINGS.telegramUsername,
          telegramChannel: DEFAULT_SITE_SETTINGS.telegramChannel,
          whatsappUrl: DEFAULT_SITE_SETTINGS.whatsappUrl,
        }
      : {}),
  };

  return {
    settings,
    wasModified: hasLegacyAddr || hasLegacyPhone,
  };
}

/**
 * Strips any legacy static demo products (Zimmer LED, etc.) from a products list.
 */
export function sanitizeProductsList(list: unknown): Product[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is Product =>
      Boolean(item && typeof item === 'object' && item.id && !STATIC_DEMO_PRODUCT_IDS.has(item.id))
  );
}

/**
 * Strips temporary test orders (RAV-849201, etc.) and orders with missing/static products.
 */
export function sanitizeOrdersList(list: unknown): OrderRecord[] {
  if (!Array.isArray(list)) return [];
  return list.filter((order): order is OrderRecord => {
    if (!order || typeof order !== 'object' || !order.id) return false;
    if (DEMO_ORDER_IDS.has(order.id)) return false;
    if (!Array.isArray(order.items)) return false;
    const validItems = order.items.filter(
      (it) => it && it.product && it.product.id && !STATIC_DEMO_PRODUCT_IDS.has(it.product.id)
    );
    return validItems.length > 0;
  });
}

/**
 * Pushes updated state to:
 * 1. Cross-tab BroadcastChannel
 * 2. Cloud Firestore (`/ravon_sync/main`) for instant real-time Phone <-> Computer sync
 * 3. Supabase table `ravon_store_state` (if VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY are configured)
 * 4. Internal Express backend `/api/sync/state` fallback
 */
export async function pushRealtimeState(partial: RavonSyncPayload): Promise<void> {
  const payload: RavonSyncPayload = {
    ...partial,
    ...(partial.products !== undefined ? { products: sanitizeProductsList(partial.products) } : {}),
    ...(partial.orders !== undefined ? { orders: sanitizeOrdersList(partial.orders) } : {}),
    ...(partial.siteSettings !== undefined
      ? { siteSettings: sanitizeSiteSettings(partial.siteSettings).settings }
      : {}),
    updatedAt: Date.now(),
  };

  // 1. Broadcast immediately to other open browser tabs on the same device
  try {
    broadcastChannel?.postMessage(payload);
  } catch {
    // ignore
  }

  // 2. Sync to Cloud Firestore for instant cross-device (Phone <-> Desktop) real-time updates
  if (db) {
    try {
      await setDoc(doc(db, 'ravon_sync', 'main'), payload, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, SYNC_DOC_PATH);
    }
  }

  // 3. Sync to Supabase REST API if configured
  if (isSupabaseConfigured) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/ravon_store_state?id=eq.main`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: 'main',
          payload,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch {
      // Fallback silently
    }
  }

  // 4. Sync to Backend Real-time Store (/api/sync/state)
  try {
    await safeFetchJson('/api/sync/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silent fallback so UI never shows technical errors
  }
}

/**
 * Pulls latest synchronized state from Cloud Firestore, Supabase, or Backend Server.
 */
export async function pullRealtimeState(): Promise<RavonSyncPayload | null> {
  // 1. Try Cloud Firestore first
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'ravon_sync', 'main'));
      if (snap.exists()) {
        const data = snap.data() as RavonSyncPayload;
        if (data.products !== undefined) {
          data.products = sanitizeProductsList(data.products);
        }
        if (data.orders !== undefined) {
          data.orders = sanitizeOrdersList(data.orders);
        }
        if (data.siteSettings !== undefined) {
          const { settings, wasModified } = sanitizeSiteSettings(data.siteSettings);
          data.siteSettings = settings;
          if (wasModified) {
            pushRealtimeState({ siteSettings: settings }).catch(() => {});
          }
        }
        return data;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, SYNC_DOC_PATH);
    }
  }

  // 2. Try Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/ravon_store_state?id=eq.main&select=payload`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.payload) {
          const remote = rows[0].payload as RavonSyncPayload;
          if (remote.products !== undefined) {
            remote.products = sanitizeProductsList(remote.products);
          }
          if (remote.orders !== undefined) {
            remote.orders = sanitizeOrdersList(remote.orders);
          }
          if (remote.siteSettings !== undefined) {
            remote.siteSettings = sanitizeSiteSettings(remote.siteSettings).settings;
          }
          return remote;
        }
      }
    } catch {
      // Fallback to internal server sync
    }
  }

  // 3. Pull from internal backend sync store
  const res = await safeFetchJson<{ success: boolean; state?: RavonSyncPayload }>('/api/sync/state');
  if (res.ok && res.data?.success && res.data.state) {
    const state = res.data.state;
    if (state.products !== undefined) {
      state.products = sanitizeProductsList(state.products);
    }
    if (state.orders !== undefined) {
      state.orders = sanitizeOrdersList(state.orders);
    }
    if (state.siteSettings !== undefined) {
      state.siteSettings = sanitizeSiteSettings(state.siteSettings).settings;
    }
    return state;
  }

  return null;
}

/**
 * Subscribes to real-time updates across tabs (storage + BroadcastChannel)
 * and across devices (Cloud Firestore onSnapshot + Supabase / Backend polling).
 */
export function subscribeToRealtimeSync(onUpdate: (payload: RavonSyncPayload) => void): () => void {
  let lastAppliedTimestamp = 0;

  const handleIncoming = (data: RavonSyncPayload | null) => {
    if (!data) return;
    const ts = data.updatedAt || Date.now();
    if (ts <= lastAppliedTimestamp) return;
    lastAppliedTimestamp = ts;

    if (data.products !== undefined) {
      data.products = sanitizeProductsList(data.products);
    }
    if (data.orders !== undefined) {
      data.orders = sanitizeOrdersList(data.orders);
    }
    if (data.siteSettings !== undefined) {
      const { settings, wasModified } = sanitizeSiteSettings(data.siteSettings);
      data.siteSettings = settings;
      if (wasModified) {
        pushRealtimeState({ siteSettings: settings }).catch(() => {});
      }
    }
    onUpdate(data);
  };

  // 1. Cloud Firestore real-time listener (instant Phone <-> Computer sync)
  let unsubscribeFirestore: (() => void) | null = null;
  if (db) {
    try {
      unsubscribeFirestore = onSnapshot(
        doc(db, 'ravon_sync', 'main'),
        (snapshot) => {
          if (snapshot.exists()) {
            handleIncoming(snapshot.data() as RavonSyncPayload);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, SYNC_DOC_PATH);
        }
      );
    } catch {
      unsubscribeFirestore = null;
    }
  }

  // 2. BroadcastChannel listener (same browser, multiple tabs)
  const handleBroadcast = (event: MessageEvent<RavonSyncPayload>) => {
    if (event?.data) {
      handleIncoming(event.data);
    }
  };
  broadcastChannel?.addEventListener('message', handleBroadcast);

  // 3. Native localStorage 'storage' event listener (cross-tab sync when localStorage is modified or cleared)
  const handleStorageEvent = (e: StorageEvent) => {
    try {
      if (e.key === null) {
        onUpdate({ products: [], orders: [], updatedAt: Date.now() });
        return;
      }
      if (e.key === 'ravon_products') {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        onUpdate({ products: sanitizeProductsList(parsed), updatedAt: Date.now() });
      } else if (e.key === 'ravon_orders') {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        onUpdate({ orders: sanitizeOrdersList(parsed), updatedAt: Date.now() });
      } else if (e.key === 'ravon_site_settings' && e.newValue) {
        onUpdate({
          siteSettings: sanitizeSiteSettings(JSON.parse(e.newValue)).settings,
          updatedAt: Date.now(),
        });
      } else if (e.key === 'ravon_announcement' && e.newValue) {
        onUpdate({ announcementBanner: JSON.parse(e.newValue), updatedAt: Date.now() });
      } else if (e.key === 'ravon_car_models' && e.newValue) {
        onUpdate({ carModels: JSON.parse(e.newValue), updatedAt: Date.now() });
      } else if (e.key === 'ravon_categories' && e.newValue) {
        onUpdate({ categories: JSON.parse(e.newValue), updatedAt: Date.now() });
      } else if (e.key === 'ravon_promocodes' && e.newValue) {
        onUpdate({ promoCodes: JSON.parse(e.newValue), updatedAt: Date.now() });
      } else if (e.key === 'ravon_product_reviews') {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        onUpdate({ reviews: Array.isArray(parsed) ? parsed : [], updatedAt: Date.now() });
      }
    } catch {
      // ignore malformed storage values
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  // 4. Initial pull & periodic fallback sync
  pullRealtimeState().then((remote) => {
    if (remote && remote.updatedAt) {
      handleIncoming(remote);
    }
  });

  const intervalId = window.setInterval(async () => {
    const remote = await pullRealtimeState();
    if (remote && remote.updatedAt && remote.updatedAt > lastAppliedTimestamp) {
      handleIncoming(remote);
    }
  }, 8000);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    broadcastChannel?.removeEventListener('message', handleBroadcast);
    window.removeEventListener('storage', handleStorageEvent);
    window.clearInterval(intervalId);
  };
}
