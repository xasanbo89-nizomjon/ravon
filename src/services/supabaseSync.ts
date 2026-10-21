import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
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
import {
  DEMO_ORDER_IDS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_CATEGORIES,
  DEFAULT_CAR_MODELS,
} from '../data/initialData';

/**
 * Real-time Multi-Device & Multi-Tab Global Synchronization Service
 * (Cloud Firestore Collection `/ravon_products` + `/ravon_sync/main` + Supabase + Backend Server + BroadcastChannel)
 *
 * Guarantees that all products, categories, carModels, siteSettings, banner, promoCodes, reviews, and orders
 * added, edited, or deleted via the Admin Panel are saved to the global database and immediately visible
 * to all users on any phone or computer in real time.
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
  deletedProductIds?: string[];
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
const PRODUCTS_COLLECTION = 'ravon_products';
const DELETED_IDS_STORAGE_KEY = 'ravon_deleted_product_ids';

let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  broadcastChannel = null;
}

/**
 * Deeply removes `undefined` fields so Firestore `setDoc` never fails with
 * "Unsupported field value: undefined".
 */
export function stripUndefinedDeep<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

/**
 * Reads locally tracked deleted product IDs so deleted products never resurrect.
 */
export function getDeletedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set<string>(parsed.filter((id): id is string => typeof id === 'string'));
    }
  } catch {
    // ignore
  }
  return new Set<string>();
}

export function addDeletedProductIds(ids: string[]): string[] {
  const current = getDeletedProductIds();
  ids.forEach((id) => {
    if (id) current.add(id);
  });
  const list = Array.from(current);
  try {
    localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  return list;
}

/**
 * Compresses large Base64 data URLs on the client so product photos uploaded from
 * phones fit comfortably inside Firestore documents and load fast on mobile networks.
 */
export async function compressImageDataUrl(
  dataUrl: string,
  maxDim = 800,
  quality = 0.76
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  // If already small (< 120KB), keep as-is
  if (dataUrl.length < 160_000) {
    return dataUrl;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return dataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function normalizeProductsForCloud(products: Product[]): Promise<Product[]> {
  const cleaned = sanitizeProductsList(products);
  const normalized: Product[] = [];
  for (const prod of cleaned) {
    let image = prod.image || '';
    if (image.startsWith('data:image/') && image.length > 160_000) {
      image = await compressImageDataUrl(image, 760, 0.74);
    }
    const item: Product = {
      id: String(prod.id),
      name: String(prod.name || 'Zapchast'),
      bazaarName: String(prod.bazaarName || prod.name || 'Zapchast'),
      category: String(prod.category || 'Optika'),
      carModels: Array.isArray(prod.carModels) && prod.carModels.length > 0 ? prod.carModels : ['Gentra'],
      price: Number(prod.price) || 0,
      ...(prod.originalPrice ? { originalPrice: Number(prod.originalPrice) } : {}),
      image,
      inStock: prod.inStock ?? true,
      rating: Number(prod.rating) || 5.0,
      reviewCount: Number(prod.reviewCount) || 1,
      ...(prod.badge ? { badge: String(prod.badge) } : {}),
      description: String(prod.description || ''),
      specs: Array.isArray(prod.specs) ? prod.specs : [],
      tags: Array.isArray(prod.tags) ? prod.tags : [],
    };
    normalized.push(stripUndefinedDeep(item));
  }
  return normalized;
}

/**
 * Ensures siteSettings always enforces "Namangan viloyati, Uychi tumani".
 */
export function sanitizeSiteSettings(raw: Partial<SiteSettings> | undefined | null): {
  settings: SiteSettings;
  wasModified: boolean;
} {
  if (!raw || typeof raw !== 'object') {
    return { settings: { ...DEFAULT_SITE_SETTINGS }, wasModified: true };
  }

  const isCorrectCity = raw.addressCity === 'Namangan viloyati, Uychi tumani';
  const isCorrectDetails =
    typeof raw.addressDetails === 'string' &&
    raw.addressDetails.toLowerCase().includes('namangan') &&
    raw.addressDetails.toLowerCase().includes('uychi');
  const isCorrectMap =
    typeof raw.mapLocationUrl === 'string' &&
    raw.mapLocationUrl.toLowerCase().includes('namangan');

  const hasLegacyAddr = !isCorrectCity || !isCorrectDetails || !isCorrectMap;

  const hasLegacyPhone =
    !raw.phonePrimary ||
    String(raw.phonePrimary).includes('463-37-36') ||
    raw.telegramUsername === 'RavonAutoTuningUz';

  const settings: SiteSettings = stripUndefinedDeep({
    ...DEFAULT_SITE_SETTINGS,
    ...raw,
    addressCity: 'Namangan viloyati, Uychi tumani',
    addressBazaar: 'Namangan viloyati, Uychi tumani',
    addressDetails: 'Namangan viloyati, Uychi tumani • Ravon Auto Tuning markazi',
    mapLocationUrl: 'https://maps.google.com/?q=Namangan+viloyati,+Uychi+tumani',
    ...(hasLegacyPhone
      ? {
          phonePrimary: DEFAULT_SITE_SETTINGS.phonePrimary,
          phoneSecondary: DEFAULT_SITE_SETTINGS.phoneSecondary,
          telegramUsername: DEFAULT_SITE_SETTINGS.telegramUsername,
          telegramChannel: DEFAULT_SITE_SETTINGS.telegramChannel,
          whatsappUrl: DEFAULT_SITE_SETTINGS.whatsappUrl,
        }
      : {}),
  });

  return {
    settings,
    wasModified: hasLegacyAddr || hasLegacyPhone,
  };
}

/**
 * Strips any legacy static demo products (Zimmer LED, etc.) and explicitly deleted products.
 */
export function sanitizeProductsList(list: unknown, extraDeletedIds?: Iterable<string>): Product[] {
  if (!Array.isArray(list)) return [];
  const deletedSet = getDeletedProductIds();
  if (extraDeletedIds) {
    for (const id of extraDeletedIds) {
      if (id) deletedSet.add(id);
    }
  }
  const seen = new Set<string>();
  const result: Product[] = [];

  for (const item of list) {
    if (
      item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      item.id.trim().length > 0 &&
      !STATIC_DEMO_PRODUCT_IDS.has(item.id) &&
      !deletedSet.has(item.id) &&
      !seen.has(item.id)
    ) {
      seen.add(item.id);
      result.push(stripUndefinedDeep(item as Product));
    }
  }
  return result;
}

/**
 * Strips temporary test orders (RAV-849201, etc.) and orders with missing/static products.
 */
export function sanitizeOrdersList(list: unknown): OrderRecord[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((order): order is OrderRecord => {
      if (!order || typeof order !== 'object' || !order.id) return false;
      if (DEMO_ORDER_IDS.has(order.id)) return false;
      if (!Array.isArray(order.items)) return false;
      const validItems = order.items.filter(
        (it) => it && it.product && it.product.id && !STATIC_DEMO_PRODUCT_IDS.has(it.product.id)
      );
      return validItems.length > 0;
    })
    .map((o) => stripUndefinedDeep(o));
}

/**
 * Syncs individual product documents inside Firestore `/ravon_products/{productId}` collection
 * so there is never a single-document 1MB limit issue.
 */
async function syncProductsCollectionToFirestore(
  products: Product[],
  deletedIds: string[] = []
): Promise<void> {
  if (!db) return;

  try {
    // 1. Delete any explicitly removed product documents
    for (const delId of deletedIds) {
      if (delId) {
        try {
          await deleteDoc(doc(db, PRODUCTS_COLLECTION, delId));
        } catch {
          // ignore
        }
      }
    }

    // 2. Fetch existing docs in `/ravon_products` to remove stale docs not in `products`
    const existingSnap = await getDocs(collection(db, PRODUCTS_COLLECTION));
    const activeIds = new Set(products.map((p) => p.id));

    const deletePromises: Promise<void>[] = [];
    existingSnap.forEach((docSnap) => {
      if (!activeIds.has(docSnap.id)) {
        deletePromises.push(deleteDoc(doc(db, PRODUCTS_COLLECTION, docSnap.id)).catch(() => {}));
      }
    });
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }

    // 3. Upsert all active products as individual documents
    const writePromises = products.map((prod, idx) => {
      const docData = stripUndefinedDeep({
        ...prod,
        sortOrder: idx,
        updatedAt: Date.now(),
      });
      return setDoc(doc(db, PRODUCTS_COLLECTION, prod.id), docData).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, `${PRODUCTS_COLLECTION}/${prod.id}`);
      });
    });

    await Promise.all(writePromises);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, PRODUCTS_COLLECTION);
  }
}

/**
 * Explicitly deletes a product from all global stores (Firestore collection, main sync doc, backend, Supabase).
 */
export async function deleteProductFromCloud(
  productId: string,
  remainingProducts: Product[]
): Promise<void> {
  const deletedList = addDeletedProductIds([productId]);
  if (db) {
    try {
      await deleteDoc(doc(db, PRODUCTS_COLLECTION, productId));
    } catch {
      // ignore
    }
  }
  await pushRealtimeState({
    products: remainingProducts,
    deletedProductIds: deletedList,
  });
}

/**
 * Pushes updated state to:
 * 1. Cross-tab BroadcastChannel
 * 2. Cloud Firestore (`/ravon_products/{id}` collection + `/ravon_sync/main` document)
 * 3. Supabase table `ravon_store_state` (if configured)
 * 4. Backend Express server `/api/sync/state` (persisted to disk)
 */
export async function pushRealtimeState(partial: RavonSyncPayload): Promise<void> {
  const now = Date.now();
  const normalizedProducts =
    partial.products !== undefined ? await normalizeProductsForCloud(partial.products) : undefined;

  const deletedProductIds =
    partial.deletedProductIds !== undefined
      ? addDeletedProductIds(partial.deletedProductIds)
      : Array.from(getDeletedProductIds());

  const payload: RavonSyncPayload = stripUndefinedDeep({
    ...partial,
    ...(normalizedProducts !== undefined ? { products: normalizedProducts } : {}),
    ...(partial.orders !== undefined ? { orders: sanitizeOrdersList(partial.orders) } : {}),
    ...(partial.siteSettings !== undefined
      ? { siteSettings: sanitizeSiteSettings(partial.siteSettings).settings }
      : {}),
    deletedProductIds,
    updatedAt: now,
  });

  // 1. Broadcast immediately to other open browser tabs on the same device
  try {
    broadcastChannel?.postMessage(payload);
  } catch {
    // ignore
  }

  // 2. Sync to Cloud Firestore (`/ravon_products` collection + `/ravon_sync/main` doc)
  if (db) {
    if (normalizedProducts !== undefined) {
      await syncProductsCollectionToFirestore(normalizedProducts, deletedProductIds);
    }

    try {
      // Check serialized size of payload so `/ravon_sync/main` never exceeds Firestore's 1MB limit
      const serialized = JSON.stringify(payload);
      if (serialized.length < 850_000) {
        await setDoc(doc(db, 'ravon_sync', 'main'), payload, { merge: true });
      } else {
        // Store products in `/ravon_products` collection and keep metadata in `/ravon_sync/main`
        const { products: _omitProducts, ...metaOnly } = payload;
        await setDoc(doc(db, 'ravon_sync', 'main'), stripUndefinedDeep(metaOnly), { merge: true });
      }
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
    // Silent fallback
  }
}

/**
 * Pulls latest synchronized state from Cloud Firestore (`/ravon_products` + `/ravon_sync/main`),
 * Supabase, and Backend Server, combining them to return the most complete & up-to-date catalog.
 */
export async function pullRealtimeState(): Promise<RavonSyncPayload | null> {
  let firestoreMainData: RavonSyncPayload | null = null;
  let firestoreCollectionProducts: Product[] | null = null;
  let backendData: RavonSyncPayload | null = null;

  // 1. Pull from Cloud Firestore (`/ravon_sync/main` and `/ravon_products`)
  if (db) {
    try {
      const [mainSnap, productsSnap] = await Promise.all([
        getDoc(doc(db, 'ravon_sync', 'main')).catch(() => null),
        getDocs(collection(db, PRODUCTS_COLLECTION)).catch(() => null),
      ]);

      if (mainSnap && mainSnap.exists()) {
        firestoreMainData = mainSnap.data() as RavonSyncPayload;
        if (Array.isArray(firestoreMainData.deletedProductIds)) {
          addDeletedProductIds(firestoreMainData.deletedProductIds);
        }
      }

      if (productsSnap && !productsSnap.empty) {
        const docsList: Array<Product & { sortOrder?: number; updatedAt?: number }> = [];
        productsSnap.forEach((d) => {
          docsList.push(d.data() as Product & { sortOrder?: number; updatedAt?: number });
        });
        docsList.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
        firestoreCollectionProducts = sanitizeProductsList(docsList);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, SYNC_DOC_PATH);
    }
  }

  // 2. Pull from Backend Server (/api/sync/state)
  try {
    const res = await safeFetchJson<{ success: boolean; state?: RavonSyncPayload }>('/api/sync/state');
    if (res.ok && res.data?.success && res.data.state) {
      backendData = res.data.state;
      if (Array.isArray(backendData.deletedProductIds)) {
        addDeletedProductIds(backendData.deletedProductIds);
      }
    }
  } catch {
    // ignore
  }

  // 3. Pull from Supabase if configured and neither Firestore nor Backend had data
  let supabaseData: RavonSyncPayload | null = null;
  if (isSupabaseConfigured && !firestoreMainData && !backendData) {
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
          supabaseData = rows[0].payload as RavonSyncPayload;
        }
      }
    } catch {
      // ignore
    }
  }

  // Merge sources prioritizing the freshest timestamp and non-empty product collections
  const sources = [firestoreMainData, backendData, supabaseData].filter(
    (s): s is RavonSyncPayload => Boolean(s)
  );

  if (sources.length === 0 && !firestoreCollectionProducts) {
    return null;
  }

  // Sort sources by updatedAt descending
  sources.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const primary = sources[0] || {};

  // Determine the best products list across collection + main doc + backend
  let resolvedProducts: Product[] | undefined = undefined;
  if (firestoreCollectionProducts && firestoreCollectionProducts.length > 0) {
    resolvedProducts = firestoreCollectionProducts;
  } else {
    for (const src of sources) {
      if (Array.isArray(src.products)) {
        const cleaned = sanitizeProductsList(src.products);
        if (cleaned.length > 0 || resolvedProducts === undefined) {
          resolvedProducts = cleaned;
          if (cleaned.length > 0) break;
        }
      }
    }
  }

  const combined: RavonSyncPayload = {
    ...primary,
    ...(resolvedProducts !== undefined ? { products: resolvedProducts } : {}),
    updatedAt: primary.updatedAt || Date.now(),
  };

  if (combined.orders !== undefined) {
    combined.orders = sanitizeOrdersList(combined.orders);
  }
  if (combined.siteSettings !== undefined) {
    const { settings } = sanitizeSiteSettings(combined.siteSettings);
    combined.siteSettings = settings;
  }

  return combined;
}

/**
 * Subscribes to real-time updates across tabs (storage + BroadcastChannel)
 * and across all phones & computers (Cloud Firestore `ravon_products` + `ravon_sync/main` + Backend polling).
 */
export function subscribeToRealtimeSync(onUpdate: (payload: RavonSyncPayload) => void): () => void {
  const applyIncoming = (data: RavonSyncPayload | null) => {
    if (!data) return;

    if (Array.isArray(data.deletedProductIds)) {
      addDeletedProductIds(data.deletedProductIds);
    }
    if (data.products !== undefined) {
      data.products = sanitizeProductsList(data.products, data.deletedProductIds);
    }
    if (data.orders !== undefined) {
      data.orders = sanitizeOrdersList(data.orders);
    }
    if (data.siteSettings !== undefined) {
      const { settings } = sanitizeSiteSettings(data.siteSettings);
      data.siteSettings = settings;
    }
    onUpdate(data);
  };

  // 1. Cloud Firestore real-time listener on `/ravon_sync/main`
  let unsubscribeMainDoc: (() => void) | null = null;
  // 2. Cloud Firestore real-time listener on `/ravon_products` collection
  let unsubscribeProductsCol: (() => void) | null = null;

  if (db) {
    try {
      unsubscribeMainDoc = onSnapshot(
        doc(db, 'ravon_sync', 'main'),
        (snapshot) => {
          if (snapshot.exists()) {
            applyIncoming(snapshot.data() as RavonSyncPayload);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, SYNC_DOC_PATH);
        }
      );
    } catch {
      unsubscribeMainDoc = null;
    }

    try {
      unsubscribeProductsCol = onSnapshot(
        collection(db, PRODUCTS_COLLECTION),
        (querySnapshot) => {
          if (!querySnapshot.empty) {
            const docsList: Array<Product & { sortOrder?: number }> = [];
            querySnapshot.forEach((docSnap) => {
              docsList.push(docSnap.data() as Product & { sortOrder?: number });
            });
            docsList.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
            applyIncoming({
              products: sanitizeProductsList(docsList),
              updatedAt: Date.now(),
            });
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, PRODUCTS_COLLECTION);
        }
      );
    } catch {
      unsubscribeProductsCol = null;
    }
  }

  // 3. BroadcastChannel listener (same browser, multiple tabs)
  const handleBroadcast = (event: MessageEvent<RavonSyncPayload>) => {
    if (event?.data) {
      applyIncoming(event.data);
    }
  };
  broadcastChannel?.addEventListener('message', handleBroadcast);

  // 4. Native localStorage 'storage' event listener (cross-tab sync)
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

  // 5. Initial pull & automatic migration of any unsynced localStorage products/categories
  pullRealtimeState().then((remote) => {
    // Check if this browser has local products/categories added by Admin that aren't in the cloud yet
    let localProducts: Product[] = [];
    let localCategories: string[] = [];
    let localCarModels: string[] = [];

    try {
      const savedProds = localStorage.getItem('ravon_products');
      if (savedProds) {
        localProducts = sanitizeProductsList(JSON.parse(savedProds), remote?.deletedProductIds);
      }
      const savedCats = localStorage.getItem('ravon_categories');
      if (savedCats) {
        const parsedCats = JSON.parse(savedCats);
        if (Array.isArray(parsedCats)) localCategories = parsedCats;
      }
      const savedCars = localStorage.getItem('ravon_car_models');
      if (savedCars) {
        const parsedCars = JSON.parse(savedCars);
        if (Array.isArray(parsedCars)) localCarModels = parsedCars;
      }
    } catch {
      // ignore
    }

    const remoteProducts = remote?.products ? sanitizeProductsList(remote.products, remote.deletedProductIds) : [];
    const remoteIds = new Set(remoteProducts.map((p) => p.id));
    const unsyncedLocalProducts = localProducts.filter((p) => !remoteIds.has(p.id));

    const remoteCategories = Array.isArray(remote?.categories) ? remote!.categories : DEFAULT_CATEGORIES;
    const mergedCategories = Array.from(new Set([...remoteCategories, ...localCategories]));
    const hasNewLocalCategories = mergedCategories.length > remoteCategories.length;

    const remoteCarModels = Array.isArray(remote?.carModels) ? remote!.carModels : DEFAULT_CAR_MODELS;
    const mergedCarModels = Array.from(new Set([...remoteCarModels, ...localCarModels]));
    const hasNewLocalCarModels = mergedCarModels.length > remoteCarModels.length;

    if (unsyncedLocalProducts.length > 0 || hasNewLocalCategories || hasNewLocalCarModels) {
      const mergedProducts = [...unsyncedLocalProducts, ...remoteProducts];
      const mergedPayload: RavonSyncPayload = {
        ...(remote || {}),
        products: mergedProducts,
        categories: mergedCategories,
        carModels: mergedCarModels,
        updatedAt: Date.now(),
      };
      applyIncoming(mergedPayload);
      pushRealtimeState({
        products: mergedProducts,
        categories: mergedCategories,
        carModels: mergedCarModels,
      }).catch(() => {});
    } else if (remote) {
      applyIncoming(remote);
    }
  });

  // 6. Periodic background poll every 5 seconds for guaranteed sync across all networks
  const intervalId = window.setInterval(async () => {
    const remote = await pullRealtimeState();
    if (remote) {
      applyIncoming(remote);
    }
  }, 5000);

  return () => {
    if (unsubscribeMainDoc) unsubscribeMainDoc();
    if (unsubscribeProductsCol) unsubscribeProductsCol();
    broadcastChannel?.removeEventListener('message', handleBroadcast);
    window.removeEventListener('storage', handleStorageEvent);
    window.clearInterval(intervalId);
  };
}
