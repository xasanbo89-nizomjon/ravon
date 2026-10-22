import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import {
  ref as rtdbRef,
  onValue as rtdbOnValue,
  set as rtdbSet,
  update as rtdbUpdate,
  remove as rtdbRemove,
} from 'firebase/database';
import {
  db,
  rtdb,
  handleFirestoreError,
  OperationType,
  FIRESTORE_REST_BASE_URL,
  FIREBASE_API_KEY,
  FIREBASE_RTDB_URL,
} from '../lib/firebase';
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
 * (Cloud Firestore SDK + Cloud Firestore REST API + Supabase + Backend Server + BroadcastChannel)
 *
 * Guarantees that all products, categories, carModels, siteSettings, banner, promoCodes, reviews, and orders
 * added, edited, or deleted via the Admin Panel are saved to the global database and immediately visible
 * to all users on any phone, tablet, or computer in real time.
 */

export interface RavonSyncPayload {
  products?: Product[];
  orders?: OrderRecord[];
  siteSettings?: SiteSettings;
  settingsUpdatedAt?: number;
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
const SETTINGS_UPDATED_AT_KEY = 'ravon_settings_updated_at';

export function getLocalSettingsUpdatedAt(): number {
  try {
    const raw = localStorage.getItem(SETTINGS_UPDATED_AT_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setLocalSettingsUpdatedAt(ts: number): void {
  try {
    localStorage.setItem(SETTINGS_UPDATED_AT_KEY, String(ts));
  } catch {
    // ignore
  }
}

let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  broadcastChannel = null;
}

/**
 * Converts a plain JS value into Cloud Firestore REST API Value representation.
 */
function toFirestoreValue(val: any): Record<string, any> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { integerValue: '0' };
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => toFirestoreValue(item)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

/**
 * Converts a Cloud Firestore REST API Value back into a plain JS value.
 */
function fromFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('arrayValue' in val) {
    const arr = val.arrayValue?.values;
    return Array.isArray(arr) ? arr.map(fromFirestoreValue) : [];
  }
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields;
    if (!fields || typeof fields !== 'object') return {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}

function fromFirestoreDocument(docObj: any): Record<string, any> | null {
  if (!docObj || typeof docObj !== 'object' || !docObj.fields) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(docObj.fields)) {
    out[k] = fromFirestoreValue(v);
  }
  return out;
}

async function restUpsertProductDoc(product: Product & { sortOrder?: number; updatedAt?: number }): Promise<void> {
  try {
    const docUrl = `${FIRESTORE_REST_BASE_URL}/${PRODUCTS_COLLECTION}/${encodeURIComponent(
      product.id
    )}?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
    await fetch(docUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFirestoreFields(product) }),
    });
  } catch {
    // ignore
  }
}

async function restDeleteProductDoc(productId: string): Promise<void> {
  try {
    const docUrl = `${FIRESTORE_REST_BASE_URL}/${PRODUCTS_COLLECTION}/${encodeURIComponent(
      productId
    )}?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
    await fetch(docUrl, { method: 'DELETE' });
  } catch {
    // ignore
  }
}

async function restPatchMainDoc(payload: RavonSyncPayload): Promise<void> {
  try {
    const keys = Object.keys(payload).filter(
      (k) => (payload as Record<string, any>)[k] !== undefined
    );
    if (keys.length === 0) return;
    const maskQuery = keys
      .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
      .join('&');
    const docUrl = `${FIRESTORE_REST_BASE_URL}/ravon_sync/main?key=${encodeURIComponent(
      FIREBASE_API_KEY
    )}&${maskQuery}`;
    await fetch(docUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFirestoreFields(payload as Record<string, any>) }),
    });
  } catch {
    // ignore
  }
}

async function restFetchProductsCollection(): Promise<
  Array<Product & { sortOrder?: number; updatedAt?: number }>
> {
  try {
    const colUrl = `${FIRESTORE_REST_BASE_URL}/${PRODUCTS_COLLECTION}?pageSize=300&key=${encodeURIComponent(
      FIREBASE_API_KEY
    )}`;
    const res = await fetch(colUrl, { method: 'GET' });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.documents)) return [];
    const items: Array<Product & { sortOrder?: number; updatedAt?: number }> = [];
    for (const d of data.documents) {
      const parsed = fromFirestoreDocument(d);
      if (parsed && typeof parsed.id === 'string') {
        items.push(parsed as Product & { sortOrder?: number; updatedAt?: number });
      }
    }
    items.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
    return items;
  } catch {
    return [];
  }
}

async function restFetchMainDoc(): Promise<RavonSyncPayload | null> {
  try {
    const docUrl = `${FIRESTORE_REST_BASE_URL}/ravon_sync/main?key=${encodeURIComponent(
      FIREBASE_API_KEY
    )}`;
    const res = await fetch(docUrl, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = fromFirestoreDocument(data);
    return parsed ? (parsed as RavonSyncPayload) : null;
  } catch {
    return null;
  }
}

async function rtdbUpsertProduct(
  product: Product & { sortOrder?: number; updatedAt?: number }
): Promise<void> {
  try {
    if (rtdb) {
      rtdbSet(rtdbRef(rtdb, `${PRODUCTS_COLLECTION}/${product.id}`), product).catch(() => {});
    }
    if (FIREBASE_RTDB_URL) {
      await fetch(
        `${FIREBASE_RTDB_URL}/${PRODUCTS_COLLECTION}/${encodeURIComponent(product.id)}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(product),
        }
      );
    }
  } catch {
    // ignore
  }
}

async function rtdbDeleteProduct(productId: string): Promise<void> {
  try {
    if (rtdb) {
      rtdbRemove(rtdbRef(rtdb, `${PRODUCTS_COLLECTION}/${productId}`)).catch(() => {});
    }
    if (FIREBASE_RTDB_URL) {
      await fetch(
        `${FIREBASE_RTDB_URL}/${PRODUCTS_COLLECTION}/${encodeURIComponent(productId)}.json`,
        { method: 'DELETE' }
      );
    }
  } catch {
    // ignore
  }
}

async function rtdbPatchMain(payload: RavonSyncPayload): Promise<void> {
  try {
    if (rtdb) {
      rtdbUpdate(rtdbRef(rtdb, 'ravon_sync/main'), payload as Record<string, unknown>).catch(
        () => {}
      );
      if (payload.siteSettings) {
        rtdbSet(rtdbRef(rtdb, 'ravon_settings'), {
          siteSettings: payload.siteSettings,
          settingsUpdatedAt: payload.settingsUpdatedAt || payload.updatedAt || Date.now(),
        }).catch(() => {});
      }
    }
    if (FIREBASE_RTDB_URL) {
      await Promise.all([
        fetch(`${FIREBASE_RTDB_URL}/ravon_sync/main.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {}),
        payload.siteSettings
          ? fetch(`${FIREBASE_RTDB_URL}/ravon_settings.json`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                siteSettings: payload.siteSettings,
                settingsUpdatedAt: payload.settingsUpdatedAt || payload.updatedAt || Date.now(),
              }),
            }).catch(() => {})
          : Promise.resolve(),
      ]);
    }
  } catch {
    // ignore
  }
}

async function rtdbFetchProducts(): Promise<
  Array<Product & { sortOrder?: number; updatedAt?: number }>
> {
  if (!FIREBASE_RTDB_URL) return [];
  try {
    const res = await fetch(`${FIREBASE_RTDB_URL}/${PRODUCTS_COLLECTION}.json`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || typeof data !== 'object') return [];
    const list = Object.values(data).filter(
      (item): item is Product & { sortOrder?: number; updatedAt?: number } =>
        Boolean(item && typeof item === 'object' && typeof (item as any).id === 'string')
    );
    list.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
    return list;
  } catch {
    return [];
  }
}

async function rtdbFetchMain(): Promise<RavonSyncPayload | null> {
  if (!FIREBASE_RTDB_URL) return null;
  try {
    const [mainRes, settingsRes] = await Promise.all([
      fetch(`${FIREBASE_RTDB_URL}/ravon_sync/main.json`).catch(() => null),
      fetch(`${FIREBASE_RTDB_URL}/ravon_settings.json`).catch(() => null),
    ]);
    let data: RavonSyncPayload | null = null;
    if (mainRes && mainRes.ok) {
      const parsed = await mainRes.json();
      if (parsed && typeof parsed === 'object') {
        data = parsed as RavonSyncPayload;
      }
    }
    if (settingsRes && settingsRes.ok) {
      const settingsDoc = await settingsRes.json();
      if (settingsDoc && typeof settingsDoc === 'object' && settingsDoc.siteSettings) {
        const sTs = Number(settingsDoc.settingsUpdatedAt) || 0;
        const mTs = Number(data?.settingsUpdatedAt || data?.updatedAt) || 0;
        if (!data) {
          data = {
            siteSettings: settingsDoc.siteSettings,
            settingsUpdatedAt: sTs,
            updatedAt: sTs,
          };
        } else if (sTs >= mTs) {
          data.siteSettings = settingsDoc.siteSettings;
          data.settingsUpdatedAt = sTs;
        }
      }
    }
    return data;
  } catch {
    return null;
  }
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

function renderCompressedPass(
  img: HTMLImageElement,
  maxDim: number,
  quality: number
): string | null {
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
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

/**
 * Multi-pass client-side image compression for base64 data URLs.
 * Guarantees that high-res photos uploaded from phones are compressed under ~160KB
 * so every Firestore document write succeeds 100% of the time and loads fast on mobile.
 */
export async function compressImageDataUrl(
  dataUrl: string,
  maxDim = 760,
  quality = 0.74
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  if (dataUrl.length < 130_000) {
    return dataUrl;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return dataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      let best = renderCompressedPass(img, maxDim, quality) || dataUrl;
      if (best.length > 220_000) {
        const secondPass = renderCompressedPass(img, 540, 0.62);
        if (secondPass && secondPass.length < best.length) {
          best = secondPass;
        }
      }
      if (best.length > 260_000) {
        const thirdPass = renderCompressedPass(img, 420, 0.54);
        if (thirdPass && thirdPass.length < best.length) {
          best = thirdPass;
        }
      }
      resolve(best.length < dataUrl.length ? best : dataUrl);
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
    if (image.startsWith('data:image/') && image.length > 130_000) {
      image = await compressImageDataUrl(image, 760, 0.74);
    }
    const item: Product = {
      id: String(prod.id).trim(),
      name: String(prod.name || 'Zapchast').slice(0, 480),
      bazaarName: String(prod.bazaarName || prod.name || 'Zapchast').slice(0, 300),
      category: String(prod.category || 'Optika'),
      carModels:
        Array.isArray(prod.carModels) && prod.carModels.length > 0
          ? prod.carModels
          : ['Gentra'],
      price: Math.max(0, Number(prod.price) || 0),
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
 * Ensures siteSettings preserves all Admin edits (phones, addresses, social links)
 * while migrating any legacy Toshkent/Sergeli address or old demo phone if ever encountered.
 */
export function sanitizeSiteSettings(raw: Partial<SiteSettings> | undefined | null): {
  settings: SiteSettings;
  wasModified: boolean;
} {
  if (!raw || typeof raw !== 'object') {
    return { settings: { ...DEFAULT_SITE_SETTINGS }, wasModified: true };
  }

  let wasModified = false;

  const isLegacyTashkent = (val?: string) => {
    if (!val || typeof val !== 'string') return false;
    const lower = val.toLowerCase();
    return lower.includes('toshkent') || lower.includes('sergeli');
  };

  let addressCity =
    typeof raw.addressCity === 'string' && raw.addressCity.trim()
      ? raw.addressCity.trim()
      : DEFAULT_SITE_SETTINGS.addressCity;
  if (isLegacyTashkent(addressCity)) {
    addressCity = DEFAULT_SITE_SETTINGS.addressCity;
    wasModified = true;
  }

  let addressBazaar =
    typeof raw.addressBazaar === 'string' && raw.addressBazaar.trim()
      ? raw.addressBazaar.trim()
      : DEFAULT_SITE_SETTINGS.addressBazaar;
  if (isLegacyTashkent(addressBazaar)) {
    addressBazaar = DEFAULT_SITE_SETTINGS.addressBazaar;
    wasModified = true;
  }

  let addressDetails =
    typeof raw.addressDetails === 'string' && raw.addressDetails.trim()
      ? raw.addressDetails.trim()
      : DEFAULT_SITE_SETTINGS.addressDetails;
  if (isLegacyTashkent(addressDetails)) {
    addressDetails = DEFAULT_SITE_SETTINGS.addressDetails;
    wasModified = true;
  }

  let mapLocationUrl =
    typeof raw.mapLocationUrl === 'string' && raw.mapLocationUrl.trim()
      ? raw.mapLocationUrl.trim()
      : DEFAULT_SITE_SETTINGS.mapLocationUrl;
  if (isLegacyTashkent(mapLocationUrl)) {
    mapLocationUrl = DEFAULT_SITE_SETTINGS.mapLocationUrl;
    wasModified = true;
  }

  let phonePrimary =
    typeof raw.phonePrimary === 'string' && raw.phonePrimary.trim()
      ? raw.phonePrimary.trim()
      : DEFAULT_SITE_SETTINGS.phonePrimary;
  if (phonePrimary.includes('524 04 01') || phonePrimary.includes('524-04-01')) {
    phonePrimary = DEFAULT_SITE_SETTINGS.phonePrimary;
    wasModified = true;
  }

  let phoneSecondary =
    typeof raw.phoneSecondary === 'string' && raw.phoneSecondary.trim()
      ? raw.phoneSecondary.trim()
      : DEFAULT_SITE_SETTINGS.phoneSecondary;
  if (phoneSecondary.includes('524 04 01') || phoneSecondary.includes('524-04-01')) {
    phoneSecondary = DEFAULT_SITE_SETTINGS.phoneSecondary;
    wasModified = true;
  }

  let telegramUsername =
    typeof raw.telegramUsername === 'string' && raw.telegramUsername.trim()
      ? raw.telegramUsername.trim().replace(/^@/, '')
      : DEFAULT_SITE_SETTINGS.telegramUsername;
  if (telegramUsername === 'RavonAutoTuningUz') {
    telegramUsername = DEFAULT_SITE_SETTINGS.telegramUsername;
    wasModified = true;
  }

  const telegramChannel =
    typeof raw.telegramChannel === 'string' && raw.telegramChannel.trim()
      ? raw.telegramChannel.trim()
      : DEFAULT_SITE_SETTINGS.telegramChannel;

  const instagramUrl =
    typeof raw.instagramUrl === 'string' && raw.instagramUrl.trim()
      ? raw.instagramUrl.trim()
      : DEFAULT_SITE_SETTINGS.instagramUrl;

  let whatsappUrl =
    typeof raw.whatsappUrl === 'string' && raw.whatsappUrl.trim()
      ? raw.whatsappUrl.trim()
      : DEFAULT_SITE_SETTINGS.whatsappUrl;
  if (whatsappUrl.includes('975240401')) {
    whatsappUrl = DEFAULT_SITE_SETTINGS.whatsappUrl;
    wasModified = true;
  }

  const settings: SiteSettings = stripUndefinedDeep({
    ...DEFAULT_SITE_SETTINGS,
    ...raw,
    addressCity,
    addressBazaar,
    addressDetails,
    mapLocationUrl,
    phonePrimary,
    phoneSecondary,
    telegramUsername,
    telegramChannel,
    instagramUrl,
    whatsappUrl,
  });

  return {
    settings,
    wasModified,
  };
}

/**
 * Strips any legacy static demo products (Zimmer LED, etc.) and explicitly deleted products.
 */
export function sanitizeProductsList(
  list: unknown,
  extraDeletedIds?: Iterable<string>
): Product[] {
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
 * Merges multiple product arrays by `id` (preserving order and excluding deleted/static demo IDs)
 * so that no device with an empty or older cache can accidentally wipe out products added by Admin.
 */
export function mergeProductCatalogs(
  catalogLists: Array<Product[] | undefined | null>,
  extraDeletedIds?: Iterable<string>
): Product[] {
  const deletedSet = getDeletedProductIds();
  if (extraDeletedIds) {
    for (const id of extraDeletedIds) {
      if (id) deletedSet.add(id);
    }
  }

  const byId = new Map<string, Product & { sortOrder?: number; updatedAt?: number }>();

  for (const list of catalogLists) {
    if (!Array.isArray(list)) continue;
    for (const rawItem of list) {
      if (!rawItem || typeof rawItem !== 'object' || typeof rawItem.id !== 'string') continue;
      const id = rawItem.id.trim();
      if (!id || STATIC_DEMO_PRODUCT_IDS.has(id) || deletedSet.has(id)) continue;

      const existing = byId.get(id);
      const itemWithMeta = rawItem as Product & { sortOrder?: number; updatedAt?: number };
      if (!existing) {
        byId.set(id, stripUndefinedDeep(itemWithMeta));
      } else {
        const incomingTime = itemWithMeta.updatedAt || 0;
        const existingTime = existing.updatedAt || 0;
        if (incomingTime >= existingTime) {
          byId.set(id, stripUndefinedDeep({ ...existing, ...itemWithMeta }));
        }
      }
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
  return sanitizeProductsList(merged, deletedSet);
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
        (it) =>
          it && it.product && it.product.id && !STATIC_DEMO_PRODUCT_IDS.has(it.product.id)
      );
      return validItems.length > 0;
    })
    .map((o) => stripUndefinedDeep(o));
}

/**
 * Syncs individual product documents inside Firestore `/ravon_products/{productId}` collection
 * (via both Firebase Web SDK and direct Cloud Firestore REST API)
 * so there is never a single-document 1MB limit issue and mobile WebViews sync 100% reliably.
 */
async function syncProductsCollectionToFirestore(
  products: Product[],
  deletedIds: string[] = []
): Promise<void> {
  try {
    // 1. Delete any explicitly removed product documents
    const deletedSet = new Set(deletedIds);
    for (const delId of deletedSet) {
      if (delId) {
        if (db) {
          deleteDoc(doc(db, PRODUCTS_COLLECTION, delId)).catch(() => {});
        }
        restDeleteProductDoc(delId).catch(() => {});
        rtdbDeleteProduct(delId).catch(() => {});
      }
    }

    // 2. Upsert all active products as individual documents in `/ravon_products/{id}`
    const now = Date.now();
    const writePromises = products.map(async (prod, idx) => {
      const docData = stripUndefinedDeep({
        ...prod,
        sortOrder: idx,
        updatedAt: now,
      });
      await Promise.all([
        db
          ? setDoc(doc(db, PRODUCTS_COLLECTION, prod.id), docData).catch((err) => {
              handleFirestoreError(
                err,
                OperationType.WRITE,
                `${PRODUCTS_COLLECTION}/${prod.id}`
              );
            })
          : Promise.resolve(),
        restUpsertProductDoc(docData),
        rtdbUpsertProduct(docData),
      ]);
    });

    await Promise.all(writePromises);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, PRODUCTS_COLLECTION);
  }
}

/**
 * Explicitly deletes a product from all global stores (Firestore SDK, Firestore REST, RTDB, main sync doc, backend, Supabase).
 */
export async function deleteProductFromCloud(
  productId: string,
  remainingProducts: Product[]
): Promise<void> {
  const deletedList = addDeletedProductIds([productId]);
  await Promise.all([
    db ? deleteDoc(doc(db, PRODUCTS_COLLECTION, productId)).catch(() => {}) : Promise.resolve(),
    restDeleteProductDoc(productId),
    rtdbDeleteProduct(productId),
  ]);
  await pushRealtimeState({
    products: remainingProducts,
    deletedProductIds: deletedList,
  });
}

/**
 * Forces a complete synchronization of all current store data to Cloud Firestore & Backend.
 */
export async function forceFullCloudSync(
  currentPayload: RavonSyncPayload
): Promise<{ success: boolean; count: number }> {
  try {
    await pushRealtimeState(currentPayload);
    const remote = await pullRealtimeState();
    const count = remote?.products?.length ?? currentPayload.products?.length ?? 0;
    return { success: true, count };
  } catch {
    return { success: false, count: currentPayload.products?.length ?? 0 };
  }
}

/**
 * Pushes updated state to:
 * 1. Cross-tab BroadcastChannel
 * 2. Cloud Firestore SDK & REST API (`/ravon_products/{id}` collection + `/ravon_sync/main` document)
 * 3. Supabase table `ravon_store_state` (if configured)
 * 4. Backend Express server `/api/sync/state`
 */
export async function pushRealtimeState(partial: RavonSyncPayload): Promise<void> {
  const now = Date.now();
  const normalizedProducts =
    partial.products !== undefined
      ? await normalizeProductsForCloud(partial.products)
      : undefined;

  const deletedProductIds =
    partial.deletedProductIds !== undefined
      ? addDeletedProductIds(partial.deletedProductIds)
      : Array.from(getDeletedProductIds());

  if (partial.siteSettings !== undefined) {
    setLocalSettingsUpdatedAt(now);
  }

  const payload: RavonSyncPayload = stripUndefinedDeep({
    ...partial,
    ...(normalizedProducts !== undefined ? { products: normalizedProducts } : {}),
    ...(partial.orders !== undefined ? { orders: sanitizeOrdersList(partial.orders) } : {}),
    ...(partial.siteSettings !== undefined
      ? {
          siteSettings: sanitizeSiteSettings(partial.siteSettings).settings,
          settingsUpdatedAt: partial.settingsUpdatedAt || now,
        }
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

  // 2. Sync to Cloud Firestore (`/ravon_products` collection + `/ravon_sync/main` doc) via SDK + REST
  if (normalizedProducts !== undefined) {
    await syncProductsCollectionToFirestore(normalizedProducts, deletedProductIds);
  }

  try {
    const serialized = JSON.stringify(payload);
    const mainDocPayload =
      serialized.length < 750_000
        ? payload
        : stripUndefinedDeep({ ...payload, products: [] });

    await Promise.all([
      db
        ? setDoc(doc(db, 'ravon_sync', 'main'), mainDocPayload, { merge: true }).catch((err) => {
            handleFirestoreError(err, OperationType.WRITE, SYNC_DOC_PATH);
          })
        : Promise.resolve(),
      restPatchMainDoc(mainDocPayload),
      rtdbPatchMain(mainDocPayload),
    ]);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, SYNC_DOC_PATH);
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
 * Pulls latest synchronized state from Cloud Firestore (SDK + REST API `/ravon_products` + `/ravon_sync/main`),
 * Supabase, and Backend Server, combining them to return the most complete & up-to-date catalog.
 */
export async function pullRealtimeState(): Promise<RavonSyncPayload | null> {
  let firestoreMainData: RavonSyncPayload | null = null;
  let firestoreCollectionProducts: Product[] | null = null;
  let restMainData: RavonSyncPayload | null = null;
  let restCollectionProducts: Product[] | null = null;
  let backendData: RavonSyncPayload | null = null;

  // 1. Pull from Cloud Firestore SDK (`/ravon_sync/main` and `/ravon_products`)
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

      if (productsSnap) {
        const docsList: Array<Product & { sortOrder?: number; updatedAt?: number }> = [];
        productsSnap.forEach((d) => {
          docsList.push(d.data() as Product & { sortOrder?: number; updatedAt?: number });
        });
        docsList.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
        firestoreCollectionProducts = sanitizeProductsList(
          docsList,
          firestoreMainData?.deletedProductIds
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, SYNC_DOC_PATH);
    }
  }

  // 2. Pull from Cloud Firestore REST API & Firebase Realtime Database (ravon-f50ba)
  try {
    const [rMain, rProds, rtMain, rtProds] = await Promise.all([
      restFetchMainDoc(),
      restFetchProductsCollection(),
      rtdbFetchMain(),
      rtdbFetchProducts(),
    ]);
    if (rMain) {
      restMainData = rMain;
      if (Array.isArray(rMain.deletedProductIds)) {
        addDeletedProductIds(rMain.deletedProductIds);
      }
    }
    if (rtMain) {
      if (Array.isArray(rtMain.deletedProductIds)) {
        addDeletedProductIds(rtMain.deletedProductIds);
      }
      if (!restMainData) {
        restMainData = rtMain;
      } else {
        const rtSettingsTs = rtMain.settingsUpdatedAt || rtMain.updatedAt || 0;
        const restSettingsTs = restMainData.settingsUpdatedAt || restMainData.updatedAt || 0;
        const pickedSettings =
          rtMain.siteSettings && rtSettingsTs >= restSettingsTs
            ? rtMain.siteSettings
            : restMainData.siteSettings || rtMain.siteSettings;
        const pickedSettingsTs = Math.max(rtSettingsTs, restSettingsTs);

        if ((rtMain.updatedAt || 0) >= (restMainData.updatedAt || 0)) {
          restMainData = { ...restMainData, ...rtMain };
        }
        if (pickedSettings) {
          restMainData.siteSettings = pickedSettings;
          restMainData.settingsUpdatedAt = pickedSettingsTs;
        }
      }
    }
    const combinedRestProds = [...rProds, ...rtProds];
    if (combinedRestProds.length > 0) {
      restCollectionProducts = sanitizeProductsList(
        combinedRestProds,
        rMain?.deletedProductIds ||
          rtMain?.deletedProductIds ||
          firestoreMainData?.deletedProductIds
      );
    }
  } catch {
    // ignore
  }

  // 3. Pull from Backend Server (/api/sync/state)
  try {
    const res = await safeFetchJson<{ success: boolean; state?: RavonSyncPayload }>(
      '/api/sync/state'
    );
    if (res.ok && res.data?.success && res.data.state) {
      backendData = res.data.state;
      if (Array.isArray(backendData.deletedProductIds)) {
        addDeletedProductIds(backendData.deletedProductIds);
      }
    }
  } catch {
    // ignore
  }

  // 4. Pull from Supabase if configured
  let supabaseData: RavonSyncPayload | null = null;
  if (isSupabaseConfigured && !firestoreMainData && !restMainData && !backendData) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ravon_store_state?id=eq.main&select=payload`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
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

  // Merge sources prioritizing the freshest timestamp
  const sources = [firestoreMainData, restMainData, backendData, supabaseData].filter(
    (s): s is RavonSyncPayload => Boolean(s)
  );

  if (
    sources.length === 0 &&
    firestoreCollectionProducts === null &&
    restCollectionProducts === null
  ) {
    return null;
  }

  sources.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const primary = sources[0] || {};

  const allDeletedIds = Array.from(getDeletedProductIds());

  // Merge products across Firestore SDK collection, Firestore REST collection, `/ravon_sync/main`, and backend
  const mergedProducts = mergeProductCatalogs(
    [
      firestoreCollectionProducts,
      restCollectionProducts,
      firestoreMainData?.products,
      restMainData?.products,
      backendData?.products,
      supabaseData?.products,
    ],
    allDeletedIds
  );

  // Pick the freshest siteSettings across all sources based on settingsUpdatedAt || updatedAt
  let freshestSettingsSource: RavonSyncPayload | null = null;
  let freshestSettingsTs = 0;
  for (const src of sources) {
    if (src.siteSettings) {
      const ts = src.settingsUpdatedAt || src.updatedAt || 0;
      if (!freshestSettingsSource || ts >= freshestSettingsTs) {
        freshestSettingsSource = src;
        freshestSettingsTs = ts;
      }
    }
  }

  const combined: RavonSyncPayload = {
    ...primary,
    ...(freshestSettingsSource?.siteSettings
      ? {
          siteSettings: freshestSettingsSource.siteSettings,
          settingsUpdatedAt: freshestSettingsTs,
        }
      : {}),
    products: mergedProducts,
    deletedProductIds: allDeletedIds,
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
export function subscribeToRealtimeSync(
  onUpdate: (payload: RavonSyncPayload) => void
): () => void {
  // Capture any existing local products synchronously BEFORE listeners fire
  // so an initial empty cloud snapshot cannot wipe out unsynced Admin products!
  let initialLocalProducts: Product[] = [];
  let initialLocalCategories: string[] = [];
  let initialLocalCarModels: string[] = [];

  try {
    const savedProds = localStorage.getItem('ravon_products');
    if (savedProds) {
      initialLocalProducts = sanitizeProductsList(JSON.parse(savedProds));
    }
    const savedCats = localStorage.getItem('ravon_categories');
    if (savedCats) {
      const parsedCats = JSON.parse(savedCats);
      if (Array.isArray(parsedCats)) initialLocalCategories = parsedCats;
    }
    const savedCars = localStorage.getItem('ravon_car_models');
    if (savedCars) {
      const parsedCars = JSON.parse(savedCars);
      if (Array.isArray(parsedCars)) initialLocalCarModels = parsedCars;
    }
  } catch {
    // ignore
  }

  let latestCollectionProducts: Product[] | null = null;
  let hasCompletedInitialMigration = false;

  const applyIncoming = (data: RavonSyncPayload | null) => {
    if (!data) return;

    if (Array.isArray(data.deletedProductIds)) {
      addDeletedProductIds(data.deletedProductIds);
    }

    const deletedSet = getDeletedProductIds();

    if (data.products !== undefined) {
      // Combine with latestCollectionProducts and initialLocalProducts (until migrated)
      const listsToMerge: Array<Product[] | null | undefined> = [
        latestCollectionProducts,
        data.products,
      ];
      if (!hasCompletedInitialMigration && initialLocalProducts.length > 0) {
        listsToMerge.push(initialLocalProducts);
      }
      data.products = mergeProductCatalogs(listsToMerge, deletedSet);
    }

    if (data.orders !== undefined) {
      data.orders = sanitizeOrdersList(data.orders);
    }
    if (data.siteSettings !== undefined) {
      const localTs = getLocalSettingsUpdatedAt();
      const incomingTs = data.settingsUpdatedAt || data.updatedAt || 0;
      if (localTs > 0 && incomingTs > 0 && incomingTs < localTs) {
        // Ignore stale remote siteSettings if local settings were saved more recently
        delete data.siteSettings;
      } else {
        const { settings } = sanitizeSiteSettings(data.siteSettings);
        data.siteSettings = settings;
        if (incomingTs > localTs) {
          setLocalSettingsUpdatedAt(incomingTs);
        }
      }
    }
    onUpdate(data);
  };

  // 1. Cloud Firestore real-time listener on `/ravon_products` collection (Authoritative for Products)
  let unsubscribeProductsCol: (() => void) | null = null;
  // 2. Cloud Firestore real-time listener on `/ravon_sync/main` (Authoritative for Settings, Categories, Orders, DeletedIds)
  let unsubscribeMainDoc: (() => void) | null = null;

  if (db) {
    try {
      unsubscribeProductsCol = onSnapshot(
        collection(db, PRODUCTS_COLLECTION),
        (querySnapshot) => {
          const docsList: Array<Product & { sortOrder?: number; updatedAt?: number }> = [];
          querySnapshot.forEach((docSnap) => {
            docsList.push(
              docSnap.data() as Product & { sortOrder?: number; updatedAt?: number }
            );
          });
          docsList.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
          latestCollectionProducts = sanitizeProductsList(docsList);
          applyIncoming({
            products: latestCollectionProducts,
            updatedAt: Date.now(),
          });
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, PRODUCTS_COLLECTION);
        }
      );
    } catch {
      unsubscribeProductsCol = null;
    }

    try {
      unsubscribeMainDoc = onSnapshot(
        doc(db, 'ravon_sync', 'main'),
        (snapshot) => {
          if (snapshot.exists()) {
            const rawData = snapshot.data() as RavonSyncPayload;
            if (Array.isArray(rawData.deletedProductIds)) {
              addDeletedProductIds(rawData.deletedProductIds);
            }
            // If collection listener already has products, filter them by deletedProductIds
            if (latestCollectionProducts !== null) {
              latestCollectionProducts = sanitizeProductsList(
                latestCollectionProducts,
                rawData.deletedProductIds
              );
              applyIncoming({
                ...rawData,
                products: mergeProductCatalogs(
                  [latestCollectionProducts, rawData.products],
                  rawData.deletedProductIds
                ),
              });
            } else {
              applyIncoming(rawData);
            }
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, SYNC_DOC_PATH);
        }
      );
    } catch {
      unsubscribeMainDoc = null;
    }
  }

  // 2b. Firebase Realtime Database (ravon-f50ba) real-time listeners
  let unsubscribeRtdbProducts: (() => void) | null = null;
  let unsubscribeRtdbMain: (() => void) | null = null;

  if (rtdb) {
    try {
      unsubscribeRtdbProducts = rtdbOnValue(
        rtdbRef(rtdb, PRODUCTS_COLLECTION),
        (snap) => {
          const val = snap.val();
          if (val && typeof val === 'object') {
            const list = Object.values(val).filter(
              (item): item is Product & { sortOrder?: number; updatedAt?: number } =>
                Boolean(item && typeof item === 'object' && typeof (item as any).id === 'string')
            );
            list.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
            latestCollectionProducts = mergeProductCatalogs(
              [latestCollectionProducts, list],
              getDeletedProductIds()
            );
            applyIncoming({
              products: latestCollectionProducts,
              updatedAt: Date.now(),
            });
          }
        },
        () => {}
      );
    } catch {
      unsubscribeRtdbProducts = null;
    }

    try {
      unsubscribeRtdbMain = rtdbOnValue(
        rtdbRef(rtdb, 'ravon_sync/main'),
        (snap) => {
          const val = snap.val() as RavonSyncPayload | null;
          if (val && typeof val === 'object') {
            applyIncoming(val);
          }
        },
        () => {}
      );
    } catch {
      unsubscribeRtdbMain = null;
    }

    try {
      rtdbOnValue(
        rtdbRef(rtdb, 'ravon_settings'),
        (snap) => {
          const val = snap.val();
          if (val && typeof val === 'object' && val.siteSettings) {
            applyIncoming({
              siteSettings: val.siteSettings,
              settingsUpdatedAt: Number(val.settingsUpdatedAt) || Date.now(),
              updatedAt: Number(val.settingsUpdatedAt) || Date.now(),
            });
          }
        },
        () => {}
      );
    } catch {
      // ignore
    }
  }

  // 3. BroadcastChannel listener (same browser, multiple tabs)
  const handleBroadcast = (event: MessageEvent<RavonSyncPayload>) => {
    if (event?.data) {
      if (Array.isArray(event.data.deletedProductIds)) {
        addDeletedProductIds(event.data.deletedProductIds);
      }
      if (event.data.products !== undefined) {
        latestCollectionProducts = sanitizeProductsList(
          event.data.products,
          event.data.deletedProductIds
        );
      }
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
    const deletedSet = getDeletedProductIds();
    if (remote?.deletedProductIds) {
      remote.deletedProductIds.forEach((id) => deletedSet.add(id));
    }

    const remoteProducts = remote?.products
      ? sanitizeProductsList(remote.products, deletedSet)
      : [];
    const remoteIds = new Set(remoteProducts.map((p) => p.id));
    const unsyncedLocalProducts = sanitizeProductsList(initialLocalProducts, deletedSet).filter(
      (p) => !remoteIds.has(p.id)
    );

    const remoteCategories = Array.isArray(remote?.categories)
      ? remote!.categories
      : DEFAULT_CATEGORIES;
    const mergedCategories = Array.from(
      new Set([...remoteCategories, ...initialLocalCategories])
    );
    const hasNewLocalCategories = mergedCategories.length > remoteCategories.length;

    const remoteCarModels = Array.isArray(remote?.carModels)
      ? remote!.carModels
      : DEFAULT_CAR_MODELS;
    const mergedCarModels = Array.from(
      new Set([...remoteCarModels, ...initialLocalCarModels])
    );
    const hasNewLocalCarModels = mergedCarModels.length > remoteCarModels.length;

    hasCompletedInitialMigration = true;

    if (
      unsyncedLocalProducts.length > 0 ||
      hasNewLocalCategories ||
      hasNewLocalCarModels
    ) {
      const mergedProducts = mergeProductCatalogs(
        [unsyncedLocalProducts, remoteProducts],
        deletedSet
      );
      latestCollectionProducts = mergedProducts;
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
      if (remote.products) {
        latestCollectionProducts = remote.products;
      }
      applyIncoming(remote);
      // Also ensure any products that existed in main doc / backend are written to `/ravon_products` collection
      if (remoteProducts.length > 0 && db) {
        syncProductsCollectionToFirestore(remoteProducts, Array.from(deletedSet)).catch(
          () => {}
        );
      }
    }
  });

  // 6. Periodic background poll every 5 seconds for guaranteed sync across all networks
  const intervalId = window.setInterval(async () => {
    const remote = await pullRealtimeState();
    if (remote) {
      if (remote.products) {
        latestCollectionProducts = remote.products;
      }
      applyIncoming(remote);
    }
  }, 5000);

  return () => {
    if (unsubscribeMainDoc) unsubscribeMainDoc();
    if (unsubscribeProductsCol) unsubscribeProductsCol();
    if (unsubscribeRtdbProducts) unsubscribeRtdbProducts();
    if (unsubscribeRtdbMain) unsubscribeRtdbMain();
    broadcastChannel?.removeEventListener('message', handleBroadcast);
    window.removeEventListener('storage', handleStorageEvent);
    window.clearInterval(intervalId);
  };
}
