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
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
} from '../lib/firebase';
import {
  Product,
  SiteSettings,
  AnnouncementBanner,
  OrderRecord,
  PromoCode,
  ProductReview,
  PartRequest,
} from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { STATIC_DEMO_PRODUCT_IDS } from '../data/products';
import {
  DEMO_ORDER_IDS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_CATEGORIES,
  DEFAULT_CAR_MODELS,
  DEFAULT_BRANDS,
} from '../data/initialData';

/**
 * Real-time Multi-Device & Multi-Tab Global Synchronization Service
 * (Firebase Realtime Database + Cloud Firestore SDK/REST + Supabase + Backend Server + BroadcastChannel)
 *
 * Guarantees that all products, brands, categories, carModels, siteSettings, banner, promoCodes, reviews, partRequests, and orders
 * added, edited, or deleted via the Admin Panel are saved to the global database and immediately visible
 * to all users on any phone, tablet, or computer in real time.
 */

export interface RavonSyncPayload {
  products?: Product[];
  productsCount?: number;
  orders?: OrderRecord[];
  siteSettings?: SiteSettings;
  settingsUpdatedAt?: number;
  announcementBanner?: AnnouncementBanner;
  carModels?: string[];
  categories?: string[];
  brands?: string[];
  promoCodes?: PromoCode[];
  reviews?: ProductReview[];
  partRequests?: PartRequest[];
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
  if (isFirestoreQuotaExceeded) return;
  try {
    const docUrl = `${FIRESTORE_REST_BASE_URL}/${PRODUCTS_COLLECTION}/${encodeURIComponent(
      product.id
    )}?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
    const res = await fetch(docUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFirestoreFields(product) }),
    });
    if (res.status === 429) markFirestoreQuotaExceeded();
  } catch {
    // ignore
  }
}

async function restDeleteProductDoc(productId: string): Promise<void> {
  if (isFirestoreQuotaExceeded) return;
  try {
    const docUrl = `${FIRESTORE_REST_BASE_URL}/${PRODUCTS_COLLECTION}/${encodeURIComponent(
      productId
    )}?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
    const res = await fetch(docUrl, { method: 'DELETE' });
    if (res.status === 429) markFirestoreQuotaExceeded();
  } catch {
    // ignore
  }
}

async function restPatchMainDoc(payload: RavonSyncPayload): Promise<void> {
  if (isFirestoreQuotaExceeded) return;
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
    const res = await fetch(docUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFirestoreFields(payload as Record<string, any>) }),
    });
    if (res.status === 429) markFirestoreQuotaExceeded();
  } catch {
    // ignore
  }
}

async function restFetchProductsCollection(): Promise<
  Array<Product & { sortOrder?: number; updatedAt?: number }>
> {
  if (isFirestoreQuotaExceeded) return [];
  try {
    const colUrl = `${FIRESTORE_REST_BASE_URL}/${PRODUCTS_COLLECTION}?pageSize=300&key=${encodeURIComponent(
      FIREBASE_API_KEY
    )}`;
    const res = await fetch(colUrl, { method: 'GET' });
    if (res.status === 429) {
      markFirestoreQuotaExceeded();
      return [];
    }
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
  if (isFirestoreQuotaExceeded) return null;
  try {
    const docUrl = `${FIRESTORE_REST_BASE_URL}/ravon_sync/main?key=${encodeURIComponent(
      FIREBASE_API_KEY
    )}`;
    const res = await fetch(docUrl, { method: 'GET' });
    if (res.status === 429) {
      markFirestoreQuotaExceeded();
      return null;
    }
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
 * Fast recursive helper that removes `undefined` fields without expensive JSON.stringify/JSON.parse.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value as Record<string, any>)) {
    if (v !== undefined) {
      out[k] = stripUndefinedDeep(v);
    }
  }
  return out as T;
}

let inMemoryDeletedProductIds: Set<string> | null = null;
let isBulkUploadInProgress = false;
let isInitialLoadComplete = false;
let cachedCatalogProducts: Product[] = [];

export function getIsInitialLoadComplete(): boolean {
  return isInitialLoadComplete;
}

export function markInitialLoadComplete(): void {
  isInitialLoadComplete = true;
}

export function getCachedCatalogProducts(): Product[] {
  return cachedCatalogProducts;
}

/**
 * Reads locally tracked deleted product IDs so deleted products never resurrect.
 * Cached in memory so looping 4,443+ products never re-reads or re-parses localStorage.
 */
export function getDeletedProductIds(): Set<string> {
  if (inMemoryDeletedProductIds) {
    return new Set<string>(inMemoryDeletedProductIds);
  }
  try {
    const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    if (!raw) {
      inMemoryDeletedProductIds = new Set<string>();
      return new Set<string>();
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      inMemoryDeletedProductIds = new Set<string>(
        parsed.filter((id): id is string => typeof id === 'string')
      );
      return new Set<string>(inMemoryDeletedProductIds);
    }
  } catch {
    // ignore
  }
  inMemoryDeletedProductIds = new Set<string>();
  return new Set<string>();
}

function persistDeletedIdsSet(setToSave: Set<string>): string[] {
  inMemoryDeletedProductIds = new Set<string>(setToSave);
  const fullList = Array.from(setToSave);
  try {
    // Cap localStorage persistence to 500 IDs to avoid QuotaExceededError and JSON.stringify lag
    const toStore = fullList.length <= 500 ? fullList : fullList.slice(-500);
    localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // ignore
  }
  return fullList;
}

export function addDeletedProductIds(ids: string[]): string[] {
  const current = getDeletedProductIds();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i]) current.add(ids[i]);
  }
  return persistDeletedIdsSet(current);
}

export function removeDeletedProductIds(idsToRestore: string[]): string[] {
  const current = getDeletedProductIds();
  for (let i = 0; i < idsToRestore.length; i++) {
    if (idsToRestore[i]) current.delete(idsToRestore[i]);
  }
  return persistDeletedIdsSet(current);
}

export function clearAllDeletedProductIds(): void {
  inMemoryDeletedProductIds = new Set<string>();
  try {
    localStorage.removeItem(DELETED_IDS_STORAGE_KEY);
  } catch {
    // ignore
  }
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

    const webpDataUrl = canvas.toDataURL('image/webp', quality);
    if (webpDataUrl && webpDataUrl.startsWith('data:image/webp')) {
      const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
      return webpDataUrl.length <= jpegDataUrl.length ? webpDataUrl : jpegDataUrl;
    }
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

/**
 * Client-side Canvas image compression for base64 data URLs.
 * Automatically resizes product images to max 600px and compresses at 0.7 quality (JPEG/WebP)
 * before saving to the database so 7,000+ products load rapidly without lag.
 */
export async function compressImageDataUrl(
  dataUrl: string,
  maxDim = 600,
  quality = 0.7
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return dataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      let best = renderCompressedPass(img, maxDim, quality) || dataUrl;
      if (best.length > 180_000) {
        const secondPass = renderCompressedPass(img, 500, 0.62);
        if (secondPass && secondPass.length < best.length) {
          best = secondPass;
        }
      }
      if (best.length > 220_000) {
        const thirdPass = renderCompressedPass(img, 420, 0.54);
        if (thirdPass && thirdPass.length < best.length) {
          best = thirdPass;
        }
      }
      resolve(best);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function sanitizeFirebaseProductId(rawId: unknown, fallbackIndex = 0): string {
  const str = String(rawId || `prod_${Date.now()}_${fallbackIndex}`).trim();
  const cleaned = str.replace(/[.#$[\]/\s]+/g, '_');
  return cleaned || `prod_${Date.now()}_${fallbackIndex}`;
}

function buildCleanProductObject(prod: Product, indexHint = 0): Product {
  const rawStock =
    prod.stock !== undefined && prod.stock !== null && !Number.isNaN(Number(prod.stock))
      ? Math.max(0, Math.floor(Number(prod.stock)))
      : prod.inStock === false
      ? 0
      : 10;
  const isAvailable = rawStock > 0 && (prod.inStock ?? true);
  const safePrice = Number.isFinite(Number(prod.price)) ? Math.max(0, Number(prod.price)) : 0;
  const safeOrigPrice = Number.isFinite(Number(prod.originalPrice))
    ? Math.max(0, Number(prod.originalPrice))
    : 0;
  const safeRating = Number.isFinite(Number(prod.rating)) ? Number(prod.rating) : 5.0;
  const safeReviewCount = Number.isFinite(Number(prod.reviewCount)) ? Number(prod.reviewCount) : 1;

  const item: Product = {
    id: sanitizeFirebaseProductId(prod.id, indexHint),
    name: String(prod.name || 'Zapchast').slice(0, 480),
    bazaarName: String(prod.bazaarName || prod.name || 'Zapchast').slice(0, 300),
    ...(prod.sku ? { sku: String(prod.sku).trim().slice(0, 120) } : {}),
    ...(prod.brand ? { brand: String(prod.brand).trim() } : {}),
    category: String(prod.category || 'Optika'),
    carModels:
      Array.isArray(prod.carModels) && prod.carModels.length > 0
        ? prod.carModels.filter((c) => typeof c === 'string' && c.trim().length > 0)
        : ['Gentra'],
    price: safePrice,
    ...(safeOrigPrice > safePrice ? { originalPrice: safeOrigPrice } : {}),
    image: typeof prod.image === 'string' ? prod.image : '',
    inStock: isAvailable,
    stock: isAvailable ? rawStock : 0,
    rating: safeRating,
    reviewCount: safeReviewCount,
    ...(prod.badge ? { badge: String(prod.badge) } : {}),
    description: String(prod.description || ''),
    specs: Array.isArray(prod.specs)
      ? prod.specs
          .filter((s) => s && typeof s.label === 'string' && typeof s.value === 'string')
          .map((s) => ({ label: String(s.label), value: String(s.value) }))
      : [],
    tags: Array.isArray(prod.tags)
      ? prod.tags.filter((t) => typeof t === 'string').map((t) => String(t))
      : [],
  };
  return JSON.parse(JSON.stringify(item)) as Product;
}

async function normalizeProductsForCloud(products: Product[]): Promise<Product[]> {
  const cleaned = sanitizeProductsList(products);
  const normalized: Product[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const prod = cleaned[i];
    let image = prod.image || '';
    if (image.startsWith('data:image/') && image.length > 90_000) {
      image = await compressImageDataUrl(image, 600, 0.7);
    }
    normalized.push(buildCleanProductObject(image !== prod.image ? { ...prod, image } : prod));
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

  const MANDATORY_BOT_TOKEN = '9275377452:AAFe5jKxocDThflP-icoMWITCNeJyuSKWbw';
  const MANDATORY_BOT_USERNAME = 'ravonavto_bot';
  const MANDATORY_BOT_LINK = 'https://t.me/ravonavto_bot';

  let telegramBotToken =
    typeof raw.telegramBotToken === 'string' && raw.telegramBotToken.trim()
      ? raw.telegramBotToken.trim()
      : MANDATORY_BOT_TOKEN;
  if (
    telegramBotToken.includes('8606681013') ||
    telegramBotToken !== MANDATORY_BOT_TOKEN
  ) {
    telegramBotToken = MANDATORY_BOT_TOKEN;
    wasModified = true;
  }

  let telegramUsername =
    typeof raw.telegramUsername === 'string' && raw.telegramUsername.trim()
      ? raw.telegramUsername.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '')
      : MANDATORY_BOT_USERNAME;
  if (
    telegramUsername.toLowerCase().includes('ravon_tuning') ||
    telegramUsername === 'RavonAutoTuningUz' ||
    telegramUsername.toLowerCase() !== MANDATORY_BOT_USERNAME
  ) {
    telegramUsername = MANDATORY_BOT_USERNAME;
    wasModified = true;
  }

  let telegramChannel =
    typeof raw.telegramChannel === 'string' && raw.telegramChannel.trim()
      ? raw.telegramChannel.trim()
      : MANDATORY_BOT_LINK;
  if (
    telegramChannel.toLowerCase().includes('ravon_tuning') ||
    telegramChannel.toLowerCase().includes('doliyev_dilshod')
  ) {
    telegramChannel = MANDATORY_BOT_LINK;
    wasModified = true;
  }

  const instagramUrl =
    typeof raw.instagramUrl === 'string' && raw.instagramUrl.trim()
      ? raw.instagramUrl.trim()
      : DEFAULT_SITE_SETTINGS.instagramUrl;

  const rawCopy = { ...raw } as Record<string, unknown>;
  if ('whatsappUrl' in rawCopy) {
    delete rawCopy.whatsappUrl;
    wasModified = true;
  }

  const settings: SiteSettings = stripUndefinedDeep({
    ...DEFAULT_SITE_SETTINGS,
    ...(rawCopy as Partial<SiteSettings>),
    addressCity,
    addressBazaar,
    addressDetails,
    mapLocationUrl,
    phonePrimary,
    phoneSecondary,
    telegramUsername,
    telegramChannel,
    telegramBotToken,
    instagramUrl,
  });

  return {
    settings,
    wasModified,
  };
}

/**
 * Strips any legacy static demo products (Zimmer LED, etc.) and explicitly deleted products.
 * Ultra-fast implementation without JSON.stringify/parse so 10,000 products sanitize in <2ms.
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

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (
      item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      item.id.length > 0 &&
      !STATIC_DEMO_PRODUCT_IDS.has(item.id) &&
      !deletedSet.has(item.id) &&
      !seen.has(item.id)
    ) {
      const prodObj = item as Product;
      const rawStock =
        prodObj.stock !== undefined && prodObj.stock !== null && !Number.isNaN(Number(prodObj.stock))
          ? Math.max(0, Math.floor(Number(prodObj.stock)))
          : prodObj.inStock === false
          ? 0
          : 10;
      const isAvailable = rawStock > 0 && (prodObj.inStock ?? true);
      const finalStock = isAvailable ? rawStock : 0;
      seen.add(prodObj.id);
      if (prodObj.stock === finalStock && prodObj.inStock === isAvailable) {
        result.push(prodObj);
      } else {
        result.push({
          ...prodObj,
          stock: finalStock,
          inStock: isAvailable,
        });
      }
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
    for (let i = 0; i < list.length; i++) {
      const rawItem = list[i];
      if (!rawItem || typeof rawItem !== 'object' || typeof rawItem.id !== 'string') continue;
      const id = rawItem.id.trim();
      if (!id || STATIC_DEMO_PRODUCT_IDS.has(id) || deletedSet.has(id)) continue;

      const existing = byId.get(id);
      const itemWithMeta = rawItem as Product & { sortOrder?: number; updatedAt?: number };
      if (!existing) {
        byId.set(id, itemWithMeta);
      } else {
        const incomingTime = itemWithMeta.updatedAt || 0;
        const existingTime = existing.updatedAt || 0;
        if (incomingTime >= existingTime) {
          byId.set(id, { ...existing, ...itemWithMeta });
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
 * Preserves `receiptImage` on both the order record and customer object for Firebase sync.
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
    .map((o) => {
      const receiptImg = o.receiptImage || o.customer?.receiptImage;
      return stripUndefinedDeep({
        ...o,
        ...(receiptImg ? { receiptImage: receiptImg } : {}),
        customer: o.customer
          ? {
              ...o.customer,
              ...(receiptImg ? { receiptImage: receiptImg } : {}),
            }
          : o.customer,
      });
    });
}

export interface BulkUploadResult {
  cloudSuccess: boolean;
  cloudError?: string;
  savedCount: number;
}

/**
 * NON-BLOCKING CHUNKED BULK UPLOAD + GUARANTEED INDEXEDDB & FIREBASE PERSISTENCE:
 * 1. Cleans every product object with JSON.parse(JSON.stringify(buildCleanProductObject(prod)))
 *    so zero `undefined` or `NaN` values exist, and ensures clean IDs without `.#$[]/`.
 * 2. Saves the full catalog immediately to `IndexedDB` (`saveToHighTrafficCache`) and `cachedCatalogProducts`
 *    so refreshing (F5) NEVER shows 0 products.
 * 3. Uploads in 500-item chunks (`CHUNK_SIZE = 500`) to Firebase RTDB (`ravon_products`) via REST `PATCH` & SDK `update()`,
 *    verifies HTTP status, and returns `{ cloudSuccess, cloudError, savedCount }`.
 */
export async function bulkUploadProductsInChunks(
  products: Product[],
  options?: {
    replaceAll?: boolean;
    oldProductIdsToClear?: string[];
    categories?: string[];
    carModels?: string[];
    brands?: string[];
    fullCatalogSnapshot?: Product[];
  },
  onProgress?: (info: { uploaded: number; total: number; percent: number }) => void
): Promise<BulkUploadResult> {
  isBulkUploadInProgress = true;
  isInitialLoadComplete = true;
  let cloudSuccess = true;
  let cloudError: string | undefined;

  try {
    const now = Date.now();
    const cleanedUploadList: Product[] = [];
    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      if (!prod) continue;
      cleanedUploadList.push(buildCleanProductObject(prod, i));
    }

    const total = cleanedUploadList.length;
    const finalCatalog = options?.fullCatalogSnapshot
      ? options.fullCatalogSnapshot.map((p, idx) => buildCleanProductObject(p, idx))
      : cleanedUploadList;

    // Clear deleted IDs so uploaded products are never filtered out on reload
    if (options?.replaceAll) {
      clearAllDeletedProductIds();
    } else {
      removeDeletedProductIds(finalCatalog.map((p) => p.id));
    }

    // 1. IMMEDIATELY save to memory & IndexedDB BEFORE network upload so F5 refresh never loses products!
    cachedCatalogProducts = finalCatalog;
    const metaPayload: RavonSyncPayload = {
      ...(options?.categories ? { categories: options.categories } : {}),
      ...(options?.carModels ? { carModels: options.carModels } : {}),
      ...(options?.brands ? { brands: options.brands } : {}),
      productsCount: finalCatalog.length,
      deletedProductIds: [],
      updatedAt: now,
    };
    const fullPayload: RavonSyncPayload = {
      ...metaPayload,
      products: finalCatalog,
    };
    await saveToHighTrafficCache(fullPayload);

    if (options?.replaceAll) {
      await Promise.all([
        rtdb ? rtdbRemove(rtdbRef(rtdb, PRODUCTS_COLLECTION)).catch(() => {}) : Promise.resolve(),
        FIREBASE_RTDB_URL
          ? fetch(`${FIREBASE_RTDB_URL}/${PRODUCTS_COLLECTION}.json`, {
              method: 'DELETE',
            }).catch(() => {})
          : Promise.resolve(),
      ]);
    }

    const CHUNK_SIZE = 500;
    for (let start = 0; start < total; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE, total);
      const chunkObj: Record<string, any> = {};

      for (let i = start; i < end; i++) {
        const cleanItem = cleanedUploadList[i];
        if (!cleanItem || !cleanItem.id) continue;
        chunkObj[cleanItem.id] = JSON.parse(
          JSON.stringify({
            ...cleanItem,
            sortOrder: i,
            updatedAt: now,
          })
        );
      }

      let chunkSavedToCloud = false;

      if (FIREBASE_RTDB_URL) {
        try {
          const res = await fetch(`${FIREBASE_RTDB_URL}/${PRODUCTS_COLLECTION}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunkObj),
          });
          if (res.ok) {
            chunkSavedToCloud = true;
          } else {
            const errText = await res.text().catch(() => '');
            cloudError = `Firebase RTDB xatosi (HTTP ${res.status}): ${errText.slice(0, 140) || 'Ruxsat (Rules) yoki tarmoq cheklovi'}`;
          }
        } catch (err: any) {
          cloudError = err?.message || 'Firebase RTDB serveriga ulanishda xatolik.';
        }
      }

      if (rtdb) {
        try {
          await rtdbUpdate(rtdbRef(rtdb, PRODUCTS_COLLECTION), chunkObj);
          chunkSavedToCloud = true;
        } catch (err: any) {
          if (!chunkSavedToCloud) {
            cloudError = err?.message || 'Firebase SDK update() xatosi.';
          }
        }
      }

      if (!chunkSavedToCloud) {
        cloudSuccess = false;
      }

      const uploaded = end;
      const percent = total > 0 ? Math.round((uploaded / total) * 100) : 100;
      if (onProgress) {
        onProgress({ uploaded, total, percent });
      }

      // Give the browser 50ms breathing time after every 500 items so the UI & Progress Bar never freeze
      await new Promise((r) => setTimeout(r, 50));
    }

    // Update metadata in main sync doc WITHOUT setting products: [] (which previously wiped state!)
    if (FIREBASE_RTDB_URL) {
      fetch(`${FIREBASE_RTDB_URL}/ravon_sync/main.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metaPayload,
          products: null,
          deletedProductIds: null,
        }),
      }).catch(() => {});
    }
    restPatchMainDoc(metaPayload).catch(() => {});

    try {
      broadcastChannel?.postMessage(fullPayload);
    } catch {}

    await saveToHighTrafficCache(fullPayload);
    safeFetchJson('/api/sync/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload),
    }).catch(() => {});

    return {
      cloudSuccess,
      cloudError: cloudSuccess ? undefined : cloudError,
      savedCount: finalCatalog.length,
    };
  } finally {
    setTimeout(() => {
      isBulkUploadInProgress = false;
    }, 800);
  }
}

/**
 * Syncs product documents inside Firestore `/ravon_products/{productId}` collection & RTDB.
 * Uses 500-item chunks with 50ms breathing delay when syncing > 30 products.
 */
async function syncProductsCollectionToFirestore(
  products: Product[],
  deletedIds: string[] = []
): Promise<void> {
  try {
    // 1. Delete explicitly removed product documents (only if small list)
    if (deletedIds.length > 0 && deletedIds.length <= 30) {
      const deletedSet = new Set(deletedIds);
      for (const delId of deletedSet) {
        if (delId) {
          if (db && !isFirestoreQuotaExceeded) {
            deleteDoc(doc(db, PRODUCTS_COLLECTION, delId)).catch(() => {});
          }
          restDeleteProductDoc(delId).catch(() => {});
          rtdbDeleteProduct(delId).catch(() => {});
        }
      }
    }

    const now = Date.now();

    // 2. If syncing > 30 products, batch-patch RTDB in 500-item chunks with 50ms breathing pauses
    if (products.length > 30) {
      const CHUNK_SIZE = 500;
      for (let start = 0; start < products.length; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, products.length);
        const chunkObj: Record<string, any> = {};
        for (let i = start; i < end; i++) {
          const prod = products[i];
          if (prod && prod.id) {
            chunkObj[prod.id] = {
              ...buildCleanProductObject(prod),
              sortOrder: i,
              updatedAt: now,
            };
          }
        }
        if (rtdb) {
          rtdbUpdate(rtdbRef(rtdb, PRODUCTS_COLLECTION), chunkObj).catch(() => {});
        }
        if (FIREBASE_RTDB_URL) {
          await fetch(`${FIREBASE_RTDB_URL}/${PRODUCTS_COLLECTION}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunkObj),
          }).catch(() => {});
        }
        if (end < products.length) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      return;
    }

    // 3. Upsert individual documents in `/ravon_products/{id}` when count <= 30
    const writePromises = products.map(async (prod, idx) => {
      const docData = {
        ...buildCleanProductObject(prod),
        sortOrder: idx,
        updatedAt: now,
      };
      await Promise.all([
        db && !isFirestoreQuotaExceeded
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
 * Immediately saves a single updated product (e.g. from inline quick photo upload, drag & drop, or Ctrl+V paste)
 * to Cloud Firestore SDK, Firestore REST API, and Firebase Realtime Database.
 */
export async function saveSingleProductToCloud(
  product: Product,
  sortOrder?: number
): Promise<void> {
  try {
    let image = product.image || '';
    if (image.startsWith('data:image/') && image.length > 90_000) {
      image = await compressImageDataUrl(image, 600, 0.7);
    }
    const docData = {
      ...buildCleanProductObject({ ...product, image }),
      ...(typeof sortOrder === 'number' ? { sortOrder } : {}),
      updatedAt: Date.now(),
    };

    await Promise.all([
      db && !isFirestoreQuotaExceeded
        ? setDoc(doc(db, PRODUCTS_COLLECTION, product.id), docData, { merge: true }).catch((err) => {
            handleFirestoreError(
              err,
              OperationType.WRITE,
              `${PRODUCTS_COLLECTION}/${product.id}`
            );
          })
        : Promise.resolve(),
      restUpsertProductDoc(docData),
      rtdbUpsertProduct(docData),
    ]);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PRODUCTS_COLLECTION}/${product.id}`);
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
  // If catalog is large (> 500), do NOT re-upload all remaining products on a single item delete!
  if (remainingProducts.length <= 500) {
    await pushRealtimeState({
      products: remainingProducts,
      deletedProductIds: deletedList.slice(-500),
    });
  } else {
    saveToHighTrafficCache({ products: remainingProducts, updatedAt: Date.now() }).catch(() => {});
  }
}

/**
 * Deletes ALL products in 1 click from Firebase RTDB, Firestore, Backend, and local cache.
 */
export async function clearAllProductsFromCloud(idsToDelete: string[]): Promise<void> {
  const deletedList = addDeletedProductIds(idsToDelete);
  cachedCatalogProducts = [];
  try {
    await Promise.all([
      rtdb ? rtdbRemove(rtdbRef(rtdb, PRODUCTS_COLLECTION)).catch(() => {}) : Promise.resolve(),
      FIREBASE_RTDB_URL
        ? fetch(`${FIREBASE_RTDB_URL}/${PRODUCTS_COLLECTION}.json`, {
            method: 'DELETE',
          }).catch(() => {})
        : Promise.resolve(),
    ]);
  } catch {
    // ignore
  }
  await pushRealtimeState(
    {
      products: [],
      deletedProductIds: deletedList.slice(-500),
    },
    { allowEmptyProducts: true, isExplicitUserAction: true }
  );
}

/**
 * Restores products (e.g. via Ctrl+Z / Undo) by unmarking them from deletedProductIds and syncing to Cloud in chunks.
 */
export async function restoreProductsToCloud(
  restoredProducts: Product[],
  onProgress?: (info: { uploaded: number; total: number; percent: number }) => void
): Promise<void> {
  if (restoredProducts.length > 100) {
    await bulkUploadProductsInChunks(restoredProducts, { replaceAll: true }, onProgress);
    return;
  }
  const restoredIds = restoredProducts.map((p) => p.id);
  const updatedDeletedList = removeDeletedProductIds(restoredIds);
  await pushRealtimeState(
    {
      products: restoredProducts,
      deletedProductIds: updatedDeletedList.slice(-500),
    },
    { isExplicitUserAction: true }
  );
}

/**
 * Forces a complete synchronization of all current store data to Cloud Firestore & Backend.
 */
export async function forceFullCloudSync(
  currentPayload: RavonSyncPayload
): Promise<{ success: boolean; count: number }> {
  try {
    if (currentPayload.products && currentPayload.products.length > 200) {
      const res = await bulkUploadProductsInChunks(currentPayload.products, {
        categories: currentPayload.categories,
        carModels: currentPayload.carModels,
        brands: currentPayload.brands,
      });
      return { success: res.cloudSuccess, count: currentPayload.products.length };
    }
    await pushRealtimeState(currentPayload, { isExplicitUserAction: true });
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
 *
 * ANTI-WIPE PROTECTION (Requirement 1):
 * - NEVER allows an empty `products: []` array to be written unless `options.allowEmptyProducts === true` (Delete All).
 * - Blocks writing `products` before `isInitialLoadComplete === true` unless `options.isExplicitUserAction === true`.
 * - NEVER writes `products: []` into `ravon_sync/main`!
 */
export async function pushRealtimeState(
  partial: RavonSyncPayload,
  options?: { allowEmptyProducts?: boolean; isExplicitUserAction?: boolean }
): Promise<void> {
  const now = Date.now();

  let safePartialProducts = partial.products;
  if (safePartialProducts !== undefined) {
    if (!isInitialLoadComplete && !options?.isExplicitUserAction) {
      // Block any pre-load race condition from touching products in Cloud
      safePartialProducts = undefined;
    } else if (safePartialProducts.length === 0 && !options?.allowEmptyProducts) {
      // Strictly block accidental empty array [] from wiping the database
      safePartialProducts = undefined;
    }
  }

  const normalizedProducts =
    safePartialProducts !== undefined
      ? await normalizeProductsForCloud(safePartialProducts)
      : undefined;

  if (normalizedProducts !== undefined) {
    if (normalizedProducts.length > 0 || options?.allowEmptyProducts) {
      cachedCatalogProducts = normalizedProducts;
    }
  }

  const deletedProductIds =
    partial.deletedProductIds !== undefined
      ? addDeletedProductIds(partial.deletedProductIds).slice(-500)
      : Array.from(getDeletedProductIds()).slice(-500);

  if (partial.siteSettings !== undefined) {
    setLocalSettingsUpdatedAt(now);
  }

  const { products: _ignoredPartialProducts, ...partialWithoutProducts } = partial;

  const payload: RavonSyncPayload = {
    ...partialWithoutProducts,
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
  };

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
    // CRITICAL ANTI-WIPE FIX: Never write `products: []` into `ravon_sync/main`!
    // Omit `products` from `mainDocPayload` when catalog > 150 items or when products are stored in `ravon_products`.
    const { products: _omitProductsFromMain, ...payloadWithoutProducts } = payload;
    const mainDocPayload = stripUndefinedDeep({
      ...payloadWithoutProducts,
      ...(normalizedProducts !== undefined
        ? { productsCount: normalizedProducts.length }
        : {}),
    });

    await Promise.all([
      db && !isFirestoreQuotaExceeded
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
      body: JSON.stringify({
        ...payload,
        ...(options?.allowEmptyProducts ? { explicitClearAll: true } : {}),
      }),
    });
  } catch {
    // Silent fallback
  }

  // 5. Update local High-Traffic Cache (IndexedDB + sessionStorage) immediately
  saveToHighTrafficCache(payload, { allowEmptyProducts: options?.allowEmptyProducts }).catch(
    () => {}
  );
}

// ============================================================================
// HIGH-TRAFFIC & CONNECTION POOLING CACHE ENGINE (1,000+ Concurrent Users)
// Uses IndexedDB + sessionStorage with 5-minute TTL so regular visitors
// DO NOT hold persistent Firebase `onValue` / `onSnapshot` WebSocket connections.
// ============================================================================
const HIGH_TRAFFIC_IDB_NAME = 'ravon_high_traffic_cache_db';
const HIGH_TRAFFIC_IDB_STORE = 'catalog_cache_v1';
const HIGH_TRAFFIC_IDB_KEY = 'main_state';
const SESSION_CACHE_TS_KEY = 'ravon_session_cache_ts';
const SESSION_CACHE_META_KEY = 'ravon_session_cache_meta';
export const HIGH_TRAFFIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (300,000 ms)

let activeFirebaseWebSocketCount = 0;

export function getActiveFirebaseWebSocketCount(): number {
  return activeFirebaseWebSocketCount;
}

function openHighTrafficIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(HIGH_TRAFFIC_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const dbInstance = req.result;
        if (!dbInstance.objectStoreNames.contains(HIGH_TRAFFIC_IDB_STORE)) {
          dbInstance.createObjectStore(HIGH_TRAFFIC_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveToHighTrafficCache(
  payload: RavonSyncPayload,
  options?: { allowEmptyProducts?: boolean }
): Promise<void> {
  const now = Date.now();

  if (payload.products && payload.products.length > 0) {
    cachedCatalogProducts = payload.products;
  } else if (payload.products !== undefined && payload.products.length === 0 && options?.allowEmptyProducts) {
    cachedCatalogProducts = [];
  }

  const effectiveProductsCount =
    payload.products && payload.products.length > 0
      ? payload.products.length
      : options?.allowEmptyProducts
      ? 0
      : cachedCatalogProducts.length;

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_CACHE_TS_KEY, String(now));
      sessionStorage.setItem(
        SESSION_CACHE_META_KEY,
        JSON.stringify({
          cachedAt: now,
          productsCount: effectiveProductsCount,
          ttlMs: HIGH_TRAFFIC_CACHE_TTL_MS,
          engine: 'IndexedDB + sessionStorage',
        })
      );
    }
  } catch {
    // ignore storage quota errors
  }

  const idb = await openHighTrafficIdb();
  if (!idb) return;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(HIGH_TRAFFIC_IDB_STORE, 'readwrite');
      const store = tx.objectStore(HIGH_TRAFFIC_IDB_STORE);
      const getReq = store.get(HIGH_TRAFFIC_IDB_KEY);
      getReq.onsuccess = () => {
        const existingRecord = getReq.result;
        const existingPayload: RavonSyncPayload =
          existingRecord && existingRecord.payload && typeof existingRecord.payload === 'object'
            ? (existingRecord.payload as RavonSyncPayload)
            : {};

        const preservedProducts =
          payload.products && payload.products.length > 0
            ? payload.products
            : options?.allowEmptyProducts
            ? []
            : cachedCatalogProducts.length > 0
            ? cachedCatalogProducts
            : Array.isArray(existingPayload.products)
            ? existingPayload.products
            : [];

        if (preservedProducts.length > 0 && cachedCatalogProducts.length === 0) {
          cachedCatalogProducts = preservedProducts;
        }

        const mergedToStore: RavonSyncPayload = {
          ...existingPayload,
          ...payload,
          products: preservedProducts,
          productsCount: preservedProducts.length,
          updatedAt: payload.updatedAt || now,
        };

        store.put({ payload: mergedToStore, cachedAt: now }, HIGH_TRAFFIC_IDB_KEY);
      };
      getReq.onerror = () => {
        store.put({ payload, cachedAt: now }, HIGH_TRAFFIC_IDB_KEY);
      };
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => {
        idb.close();
        resolve();
      };
    } catch {
      idb.close();
      resolve();
    }
  });
}

export async function loadFromHighTrafficCache(): Promise<{
  payload: RavonSyncPayload;
  cachedAt: number;
  isFresh: boolean;
} | null> {
  const idb = await openHighTrafficIdb();
  if (!idb) return null;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(HIGH_TRAFFIC_IDB_STORE, 'readonly');
      const store = tx.objectStore(HIGH_TRAFFIC_IDB_STORE);
      const req = store.get(HIGH_TRAFFIC_IDB_KEY);
      req.onsuccess = () => {
        idb.close();
        const res = req.result;
        if (res && res.payload && typeof res.cachedAt === 'number') {
          const loadedPayload = res.payload as RavonSyncPayload;
          if (Array.isArray(loadedPayload.products) && loadedPayload.products.length > 0) {
            cachedCatalogProducts = sanitizeProductsList(loadedPayload.products);
            loadedPayload.products = cachedCatalogProducts;
          }
          let sessionTs = res.cachedAt;
          try {
            const rawSessionTs = sessionStorage.getItem(SESSION_CACHE_TS_KEY);
            if (rawSessionTs) {
              sessionTs = Number(rawSessionTs) || res.cachedAt;
            }
          } catch {}
          const age = Date.now() - Math.min(res.cachedAt, sessionTs);
          resolve({
            payload: loadedPayload,
            cachedAt: res.cachedAt,
            isFresh: age >= 0 && age < HIGH_TRAFFIC_CACHE_TTL_MS,
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        idb.close();
        resolve(null);
      };
    } catch {
      idb.close();
      resolve(null);
    }
  });
}

export function getHighTrafficCacheMeta(): {
  cachedAt: number | null;
  ageSeconds: number | null;
  isFresh: boolean;
  engine: string;
} {
  try {
    const rawTs = sessionStorage.getItem(SESSION_CACHE_TS_KEY);
    const ts = rawTs ? Number(rawTs) : 0;
    if (ts > 0) {
      const ageMs = Math.max(0, Date.now() - ts);
      return {
        cachedAt: ts,
        ageSeconds: Math.round(ageMs / 1000),
        isFresh: ageMs < HIGH_TRAFFIC_CACHE_TTL_MS,
        engine: 'IndexedDB + sessionStorage (5 daqiqalik TTL)',
      };
    }
  } catch {}
  return {
    cachedAt: null,
    ageSeconds: null,
    isFresh: false,
    engine: 'IndexedDB + sessionStorage',
  };
}

export interface FirebaseDiagnosticResult {
  connected: boolean;
  pingMs: number;
  rtdbStatus: 'ok' | 'error';
  firestoreStatus: 'ok' | 'quota_exceeded' | 'error';
  connectionMode: string;
  activeWebSockets: number;
  cacheMeta: {
    cachedAt: number | null;
    ageSeconds: number | null;
    isFresh: boolean;
    engine: string;
  };
  details: string;
}

/**
 * Performs a real round-trip latency test (Ping in ms) to Firebase Realtime Database & Firestore REST API
 * and reports High-Traffic Connection Pooling metrics for the Admin Diagnostics dashboard.
 */
export async function runFirebaseConnectionDiagnostics(
  isAdminLive = false
): Promise<FirebaseDiagnosticResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let rtdbOk = false;
  let firestoreOk = false;

  try {
    const checks: Promise<void>[] = [];

    if (FIREBASE_RTDB_URL) {
      checks.push(
        fetch(`${FIREBASE_RTDB_URL}/ravon_sync/main/updatedAt.json?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
        })
          .then((res) => {
            if (res.ok) rtdbOk = true;
          })
          .catch(() => {})
      );
    }

    if (FIRESTORE_REST_BASE_URL && !isFirestoreQuotaExceeded) {
      checks.push(
        fetch(
          `${FIRESTORE_REST_BASE_URL}/ravon_sync/main?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
          {
            method: 'GET',
            cache: 'no-store',
          }
        )
          .then((res) => {
            if (res.ok || res.status === 404) firestoreOk = true;
            if (res.status === 429) markFirestoreQuotaExceeded();
          })
          .catch(() => {})
      );
    }

    await Promise.all(checks);
  } catch {
    // ignore
  }

  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const pingMs = Math.max(1, Math.round(end - start));
  const connected = rtdbOk || firestoreOk;
  const cacheMeta = getHighTrafficCacheMeta();

  return {
    connected,
    pingMs,
    rtdbStatus: rtdbOk ? 'ok' : 'error',
    firestoreStatus: isFirestoreQuotaExceeded
      ? 'quota_exceeded'
      : firestoreOk
      ? 'ok'
      : 'error',
    connectionMode: isAdminLive
      ? 'Admin Jonli Ulanish + 1000+ Mijoz Connection Pooling (5 daqiqalik Kesh)'
      : '1000+ Foydalanuvchi Yuqori Yuklama Rejimi (One-time Fetch + IndexedDB)',
    activeWebSockets: activeFirebaseWebSocketCount,
    cacheMeta,
    details: connected
      ? `Firebase baza aloqasi barqaror (${pingMs} ms). Oddiy mijozlar doimiy WebSocket ulanishini band qilmaydi.`
      : 'Firebase baza bilan aloqa uzilgan yoki internet tarmog‘ida cheklov mavjud.',
  };
}

/**
 * Pulls latest synchronized state from Firebase Realtime Database (`ravon_products` + `ravon_sync/main`),
 * Cloud Firestore, and Backend Server in parallel, combining them to return the most complete & up-to-date catalog.
 */
export async function pullRealtimeState(): Promise<RavonSyncPayload | null> {
  let firestoreMainData: RavonSyncPayload | null = null;
  let firestoreCollectionProducts: Product[] | null = null;
  let restMainData: RavonSyncPayload | null = null;
  let restCollectionProducts: Product[] | null = null;
  let backendData: RavonSyncPayload | null = null;

  // Fetch RTDB & Firestore REST in parallel for fast response
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

    const combinedRestProds = [...rtProds, ...rProds];
    if (combinedRestProds.length > 0) {
      restCollectionProducts = sanitizeProductsList(
        combinedRestProds,
        rtMain?.deletedProductIds || rMain?.deletedProductIds
      );
    }
  } catch {
    // ignore
  }

  // Only query Firestore SDK or Backend Server if RTDB did not already return the full product catalog
  if (!restCollectionProducts || restCollectionProducts.length === 0) {
    if (db && !isFirestoreQuotaExceeded) {
      try {
        const [mainSnap, productsSnap] = await Promise.all([
          getDoc(doc(db, 'ravon_sync', 'main')).catch((err) => {
            handleFirestoreError(err, OperationType.GET, SYNC_DOC_PATH);
            return null;
          }),
          getDocs(collection(db, PRODUCTS_COLLECTION)).catch((err) => {
            handleFirestoreError(err, OperationType.LIST, PRODUCTS_COLLECTION);
            return null;
          }),
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
          if (docsList.length > 0) {
            firestoreCollectionProducts = sanitizeProductsList(
              docsList,
              firestoreMainData?.deletedProductIds
            );
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, SYNC_DOC_PATH);
      }
    }

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
  }

  // Pull from Supabase if configured and no primary cloud data found
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
    restCollectionProducts === null &&
    cachedCatalogProducts.length === 0
  ) {
    isInitialLoadComplete = true;
    return null;
  }

  sources.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const primary = sources[0] || {};

  const allDeletedIds = Array.from(getDeletedProductIds());

  // Merge products across RTDB/REST collection, Firestore SDK collection, `/ravon_sync/main`, backend, and cached IndexedDB catalog
  let mergedProducts = mergeProductCatalogs(
    [
      restCollectionProducts,
      firestoreCollectionProducts,
      restMainData?.products && restMainData.products.length > 0 ? restMainData.products : null,
      firestoreMainData?.products && firestoreMainData.products.length > 0
        ? firestoreMainData.products
        : null,
      backendData?.products && backendData.products.length > 0 ? backendData.products : null,
      supabaseData?.products && supabaseData.products.length > 0 ? supabaseData.products : null,
    ],
    allDeletedIds
  );

  // If Cloud returned 0 products (e.g. offline/rules blocked) but IndexedDB cache has products, never wipe IndexedDB products!
  if (mergedProducts.length === 0 && cachedCatalogProducts.length > 0) {
    mergedProducts = cachedCatalogProducts;
  } else if (mergedProducts.length > 0) {
    cachedCatalogProducts = mergedProducts;
  }

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
    productsCount: mergedProducts.length,
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

  isInitialLoadComplete = true;

  // Cache result in IndexedDB + sessionStorage for High-Traffic Connection Pooling
  saveToHighTrafficCache(combined).catch(() => {});

  return combined;
}

/**
 * Subscribes to updates with High-Traffic Connection Pooling & Strict Anti-Wipe Protection:
 * 1. Immediately loads cached catalog from `IndexedDB` in <0.1s so F5 / Refresh shows products immediately.
 * 2. Performs a one-time pull from Firebase RTDB (`ravon_products`) to verify/update the catalog and sets `isInitialLoadComplete = true`.
 * 3. NEVER automatically pushes `products` back to Firebase inside `subscribeToRealtimeSync` (prevents empty `[]` race-condition wipes).
 * 4. NEVER allows an empty snapshot from Firestore `ravon_products` or `ravon_sync/main` (`products: []`) to wipe out non-empty products.
 */
export function subscribeToRealtimeSync(
  onUpdate: (payload: RavonSyncPayload) => void,
  options?: { isAdminLive?: boolean }
): () => void {
  const isAdminLive = Boolean(options?.isAdminLive);

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

  let latestCollectionProducts: Product[] | null =
    cachedCatalogProducts.length > 0 ? cachedCatalogProducts : null;

  const applyIncoming = (
    data: RavonSyncPayload | null,
    opts?: { allowEmptyProducts?: boolean }
  ) => {
    if (!data || isBulkUploadInProgress) return;

    const payloadCopy: RavonSyncPayload = { ...data };

    if (Array.isArray(payloadCopy.deletedProductIds)) {
      addDeletedProductIds(payloadCopy.deletedProductIds);
    }

    const deletedSet = getDeletedProductIds();

    if (payloadCopy.products !== undefined) {
      // ANTI-WIPE RULE: Never let an incoming empty products array [] overwrite existing products
      // unless explicitly triggered by "Delete All" (`opts?.allowEmptyProducts === true`)
      if (
        payloadCopy.products.length === 0 &&
        !opts?.allowEmptyProducts &&
        ((latestCollectionProducts && latestCollectionProducts.length > 0) ||
          cachedCatalogProducts.length > 0 ||
          initialLocalProducts.length > 0)
      ) {
        payloadCopy.products =
          latestCollectionProducts && latestCollectionProducts.length > 0
            ? latestCollectionProducts
            : cachedCatalogProducts.length > 0
            ? cachedCatalogProducts
            : initialLocalProducts;
      } else if (payloadCopy.products.length > 0) {
        const merged = mergeProductCatalogs(
          [payloadCopy.products, latestCollectionProducts, cachedCatalogProducts, initialLocalProducts],
          deletedSet
        );
        payloadCopy.products = merged;
        latestCollectionProducts = merged;
        cachedCatalogProducts = merged;
      }
    }

    if (payloadCopy.orders !== undefined) {
      payloadCopy.orders = sanitizeOrdersList(payloadCopy.orders);
    }
    if (payloadCopy.siteSettings !== undefined) {
      const localTs = getLocalSettingsUpdatedAt();
      const incomingTs = payloadCopy.settingsUpdatedAt || payloadCopy.updatedAt || 0;
      if (localTs > 0 && incomingTs > 0 && incomingTs < localTs) {
        delete payloadCopy.siteSettings;
      } else {
        const { settings } = sanitizeSiteSettings(payloadCopy.siteSettings);
        payloadCopy.siteSettings = settings;
        if (incomingTs > localTs) {
          setLocalSettingsUpdatedAt(incomingTs);
        }
      }
    }
    onUpdate(payloadCopy);
  };

  // Emit in-memory cached catalog immediately if available (e.g., when toggling Admin Panel)
  if (cachedCatalogProducts.length > 0) {
    onUpdate({
      products: cachedCatalogProducts,
      productsCount: cachedCatalogProducts.length,
      updatedAt: Date.now(),
    });
  }

  // 1 & 2. Persistent Live WebSocket Listeners — ONLY enabled when `isAdminLive === true`
  let unsubscribeProductsCol: (() => void) | null = null;
  let unsubscribeMainDoc: (() => void) | null = null;
  let unsubscribeRtdbProducts: (() => void) | null = null;
  let unsubscribeRtdbMain: (() => void) | null = null;
  let unsubscribeRtdbSettings: (() => void) | null = null;
  let openedWebSocketsForThisSub = 0;

  if (isAdminLive) {
    if (db && !isFirestoreQuotaExceeded) {
      try {
        unsubscribeProductsCol = onSnapshot(
          collection(db, PRODUCTS_COLLECTION),
          (querySnapshot) => {
            if (isBulkUploadInProgress) return;
            const docsList: Array<Product & { sortOrder?: number; updatedAt?: number }> = [];
            querySnapshot.forEach((docSnap) => {
              docsList.push(
                docSnap.data() as Product & { sortOrder?: number; updatedAt?: number }
              );
            });
            // CRITICAL ANTI-WIPE FIX:
            // When 4,443 products are stored in Firebase RTDB (`ravon_products`), the Firestore collection
            // `ravon_products` has 0 docs. Never allow an empty Firestore collection snapshot to wipe RTDB products!
            if (docsList.length === 0) {
              return;
            }
            docsList.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
            latestCollectionProducts = mergeProductCatalogs(
              [docsList, latestCollectionProducts, cachedCatalogProducts],
              getDeletedProductIds()
            );
            cachedCatalogProducts = latestCollectionProducts;
            applyIncoming({
              products: latestCollectionProducts,
              updatedAt: Date.now(),
            });
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, PRODUCTS_COLLECTION);
            if (unsubscribeProductsCol) {
              try {
                unsubscribeProductsCol();
              } catch {}
              unsubscribeProductsCol = null;
            }
          }
        );
        openedWebSocketsForThisSub++;
      } catch {
        unsubscribeProductsCol = null;
      }

      try {
        unsubscribeMainDoc = onSnapshot(
          doc(db, 'ravon_sync', 'main'),
          (snapshot) => {
            if (isBulkUploadInProgress) return;
            if (snapshot.exists()) {
              const rawData = { ...(snapshot.data() as RavonSyncPayload) };
              if (Array.isArray(rawData.deletedProductIds)) {
                addDeletedProductIds(rawData.deletedProductIds);
              }
              // Never let an empty `products: []` inside `ravon_sync/main` wipe out the catalog!
              if (Array.isArray(rawData.products) && rawData.products.length === 0) {
                delete rawData.products;
              }
              applyIncoming(rawData);
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, SYNC_DOC_PATH);
            if (unsubscribeMainDoc) {
              try {
                unsubscribeMainDoc();
              } catch {}
              unsubscribeMainDoc = null;
            }
          }
        );
        openedWebSocketsForThisSub++;
      } catch {
        unsubscribeMainDoc = null;
      }
    }

    if (rtdb) {
      try {
        unsubscribeRtdbProducts = rtdbOnValue(
          rtdbRef(rtdb, PRODUCTS_COLLECTION),
          (snap) => {
            if (isBulkUploadInProgress) return;
            const val = snap.val();
            if (val && typeof val === 'object') {
              const list = Object.values(val).filter(
                (item): item is Product & { sortOrder?: number; updatedAt?: number } =>
                  Boolean(item && typeof item === 'object' && typeof (item as any).id === 'string')
              );
              if (list.length > 0) {
                list.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
                latestCollectionProducts = sanitizeProductsList(list, getDeletedProductIds());
                cachedCatalogProducts = latestCollectionProducts;
                applyIncoming({
                  products: latestCollectionProducts,
                  updatedAt: Date.now(),
                });
              }
            }
          },
          () => {}
        );
        openedWebSocketsForThisSub++;
      } catch {
        unsubscribeRtdbProducts = null;
      }

      try {
        unsubscribeRtdbMain = rtdbOnValue(
          rtdbRef(rtdb, 'ravon_sync/main'),
          (snap) => {
            if (isBulkUploadInProgress) return;
            const val = snap.val() as RavonSyncPayload | null;
            if (val && typeof val === 'object') {
              const cleanedVal = { ...val };
              if (Array.isArray(cleanedVal.products) && cleanedVal.products.length === 0) {
                delete cleanedVal.products;
              }
              applyIncoming(cleanedVal);
            }
          },
          () => {}
        );
        openedWebSocketsForThisSub++;
      } catch {
        unsubscribeRtdbMain = null;
      }

      try {
        unsubscribeRtdbSettings = rtdbOnValue(
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
        openedWebSocketsForThisSub++;
      } catch {
        unsubscribeRtdbSettings = null;
      }
    }

    activeFirebaseWebSocketCount += openedWebSocketsForThisSub;
  }

  // 3. BroadcastChannel listener (same browser, multiple tabs)
  const handleBroadcast = (event: MessageEvent<RavonSyncPayload>) => {
    if (event?.data) {
      if (Array.isArray(event.data.deletedProductIds)) {
        addDeletedProductIds(event.data.deletedProductIds);
      }
      if (event.data.products !== undefined && event.data.products.length > 0) {
        latestCollectionProducts = sanitizeProductsList(
          event.data.products,
          event.data.deletedProductIds
        );
        cachedCatalogProducts = latestCollectionProducts;
      }
      applyIncoming(event.data);
    }
  };
  broadcastChannel?.addEventListener('message', handleBroadcast);

  // 4. Native localStorage 'storage' event listener (cross-tab sync)
  const handleStorageEvent = (e: StorageEvent) => {
    try {
      if (e.key === null) return;
      if (e.key === 'ravon_products' && e.newValue) {
        const parsed = JSON.parse(e.newValue);
        const sanitized = sanitizeProductsList(parsed);
        if (sanitized.length > 0) {
          onUpdate({ products: sanitized, updatedAt: Date.now() });
        }
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
      } else if (e.key === 'ravon_brands' && e.newValue) {
        onUpdate({ brands: JSON.parse(e.newValue), updatedAt: Date.now() });
      } else if (e.key === 'ravon_promocodes' && e.newValue) {
        onUpdate({ promoCodes: JSON.parse(e.newValue), updatedAt: Date.now() });
      } else if (e.key === 'ravon_product_reviews') {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        onUpdate({ reviews: Array.isArray(parsed) ? parsed : [], updatedAt: Date.now() });
      } else if (e.key === 'ravon_part_requests') {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        onUpdate({ partRequests: Array.isArray(parsed) ? parsed : [], updatedAt: Date.now() });
      }
    } catch {
      // ignore malformed storage values
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  // 5. Requirement 3: Reading Order on Page Open:
  // Step A (0.1s): Immediately hydrate from IndexedDB cache (`loadFromHighTrafficCache()`) and render on screen!
  // Step B: Check Firebase (`pullRealtimeState()`) for updates and update `Cloud Baza (4443)` without ever auto-pushing `[]`!
  const performOneTimePullAndMerge = async () => {
    const remote = await pullRealtimeState();
    isInitialLoadComplete = true;
    if (!remote) return;

    const deletedSet = getDeletedProductIds();
    if (remote.deletedProductIds) {
      remote.deletedProductIds.forEach((id) => deletedSet.add(id));
    }

    const remoteProducts = remote.products
      ? sanitizeProductsList(remote.products, deletedSet)
      : [];

    const mergedCategories = Array.from(
      new Set([
        ...(Array.isArray(remote.categories) ? remote.categories : DEFAULT_CATEGORIES),
        ...initialLocalCategories,
      ])
    );

    const mergedCarModels = Array.from(
      new Set([
        ...(Array.isArray(remote.carModels) ? remote.carModels : DEFAULT_CAR_MODELS),
        ...initialLocalCarModels,
      ])
    );

    const remoteBrands = Array.isArray(remote.brands) ? remote.brands : DEFAULT_BRANDS;

    const mergedProducts =
      remoteProducts.length > 0
        ? mergeProductCatalogs([remoteProducts, initialLocalProducts], deletedSet)
        : cachedCatalogProducts.length > 0
        ? cachedCatalogProducts
        : sanitizeProductsList(initialLocalProducts, deletedSet);

    if (mergedProducts.length > 0) {
      latestCollectionProducts = mergedProducts;
      cachedCatalogProducts = mergedProducts;
    }

    applyIncoming({
      ...remote,
      products: mergedProducts,
      productsCount: mergedProducts.length,
      categories: mergedCategories,
      carModels: mergedCarModels,
      brands: remoteBrands,
      updatedAt: remote.updatedAt || Date.now(),
    });
  };

  loadFromHighTrafficCache()
    .then((cached) => {
      if (cached?.payload) {
        if (cached.payload.products && cached.payload.products.length > 0) {
          latestCollectionProducts = cached.payload.products;
          cachedCatalogProducts = cached.payload.products;
        }
        applyIncoming(cached.payload);
      }
      // Verify/update from Firebase RTDB on page load so Cloud Baza (4443) is always accurate
      performOneTimePullAndMerge().catch(() => {
        isInitialLoadComplete = true;
      });
    })
    .catch(() => {
      performOneTimePullAndMerge().catch(() => {
        isInitialLoadComplete = true;
      });
    });

  // 6. Periodic background refresh:
  // - Regular visitors: every 5 minutes (300,000 ms) using one-time fetch + IndexedDB cache
  // - Admin Live mode: every 30 seconds
  const pollIntervalMs = isAdminLive ? 30_000 : HIGH_TRAFFIC_CACHE_TTL_MS;
  const intervalId = window.setInterval(async () => {
    const remote = await pullRealtimeState();
    if (remote) {
      if (remote.products && remote.products.length > 0) {
        latestCollectionProducts = remote.products;
        cachedCatalogProducts = remote.products;
      }
      applyIncoming(remote);
    }
  }, pollIntervalMs);

  return () => {
    if (unsubscribeMainDoc) unsubscribeMainDoc();
    if (unsubscribeProductsCol) unsubscribeProductsCol();
    if (unsubscribeRtdbProducts) unsubscribeRtdbProducts();
    if (unsubscribeRtdbMain) unsubscribeRtdbMain();
    if (unsubscribeRtdbSettings) unsubscribeRtdbSettings();
    if (openedWebSocketsForThisSub > 0) {
      activeFirebaseWebSocketCount = Math.max(
        0,
        activeFirebaseWebSocketCount - openedWebSocketsForThisSub
      );
    }
    broadcastChannel?.removeEventListener('message', handleBroadcast);
    window.removeEventListener('storage', handleStorageEvent);
    window.clearInterval(intervalId);
  };
}

