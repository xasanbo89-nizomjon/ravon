import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, 
  Settings, 
  Sparkles, 
  Package, 
  Megaphone, 
  ClipboardList, 
  Save, 
  Trash2, 
  Edit3, 
  Plus, 
  Upload, 
  RefreshCw, 
  Check, 
  Phone, 
  MapPin, 
  CreditCard, 
  Truck, 
  Car, 
  Search, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Eye,
  LogOut,
  Sliders,
  Users,
  ShieldCheck,
  UserPlus,
  KeyRound,
  Ban,
  Crown,
  Lock,
  Send,
  Cpu,
  Ticket,
  Tag,
  Percent,
  Coins,
  Calendar,
  Hash,
  Copy,
  Maximize2,
  Minimize2,
  Star,
  EyeOff,
  Download,
  FileSpreadsheet,
  Camera,
  Activity,
  RotateCcw
} from 'lucide-react';
import { 
  Product, 
  SiteSettings, 
  AnnouncementBanner, 
  OrderRecord, 
  OrderStatus, 
  AiAnalysisResult,
  AdminUser,
  AdminRole,
  PromoCode,
  ProductReview,
  PartRequest,
  PartRequestStatus
} from '../../types';
import { formatUzbekSum } from '../../utils/formatters';
import { sendTelegramNotification } from '../../utils/telegram';
import { safeFetchJson, cleanFriendlyErrorMessage } from '../../utils/apiClient';
import {
  compressImageDataUrl,
  deleteProductFromCloud,
  clearAllProductsFromCloud,
  restoreProductsToCloud,
  bulkUploadProductsInChunks,
  forceFullCloudSync,
  saveSingleProductToCloud,
  runFirebaseConnectionDiagnostics,
} from '../../services/supabaseSync';
import {
  buildSearchIndexForProduct,
  matchesSmartSearch,
} from '../../utils/smartSearch';
import {
  exportProductsToCsv,
  downloadSampleCsvTemplate,
  readSpreadsheetFile,
  detectInitialColumnMapping,
  buildPreviewProductsFromMappedRows,
  buildProductsFromMappedRowsChunked,
  ExcelSheetRawData,
  ExcelColumnMapping,
} from '../../utils/csvCatalog';
import {
  ProductImagePlaceholder,
  hasRealProductImage,
} from '../ProductImagePlaceholder';
import { StorePerformanceCharts } from './StorePerformanceCharts';
import { SiteHealthDiagnosticsTab } from './SiteHealthDiagnosticsTab';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  currentUser: AdminUser;
  admins: AdminUser[];
  onUpdateAdmins: (admins: AdminUser[]) => void;
  siteSettings: SiteSettings;
  onUpdateSiteSettings: (settings: SiteSettings) => void;
  announcementBanner: AnnouncementBanner;
  onUpdateBanner: (banner: AnnouncementBanner) => void;
  products: Product[];
  onUpdateProducts: (
    products: Product[],
    options?: { skipCloudPush?: boolean; allowEmptyProducts?: boolean }
  ) => void;
  carModels: string[];
  onUpdateCarModels: (models: string[]) => void;
  categories: string[];
  onUpdateCategories: (categories: string[]) => void;
  brands?: string[];
  onUpdateBrands?: (brands: string[]) => void;
  orders: OrderRecord[];
  onUpdateOrders: (orders: OrderRecord[]) => void;
  promoCodes?: PromoCode[];
  onUpdatePromoCodes?: (promoCodes: PromoCode[]) => void;
  reviews?: ProductReview[];
  onUpdateReviews?: (reviews: ProductReview[]) => void;
  partRequests?: PartRequest[];
  onUpdatePartRequests?: (partRequests: PartRequest[]) => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  currentUser,
  admins,
  onUpdateAdmins,
  siteSettings,
  onUpdateSiteSettings,
  announcementBanner,
  onUpdateBanner,
  products,
  onUpdateProducts,
  carModels,
  onUpdateCarModels,
  categories,
  onUpdateCategories,
  brands = [
    'Hammasi',
    'GM Genuine (Original)',
    'Ravon Original',
    'Zimmer',
    'Vland / Optra',
    'Merc Tuning',
    'AMG / Sport',
    'SS20',
    'Hi-Q (Koreya)',
    'Brembo',
  ],
  onUpdateBrands,
  orders,
  onUpdateOrders,
  promoCodes = [],
  onUpdatePromoCodes,
  reviews = [],
  onUpdateReviews,
  partRequests = [],
  onUpdatePartRequests,
}) => {
  const isSuperadmin =
    currentUser.role === 'superadmin' ||
    currentUser.email.toLowerCase() === 'sherzodjanovich_7';
  const isManager = currentUser.role === 'manager';

  const [activeTab, setActiveTab] = useState<'crm' | 'part-requests' | 'settings' | 'ai-add' | 'products' | 'banner' | 'admins' | 'promocodes' | 'reviews' | 'diagnostics'>('crm');
  const [toast, setToast] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isSystemHealthy, setIsSystemHealthy] = useState(true);
  const [livePingMs, setLivePingMs] = useState<number>(42);

  // TAB 1: Site Settings Form State (Only initialize when modal opens so background polling never overwrites user typing)
  const [tempSettings, setTempSettings] = useState<SiteSettings>(siteSettings);
  useEffect(() => {
    if (isOpen) {
      setTempSettings(siteSettings);
    }
  }, [isOpen]);
  const [isSendingTelegramTest, setIsSendingTelegramTest] = useState(false);
  const [telegramTestStatus, setTelegramTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [activeGeminiMaskedKey, setActiveGeminiMaskedKey] = useState<string | null>(null);
  const [isUpdatingGeminiKey, setIsUpdatingGeminiKey] = useState(false);

  // TAB 2: AI Add Product State
  const [aiImage, setAiImage] = useState<string>('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    bazaarName: '',
    sku: '',
    brand: 'GM Genuine (Original)',
    category: 'Optika',
    carModels: ['Gentra'],
    price: 500000,
    originalPrice: 600000,
    image: '',
    inStock: true,
    stock: 10,
    rating: 5.0,
    reviewCount: 1,
    badge: 'YANGILIK',
    description: '',
    specs: [],
    tags: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TAB 3: Products Management State (50 items per page Pagination + Debounced Smart Search + CSV/Excel Import/Export + Quick Photo Upload)
  const ADMIN_PRODUCTS_PAGE_SIZE = 50;
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [onlyMissingImages, setOnlyMissingImages] = useState(false);
  const [adminCurrentPage, setAdminCurrentPage] = useState<number>(1);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newCarModelName, setNewCarModelName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const quickImageInputRef = useRef<HTMLInputElement>(null);
  const quickCameraInputRef = useRef<HTMLInputElement>(null);
  const [quickUploadProductId, setQuickUploadProductId] = useState<string | null>(null);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);
  const [activePasteProductId, setActivePasteProductId] = useState<string | null>(null);
  const [previewPartRequest, setPreviewPartRequest] = useState<PartRequest | null>(null);

  // Requirement 2: Lightweight Reference-Only Undo Stack in `useRef` (Zero structuredClone, Zero JSON.stringify, Zero sessionStorage freeze)
  const undoHistoryRef = useRef<Array<{ label: string; products: Product[]; timestamp: number }>>([]);
  const [undoStackSize, setUndoStackSize] = useState<number>(0);

  // Requirement 3: Live Progress Bar state for Non-Blocking 500-item Chunked Bulk Upload
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{
    uploaded: number;
    total: number;
    percent: number;
    phaseText: string;
  } | null>(null);
  const [cloudUploadWarning, setCloudUploadWarning] = useState<string | null>(null);

  // Interactive Excel (.xlsx / .xls / .csv) Column Mapping & Preview Modal State
  const [excelPreviewModal, setExcelPreviewModal] = useState<{
    fileName: string;
    sheets: ExcelSheetRawData[];
    activeSheetIndex: number;
    hasHeader: boolean;
    headers: string[];
    mapping: ExcelColumnMapping;
    stockColumnDetected: boolean;
    defaultStockWhenMissing: number;
    importMode: 'append' | 'replace';
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProductSearch(productSearch.trim().toLowerCase());
      setAdminCurrentPage(1);
    }, 180);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // TAB 4: Banner Form State
  const [tempBanner, setTempBanner] = useState<AnnouncementBanner>(announcementBanner);

  // TAB 5: CRM Filters State & Payment Receipt Lightbox
  const [crmStatusFilter, setCrmStatusFilter] = useState<string>('Hammasi');
  const [crmSearch, setCrmSearch] = useState('');
  const [previewReceiptOrder, setPreviewReceiptOrder] = useState<{
    orderId: string;
    customerName: string;
    phone: string;
    totalAmount: number;
    paymentMethod: string;
    receiptImage: string;
    status: OrderStatus;
  } | null>(null);

  // TAB 6: Admins Management State (Superadmin only)
  const [newAdminForm, setNewAdminForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'manager' as AdminRole,
  });
  const [superadminNewPass, setSuperadminNewPass] = useState('');
  const [isChangingSuperPass, setIsChangingSuperPass] = useState(false);

  // TAB 7: Promo Codes Management State
  const [promoSearch, setPromoSearch] = useState('');
  const [promoFilter, setPromoFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [localPromoCodes, setLocalPromoCodes] = useState<PromoCode[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_promocodes');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {}
    return promoCodes;
  });

  useEffect(() => {
    if (promoCodes) {
      setLocalPromoCodes(promoCodes);
    }
  }, [promoCodes]);

  const updatePromos = (updated: PromoCode[]) => {
    setLocalPromoCodes(updated);
    try {
      localStorage.setItem('ravon_promocodes', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save promo codes to localStorage:', e);
    }
    if (onUpdatePromoCodes) {
      onUpdatePromoCodes(updated);
    }
  };

  const [newPromoForm, setNewPromoForm] = useState<{
    code: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    minOrderAmount: number;
    maxDiscountAmount: number;
    description: string;
    isActive: boolean;
    maxUses: number;
    expiresAt: string;
  }>({
    code: '',
    discountType: 'percent',
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscountAmount: 0,
    description: '',
    isActive: true,
    maxUses: 0,
    expiresAt: '',
  });
  const [copiedPromoId, setCopiedPromoId] = useState<string | null>(null);

  // TAB 8: Customer Reviews & Ratings Management State
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewRatingFilter, setReviewRatingFilter] = useState<number | 'all'>('all');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'all' | 'approved' | 'hidden'>('all');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editReviewComment, setEditReviewComment] = useState('');
  const [editReviewRating, setEditReviewRating] = useState<number>(5);
  const [localReviews, setLocalReviews] = useState<ProductReview[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_product_reviews');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {}
    return reviews;
  });

  useEffect(() => {
    if (reviews) {
      setLocalReviews(reviews);
    }
  }, [reviews]);

  const updateReviewsList = (updated: ProductReview[]) => {
    setLocalReviews(updated);
    try {
      localStorage.setItem('ravon_product_reviews', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save reviews to localStorage:', e);
    }
    if (onUpdateReviews) {
      onUpdateReviews(updated);
    }
  };

  // Fetch active Gemini status, check Firebase ping, and ensure local products are pushed to Cloud Firestore on modal open
  useEffect(() => {
    if (isOpen) {
      safeFetchJson<{ maskedKey?: string }>('/api/gemini/status')
        .then(res => {
          if (res.ok && res.data?.maskedKey) {
            setActiveGeminiMaskedKey(res.data.maskedKey);
          }
        })
        .catch(() => {});

      runFirebaseConnectionDiagnostics(true)
        .then(fbDiag => {
          setIsSystemHealthy(fbDiag.connected);
          setLivePingMs(fbDiag.pingMs);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Memoized & Debounced Smart Product Filtering (Cyrillic-Latin + Synonym + Artikul SKU) + Missing Photo Filter + Strict 50-item Pagination
  const indexedAdminProducts = useMemo(() => {
    return products.map((p) => buildSearchIndexForProduct(p));
  }, [products]);

  const missingImagesCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < products.length; i++) {
      if (!hasRealProductImage(products[i].image)) {
        count++;
      }
    }
    return count;
  }, [products]);

  const filteredProductList = useMemo(() => {
    const q = debouncedProductSearch;
    if (!q && !onlyMissingImages) return products;
    const matched: Product[] = [];
    for (let i = 0; i < indexedAdminProducts.length; i++) {
      const entry = indexedAdminProducts[i];
      if (onlyMissingImages && hasRealProductImage(entry.product.image)) {
        continue;
      }
      if (!q || matchesSmartSearch(entry, q)) {
        matched.push(entry.product);
      }
    }
    return matched;
  }, [products, indexedAdminProducts, debouncedProductSearch, onlyMissingImages]);

  // Requirement 1: Strict 50-products-per-page Admin Pagination (NEVER render 4,443 items into DOM at once!)
  const totalAdminPages = Math.max(1, Math.ceil(filteredProductList.length / ADMIN_PRODUCTS_PAGE_SIZE));
  const safeAdminPage = Math.min(Math.max(1, adminCurrentPage), totalAdminPages);
  const adminPageStartIndex = (safeAdminPage - 1) * ADMIN_PRODUCTS_PAGE_SIZE;

  const visibleAdminProductList = useMemo(() => {
    return filteredProductList.slice(
      adminPageStartIndex,
      adminPageStartIndex + ADMIN_PRODUCTS_PAGE_SIZE
    );
  }, [filteredProductList, adminPageStartIndex]);

  // Global Ctrl+V clipboard image paste listener when hovering/focusing a product row in Admin Products tab
  useEffect(() => {
    if (!isOpen || activeTab !== 'products' || !activePasteProductId) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const reader = new FileReader();
            const targetId = activePasteProductId;
            setUploadingProductId(targetId);
            reader.onload = async () => {
              try {
                const rawB64 = reader.result as string;
                const compressedB64 = await compressImageDataUrl(rawB64, 600, 0.7);
                let targetName = 'Mahsulot';
                let updatedTarget: Product | null = null;
                let targetIdx = 0;
                const updatedList = products.map((p, idx) => {
                  if (p.id === targetId) {
                    targetName = p.name;
                    targetIdx = idx;
                    updatedTarget = { ...p, image: compressedB64 };
                    return updatedTarget;
                  }
                  return p;
                });
                onUpdateProducts(updatedList, { skipCloudPush: true });
                if (updatedTarget) {
                  await saveSingleProductToCloud(updatedTarget, targetIdx);
                }
                setToast(`📋 Ctrl+V: "${targetName}" rasmi siqilib (600px) Firebase bazaga joylandi!`);
                setTimeout(() => setToast(null), 3200);
              } finally {
                setUploadingProductId(null);
              }
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isOpen, activeTab, activePasteProductId, products, onUpdateProducts]);

  // Requirement 3: Live Memoized Preview of ONLY the First 5 Mapped Excel / CSV Rows
  // (Never parses all 4,443 rows during preview; full parsing happens in chunks when "Tasdiqlash" is clicked!)
  const liveExcelPreviewResult = useMemo(() => {
    if (!excelPreviewModal) return null;
    const sheet = excelPreviewModal.sheets[excelPreviewModal.activeSheetIndex];
    if (!sheet) return null;
    return buildPreviewProductsFromMappedRows(
      sheet.rows,
      excelPreviewModal.mapping,
      {
        hasHeader: excelPreviewModal.hasHeader,
        defaultStockWhenColumnMissing: excelPreviewModal.defaultStockWhenMissing,
      },
      5
    );
  }, [excelPreviewModal]);

  // Requirement 2: Save previous array reference directly in `useRef` (Zero structuredClone / JSON.stringify)
  const pushUndoSnapshot = (label: string, snapshotProducts: Product[]) => {
    undoHistoryRef.current = [
      {
        label,
        products: snapshotProducts,
        timestamp: Date.now(),
      },
      ...undoHistoryRef.current,
    ].slice(0, 10);
    setUndoStackSize(undoHistoryRef.current.length);
  };

  const handleUndoProducts = async () => {
    if (undoHistoryRef.current.length === 0) {
      setToast("Orqaga qaytarish uchun saqlangan amal topilmadi.");
      setTimeout(() => setToast(null), 2800);
      return;
    }
    const [latest, ...rest] = undoHistoryRef.current;
    undoHistoryRef.current = rest;
    setUndoStackSize(rest.length);

    onUpdateProducts(latest.products, {
      skipCloudPush: true,
      allowEmptyProducts: latest.products.length === 0,
    });
    setAdminCurrentPage(1);

    if (latest.products.length > 100) {
      setBulkUploadProgress({
        uploaded: 0,
        total: latest.products.length,
        percent: 0,
        phaseText: `Tiklanmoqda: 0 / ${latest.products.length} (0%)...`,
      });
      await restoreProductsToCloud(latest.products, ({ uploaded, total, percent }) => {
        setBulkUploadProgress({
          uploaded,
          total,
          percent,
          phaseText: `Tiklanmoqda: ${uploaded} / ${total} (${percent}%)...`,
        });
      });
      setBulkUploadProgress(null);
    } else if (latest.products.length === 0) {
      await clearAllProductsFromCloud([]);
    } else {
      await restoreProductsToCloud(latest.products);
    }

    setToast(
      `↩️ Orqaga qaytarildi (${latest.label}): ${latest.products.length} ta tovar o‘z holiga tiklandi!`
    );
    setTimeout(() => setToast(null), 3500);
  };

  // Global Ctrl+Z / Cmd+Z Keyboard Listener inside Admin Panel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && !e.shiftKey && (e.key.toLowerCase() === 'z' || e.code === 'KeyZ')) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }
        if (undoHistoryRef.current.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          handleUndoProducts();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, undoStackSize]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleManualCloudSync = async () => {
    setIsCloudSyncing(true);
    try {
      const res = await forceFullCloudSync({
        products,
        categories,
        carModels,
        brands,
        siteSettings: tempSettings,
        announcementBanner: tempBanner,
        promoCodes: localPromoCodes,
        reviews: localReviews,
      });
      if (res.success) {
        showToast(`Cloud Baza sinxronlandi! (${res.count} ta mahsulot barcha qurilmalarda faol)`);
      } else {
        showToast("Sinxronlash yakunlandi!");
      }
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Send test Telegram message
  const handleSendTelegramTest = async () => {
    if (!tempSettings.telegramBotToken?.trim() || !tempSettings.telegramAdminChatId?.trim()) {
      showToast("Iltimos, Telegram Bot Token va Admin Chat ID maydonlarini to'ldiring.");
      return;
    }
    setIsSendingTelegramTest(true);
    setTelegramTestStatus(null);
    try {
      const testMsg = `🤖 <b>RAVON AUTO TUNING — TELEGRAM BOT TESTI</b>\n━━━━━━━━━━━━━━━━━━━━\n✅ Telegram boti muvaffaqiyatli ulandi!\n📍 Do‘kon: <b>${tempSettings.shopName}</b>\n⏰ Vaqti: <b>${new Date().toLocaleString('uz-UZ')}</b>\n━━━━━━━━━━━━━━━━━━━━\nUshbu chatga mijozlardan kelgan barcha yangi buyurtmalar hamda AI orqali qidirilgan zapchastlar so‘rovi avtomatik yuboriladi.`;
      
      const res = await sendTelegramNotification(
        tempSettings.telegramBotToken.trim(),
        tempSettings.telegramAdminChatId.trim(),
        testMsg
      );

      if (res.success) {
        setTelegramTestStatus({
          success: true,
          message: "✅ Sinov xabari Telegramga muvaffaqiyatli yuborildi! Chatni (ID: " + tempSettings.telegramAdminChatId + ") tekshiring.",
        });
        showToast("Telegramga test xabari muvaffaqiyatli yuborildi!");
      } else {
        setTelegramTestStatus({
          success: false,
          message: "❌ Xatolik: " + (res.error || "Token yoki Chat ID noto'g'ri kiritilgan. Botga /start yozganingizga ishonch hosil qiling."),
        });
      }
    } catch (err: any) {
      setTelegramTestStatus({
        success: false,
        message: "❌ Ulanish xatosi: " + (err?.message || "Internet aloqasi yoki Telegram xatosi"),
      });
    } finally {
      setIsSendingTelegramTest(false);
    }
  };

  // Test Gemini AI Integration
  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiTestStatus(null);
    try {
      const res = await safeFetchJson<{ success: boolean; message?: string; error?: string }>('/api/gemini/test', { method: 'POST' });
      if (res.ok && res.data?.success) {
        setGeminiTestStatus({
          success: true,
          message: `✅ Gemini 3.8 Flash ulanishi muvaffaqiyatli! Server javobi: "${res.data.message}"`,
        });
        showToast("Gemini 3.8 Flash AI ulanishi muvaffaqiyatli!");
      } else {
        setGeminiTestStatus({
          success: false,
          message: `❌ Xatolik: ${res.data?.error || res.error || "Gemini API kaliti javob bermadi"}`,
        });
      }
    } catch (err: any) {
      setGeminiTestStatus({
        success: false,
        message: `❌ Ulanish xatosi: ${cleanFriendlyErrorMessage(err?.message)}`,
      });
    } finally {
      setIsTestingGemini(false);
    }
  };

  // Update Gemini API Key dynamically
  const handleUpdateGeminiKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!geminiApiKeyInput.trim()) {
      showToast("Iltimos, yangi Gemini API kalitini kiriting.");
      return;
    }
    setIsUpdatingGeminiKey(true);
    try {
      const res = await safeFetchJson<{ success: boolean; maskedKey?: string; message?: string; error?: string }>('/api/gemini/update-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newKey: geminiApiKeyInput.trim() }),
      });
      if (res.ok && res.data?.success) {
        if (res.data.maskedKey) setActiveGeminiMaskedKey(res.data.maskedKey);
        setGeminiApiKeyInput('');
        showToast("Gemini API kaliti yangilandi!");
        setGeminiTestStatus({
          success: true,
          message: "✅ Yangi kalit serverda o'rnatildi! Tekshirish uchun quyidagi test tugmasini bosing.",
        });
      } else {
        showToast(cleanFriendlyErrorMessage(res.data?.error || res.error || "Kalitni yangilashda xatolik yuz berdi"));
      }
    } catch (err: any) {
      showToast(cleanFriendlyErrorMessage(err?.message || "Server bilan bog'lanishda xatolik yuz berdi"));
    } finally {
      setIsUpdatingGeminiKey(false);
    }
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedSettings: SiteSettings = {
      ...tempSettings,
      phonePrimary: tempSettings.phonePrimary.trim(),
      phoneSecondary: tempSettings.phoneSecondary.trim(),
      addressCity: tempSettings.addressCity.trim(),
      addressBazaar: tempSettings.addressBazaar.trim(),
      addressDetails: tempSettings.addressDetails.trim(),
      mapLocationUrl: tempSettings.mapLocationUrl.trim(),
      telegramChannel: tempSettings.telegramChannel.trim(),
      telegramUsername: tempSettings.telegramUsername.trim(),
      instagramUrl: tempSettings.instagramUrl.trim(),
    };
    setTempSettings(cleanedSettings);
    onUpdateSiteSettings(cleanedSettings);
    showToast("Sayt sozlamalari Firebase bazasiga muvaffaqiyatli saqlandi!");
  };

  // Save Banner
  const handleSaveBanner = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateBanner(tempBanner);
    showToast("E'lonlar banneri saqlandi va saytda yangilandi!");
  };

  // AI Analysis for New Product
  const handleAiAnalyze = async () => {
    if (!aiImage) {
      setAiError("Iltimos, avval zapchast rasmini yuklang yoki URL kiriting.");
      return;
    }
    setIsAiAnalyzing(true);
    setAiError(null);

    try {
      const response = await safeFetchJson<{ success: boolean; data?: AiAnalysisResult; error?: string }>('/api/analyze-part', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: aiImage.startsWith('data:') ? aiImage : undefined,
          imageUrl: !aiImage.startsWith('data:') ? aiImage : undefined,
          hint: newProduct.name || newProduct.bazaarName || undefined,
        }),
      });

      const res: AiAnalysisResult =
        response.ok && response.data?.success && response.data?.data
          ? response.data.data
          : {
              partName: newProduct.name || 'GM / Ravon Original Avtozapchast va Tyuning Detali',
              bazaarName: newProduct.bazaarName || 'Original tyuning zapchast',
              brand: newProduct.brand || 'GM Genuine (Original)',
              category: newProduct.category || 'Optika',
              compatibleCars: newProduct.carModels?.length ? newProduct.carModels : ['Gentra', 'Cobalt'],
              estimatedPriceRange:
                "Aniq va eng arzon narxlarni saytimizdagi katalogdan ko‘rishingiz yoki +998 (95) 463-37-36 raqami orqali menejerimizdan bilib olishingiz mumkin.",
              description:
                'Yuklangan rasm asosida aniqlangan avtomobil ehtiyot qismi va tyuning jihozi. Ravon Auto Tuning kafolati bilan.',
              tuningTips: 'Shtatniy joyiga mos ravishda o‘rnatiladi.',
              searchKeywords: ['tyuning', 'zapchast', 'gentra', 'cobalt'],
            };

      setNewProduct(prev => ({
        ...prev,
        name: res.partName || prev.name,
        bazaarName: res.bazaarName || prev.bazaarName,
        brand: res.brand || prev.brand || 'GM Genuine (Original)',
        category: res.category || prev.category || 'Optika',
        carModels: res.compatibleCars && res.compatibleCars.length > 0 ? res.compatibleCars : ['Gentra'],
        description: res.description + (res.tuningTips ? ` (Usta tavsiyasi: ${res.tuningTips})` : ''),
        tags: res.searchKeywords || ['tyuning', 'zapchast'],
        price: prev.price || 0,
        originalPrice: prev.originalPrice || 0,
        image: aiImage,
      }));

      showToast("Gemini AI detal ma'lumotlarini avtomatik to'ldirdi!");
    } catch (err: any) {
      setAiError(cleanFriendlyErrorMessage(err?.message || "AI bilan bog'lanishda xatolik yuz berdi"));
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rawB64 = reader.result as string;
      const compressedB64 = await compressImageDataUrl(rawB64, 600, 0.7);
      setAiImage(compressedB64);
      setNewProduct(prev => ({ ...prev, image: compressedB64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) {
      showToast("Iltimos, mahsulot nomi va narxini to'ldiring.");
      return;
    }

    let finalImage = (newProduct.image || '').trim();
    if (finalImage.startsWith('data:image/')) {
      finalImage = await compressImageDataUrl(finalImage, 600, 0.7);
    }

    const rawStock =
      newProduct.stock !== undefined && newProduct.stock !== null && !Number.isNaN(Number(newProduct.stock))
        ? Math.max(0, Math.floor(Number(newProduct.stock)))
        : 10;
    const isAvailable = rawStock > 0 && (newProduct.inStock ?? true);
    const finalStock = isAvailable ? rawStock : 0;

    const cleanSku = (newProduct.sku || '').trim();
    const created: Product = {
      id: 'ravon-' + Date.now(),
      name: newProduct.name || 'Yangi Zapchast',
      bazaarName: newProduct.bazaarName || newProduct.name || 'Zapchast',
      ...(cleanSku ? { sku: cleanSku } : {}),
      brand: newProduct.brand || 'GM Genuine (Original)',
      category: newProduct.category || 'Optika',
      carModels: newProduct.carModels && newProduct.carModels.length > 0 ? newProduct.carModels : ['Gentra'],
      price: Number(newProduct.price) || 0,
      ...(newProduct.originalPrice ? { originalPrice: Number(newProduct.originalPrice) } : {}),
      image: finalImage,
      inStock: isAvailable,
      stock: finalStock,
      rating: 5.0,
      reviewCount: 1,
      ...(newProduct.badge ? { badge: newProduct.badge } : { badge: 'YANGILIK' }),
      description: newProduct.description || '',
      specs: [
        ...(cleanSku ? [{ label: 'Artikul / OEM kodi', value: cleanSku }] : []),
        { label: 'Brend / Ishlab chiqaruvchi', value: newProduct.brand || 'GM Genuine (Original)' },
        { label: 'Ombordagi soni', value: `${finalStock} dona` },
        { label: 'Mos modellar', value: (newProduct.carModels || []).join(', ') },
        { label: 'Kategoriya', value: newProduct.category || 'Optika' },
        { label: 'Kafolat', value: '14 kun tekshirish kafolati' },
      ],
      tags: newProduct.tags || ['zapchast', 'tyuning'],
    };

    onUpdateProducts([created, ...products]);
    showToast(`"${created.name}" (${finalStock} dona) umumiy bazaga va katalogga qo‘shildi!`);

    setAiImage('');
    setNewProduct({
      name: '',
      bazaarName: '',
      sku: '',
      brand: 'GM Genuine (Original)',
      category: 'Optika',
      carModels: ['Gentra'],
      price: 500000,
      originalPrice: 600000,
      image: '',
      inStock: true,
      stock: 10,
      badge: 'YANGILIK',
      description: '',
      tags: [],
    });
    setActiveTab('products');
  };

  // Step 1 of Bulk Excel (.xlsx / .xls / .csv) Import: Read via ArrayBuffer & SheetJS, then open Column Mapping & Preview Modal
  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { fileName, sheets } = await readSpreadsheetFile(file);
      if (!sheets || sheets.length === 0 || sheets[0].rows.length === 0) {
        showToast("Fayl bo‘sh yoki jadval ma'lumotlari topilmadi.");
        return;
      }

      const detected = detectInitialColumnMapping(sheets[0].rows);
      setExcelPreviewModal({
        fileName,
        sheets,
        activeSheetIndex: 0,
        hasHeader: detected.hasHeader,
        headers: detected.headers,
        mapping: detected.mapping,
        stockColumnDetected: detected.stockColumnDetected,
        defaultStockWhenMissing: 10,
        importMode: 'append',
      });
    } catch (err) {
      console.error('Excel/CSV read error:', err);
      showToast("Excel / CSV faylni o‘qishda xatolik yuz berdi.");
    } finally {
      if (csvFileInputRef.current) {
        csvFileInputRef.current.value = '';
      }
    }
  };

  // Step 2 of Bulk Excel Import: Non-Blocking Chunked Processing (500 rows/chunk) + 500-item Chunked Firebase Upload with Live Progress Bar
  const handleConfirmExcelImport = async () => {
    if (!excelPreviewModal || bulkUploadProgress) return;

    if (excelPreviewModal.mapping.name < 0) {
      showToast("Iltimos, 'Mahsulot nomi' ustunini tanlang!");
      return;
    }
    if (excelPreviewModal.mapping.price < 0) {
      showToast("Iltimos, 'Narxi' ustunini tanlang!");
      return;
    }

    const sheet = excelPreviewModal.sheets[excelPreviewModal.activeSheetIndex];
    if (!sheet || sheet.rows.length === 0) return;

    const estimatedTotal = Math.max(
      1,
      sheet.rows.length - (excelPreviewModal.hasHeader ? 1 : 0)
    );

    setBulkUploadProgress({
      uploaded: 0,
      total: estimatedTotal,
      percent: 0,
      phaseText: `Excel qatorlari o‘qilmoqda: 0 / ${estimatedTotal} (0%)...`,
    });

    // Yield once so the Progress Bar renders immediately on screen
    await new Promise((r) => setTimeout(r, 20));

    const {
      products: importedProducts,
      discoveredCategories,
      discoveredCarModels,
      discoveredBrands,
      inStockCount,
      outOfStockCount,
    } = await buildProductsFromMappedRowsChunked(
      sheet.rows,
      excelPreviewModal.mapping,
      {
        hasHeader: excelPreviewModal.hasHeader,
        defaultStockWhenColumnMissing: excelPreviewModal.defaultStockWhenMissing,
      },
      (processed, total) => {
        const pct = total > 0 ? Math.round((processed / total) * 100) : 100;
        setBulkUploadProgress({
          uploaded: processed,
          total,
          percent: pct,
          phaseText: `Excel qayta ishlanmoqda: ${processed} / ${total} (${pct}%)...`,
        });
      }
    );

    if (importedProducts.length === 0) {
      setBulkUploadProgress(null);
      showToast("Tanlangan ustunlar bo‘yicha mahsulot topilmadi.");
      return;
    }

    // Save current products array reference in useRef for instant Ctrl+Z / Orqaga qaytarish
    pushUndoSnapshot(
      `Excel yuklash (${excelPreviewModal.fileName})`,
      products
    );

    const nextCategories = Array.from(new Set([...categories, ...discoveredCategories]));
    if (nextCategories.length > categories.length) {
      onUpdateCategories(nextCategories);
    }

    const nextCars = Array.from(new Set([...carModels, ...discoveredCarModels]));
    if (nextCars.length > carModels.length) {
      onUpdateCarModels(nextCars);
    }

    const nextBrands = Array.from(new Set([...brands, ...discoveredBrands]));
    if (onUpdateBrands && nextBrands.length > brands.length) {
      onUpdateBrands(nextBrands);
    }

    const isReplaceMode = excelPreviewModal.importMode === 'replace';
    const oldIds = isReplaceMode ? products.map((p) => p.id) : [];
    const updatedCatalog: Product[] = isReplaceMode
      ? importedProducts
      : [...importedProducts, ...products];

    // Reset Admin Pagination to Page 1 (renders only first 50 items in DOM!) and update local state without blocking
    setAdminCurrentPage(1);
    setCloudUploadWarning(null);
    onUpdateProducts(updatedCatalog, { skipCloudPush: true });

    // Upload to Firebase in 500-item chunks with 50ms breathing delay and live Progress Bar
    const totalToUpload = importedProducts.length;
    setBulkUploadProgress({
      uploaded: 0,
      total: totalToUpload,
      percent: 0,
      phaseText: `Yuklanmoqda: 0 / ${totalToUpload} (0%)...`,
    });

    const uploadResult = await bulkUploadProductsInChunks(
      isReplaceMode ? updatedCatalog : importedProducts,
      {
        replaceAll: isReplaceMode,
        oldProductIdsToClear: oldIds,
        categories: nextCategories,
        carModels: nextCars,
        brands: nextBrands,
        fullCatalogSnapshot: updatedCatalog,
      },
      ({ uploaded, total, percent }) => {
        setBulkUploadProgress({
          uploaded,
          total,
          percent,
          phaseText: `Yuklanmoqda: ${uploaded} / ${total} (${percent}%)...`,
        });
      }
    );

    setBulkUploadProgress(null);
    setExcelPreviewModal(null);

    if (!uploadResult.cloudSuccess) {
      const warnMsg =
        uploadResult.cloudError ||
        "Firebase Cloud bazaga yozishda ruxsat (Rules) yoki tarmoq xatoligi yuz berdi. Barcha tovarlar brauzerning doimiy IndexedDB xotirasiga saqlandi va F5 bosilganda ham o'chmaydi!";
      setCloudUploadWarning(warnMsg);
      showToast(
        `⚠️ Cloud xatosi! Lekin ${updatedCatalog.length} ta tovar IndexedDB xotirasiga to'liq saqlandi!`
      );
    } else {
      showToast(
        `✅ ${importedProducts.length} ta tovar (${inStockCount} ta sotuvda, ${outOfStockCount} ta 0 dona) Firebase + IndexedDB bazasiga kafolatli saqlandi!`
      );
    }
  };

  // 1-Click Delete All Products ("🗑️ Barchasini o'chirish (Delete All)") with automatic reference Undo snapshot
  const handleDeleteAllProducts = async () => {
    if (products.length === 0) {
      showToast("Tovarlar ro‘yxati allaqachon bo‘sh!");
      return;
    }
    const totalCount = products.length;
    const allIds = products.map((p) => p.id);

    // Save array reference in useRef so Ctrl+Z or "↩️ Orqaga qaytarish" restores all products in 1 click
    pushUndoSnapshot(`${totalCount} ta tovar o‘chirildi (Delete All)`, products);

    setAdminCurrentPage(1);
    onUpdateProducts([], { skipCloudPush: true, allowEmptyProducts: true });
    await clearAllProductsFromCloud(allIds);
    showToast(
      `🗑️ Barcha ${totalCount} ta mahsulot 1 klikda tozalandi! Qaytarish uchun Ctrl+Z yoki "↩️ Orqaga qaytarish" tugmasini bosing.`
    );
  };

  // Product edits
  const handleToggleStock = (productId: string) => {
    pushUndoSnapshot('Ombor holati o‘zgarishi', products);
    let targetItem: Product | null = null;
    let targetIdx = 0;
    const updated = products.map((p, idx) => {
      if (p.id !== productId) return p;
      const nextInStock = !p.inStock;
      const nextStock = nextInStock ? (p.stock && p.stock > 0 ? p.stock : 10) : 0;
      targetIdx = idx;
      targetItem = { ...p, inStock: nextInStock, stock: nextStock };
      return targetItem;
    });
    onUpdateProducts(updated, { skipCloudPush: true });
    if (targetItem) {
      saveSingleProductToCloud(targetItem, targetIdx).catch(() => {});
    }
    showToast("Mahsulot ombor holati o'zgartirildi!");
  };

  const handleDeleteProduct = (productId: string, name: string) => {
    pushUndoSnapshot(`"${name}" o‘chirildi`, products);
    const updated = products.filter(p => p.id !== productId);
    onUpdateProducts(updated, {
      skipCloudPush: true,
      allowEmptyProducts: updated.length === 0,
    });
    deleteProductFromCloud(productId, updated).catch(() => {});
    showToast(`"${name}" o‘chirildi! (Qaytarish: Ctrl+Z)`);
  };

  const handleEditImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rawB64 = reader.result as string;
      const compressedB64 = await compressImageDataUrl(rawB64, 600, 0.7);
      setEditingProduct(prev => (prev ? { ...prev, image: compressedB64 } : null));
    };
    reader.readAsDataURL(file);
  };

  // Inline Quick Photo Upload (Button / Camera / Drag & Drop / Paste Ctrl+V) directly in Products Table
  const applyQuickImageFileToProduct = (productId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast("Iltimos, faqat rasm faylini (JPG, PNG, WebP) tanlang!");
      return;
    }
    setUploadingProductId(productId);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawB64 = reader.result as string;
        const compressedB64 = await compressImageDataUrl(rawB64, 600, 0.7);
        let targetName = 'Mahsulot';
        let updatedTarget: Product | null = null;
        let targetIdx = 0;

        const updatedList = products.map((p, idx) => {
          if (p.id === productId) {
            targetName = p.name;
            targetIdx = idx;
            updatedTarget = { ...p, image: compressedB64 };
            return updatedTarget;
          }
          return p;
        });

        onUpdateProducts(updatedList, { skipCloudPush: true });
        if (updatedTarget) {
          await saveSingleProductToCloud(updatedTarget, targetIdx);
        }
        showToast(`📸 "${targetName}" rasmi siqilib (600px, JPEG 0.7) darhol Firebase bazaga saqlandi!`);
      } catch (err) {
        console.error('Quick image upload error:', err);
        showToast("Rasmni yuklashda xatolik yuz berdi.");
      } finally {
        setUploadingProductId(null);
        setQuickUploadProductId(null);
        if (quickImageInputRef.current) quickImageInputRef.current.value = '';
        if (quickCameraInputRef.current) quickCameraInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quickUploadProductId) return;
    applyQuickImageFileToProduct(quickUploadProductId, file);
  };

  const triggerQuickFileSelect = (productId: string, useCamera = false) => {
    setQuickUploadProductId(productId);
    setActivePasteProductId(productId);
    setTimeout(() => {
      if (useCamera) {
        quickCameraInputRef.current?.click();
      } else {
        quickImageInputRef.current?.click();
      }
    }, 0);
  };

  const handleRowDragOver = (e: React.DragEvent<HTMLTableRowElement>, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverProductId !== productId) {
      setDragOverProductId(productId);
    }
  };

  const handleRowDrop = (e: React.DragEvent<HTMLTableRowElement>, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverProductId(null);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      applyQuickImageFileToProduct(productId, file);
    }
  };

  const handleRowPaste = (e: React.ClipboardEvent<HTMLTableRowElement>, productId: string) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          e.stopPropagation();
          applyQuickImageFileToProduct(productId, file);
          break;
        }
      }
    }
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    let finalImage = editingProduct.image;
    if (finalImage && finalImage.startsWith('data:image/')) {
      finalImage = await compressImageDataUrl(finalImage, 600, 0.7);
    }
    const rawStock =
      editingProduct.stock !== undefined &&
      editingProduct.stock !== null &&
      !Number.isNaN(Number(editingProduct.stock))
        ? Math.max(0, Math.floor(Number(editingProduct.stock)))
        : editingProduct.inStock === false
        ? 0
        : 10;
    const isAvailable = rawStock > 0 && (editingProduct.inStock ?? true);
    const finalStock = isAvailable ? rawStock : 0;

    const updatedItem: Product = {
      ...editingProduct,
      image: finalImage,
      inStock: isAvailable,
      stock: finalStock,
    };
    let targetIdx = 0;
    const updated = products.map((p, idx) => {
      if (p.id === updatedItem.id) {
        targetIdx = idx;
        return updatedItem;
      }
      return p;
    });
    onUpdateProducts(updated, { skipCloudPush: true });
    await saveSingleProductToCloud(updatedItem, targetIdx);
    setEditingProduct(null);
    showToast("Mahsulot umumiy bazada muvaffaqiyatli yangilandi!");
  };

  // Car models
  const handleAddCarModel = () => {
    if (!newCarModelName.trim()) return;
    if (carModels.includes(newCarModelName.trim())) {
      showToast("Bu model allaqachon mavjud!");
      return;
    }
    onUpdateCarModels([...carModels, newCarModelName.trim()]);
    setNewCarModelName('');
    showToast("Yangi mashina modeli qo'shildi!");
  };

  const handleDeleteCarModel = (model: string) => {
    if (model === 'Hammasi') return;
    onUpdateCarModels(carModels.filter(m => m !== model));
    showToast(`"${model}" modeli o'chirildi!`);
  };

  // Categories
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (categories.includes(newCategoryName.trim())) {
      showToast("Bu kategoriya mavjud!");
      return;
    }
    onUpdateCategories([...categories, newCategoryName.trim()]);
    setNewCategoryName('');
    showToast("Yangi kategoriya qo'shildi!");
  };

  const handleDeleteCategory = (cat: string) => {
    if (cat === 'Hammasi') return;
    onUpdateCategories(categories.filter(c => c !== cat));
    showToast(`"${cat}" kategoriyasi o'chirildi!`);
  };

  // Brands
  const handleAddBrand = () => {
    if (!newBrandName.trim() || !onUpdateBrands) return;
    if (brands.includes(newBrandName.trim())) {
      showToast("Bu brend allaqachon mavjud!");
      return;
    }
    onUpdateBrands([...brands, newBrandName.trim()]);
    setNewBrandName('');
    showToast("Yangi brend / ishlab chiqaruvchi qo'shildi!");
  };

  const handleDeleteBrand = (brand: string) => {
    if (brand === 'Hammasi' || !onUpdateBrands) return;
    onUpdateBrands(brands.filter(b => b !== brand));
    showToast(`"${brand}" brendi o'chirildi!`);
  };

  // CRM Order status
  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const updated = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    onUpdateOrders(updated);
    showToast(`Buyurtma #${orderId} holati "${newStatus}"ga o‘zgartirildi!`);
  };

  const handleDeleteOrder = (orderId: string) => {
    onUpdateOrders(orders.filter(o => o.id !== orderId));
    showToast(`Buyurtma #${orderId} o'chirildi!`);
  };

  // Part Requests ("Buyurtma stoli") status & delete handlers
  const handleUpdatePartRequestStatus = (reqId: string, newStatus: PartRequestStatus) => {
    if (!onUpdatePartRequests) return;
    const updated = partRequests.map((r) => (r.id === reqId ? { ...r, status: newStatus } : r));
    onUpdatePartRequests(updated);
    showToast(`So‘rov #${reqId} holati "${newStatus}"ga o‘zgartirildi!`);
  };

  const handleDeletePartRequest = (reqId: string) => {
    if (!onUpdatePartRequests) return;
    onUpdatePartRequests(partRequests.filter((r) => r.id !== reqId));
    showToast(`So‘rov #${reqId} o‘chirildi!`);
  };

  // --- TAB 6: ADMINS MANAGEMENT (SUPERADMIN ONLY) ---
  const handleCreateNewAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminForm.fullName || !newAdminForm.email || !newAdminForm.password) {
      showToast("Iltimos, barcha maydonlarni to'ldiring.");
      return;
    }

    const emailClean = newAdminForm.email.trim().toLowerCase();
    if (admins.some(a => a.email.toLowerCase() === emailClean)) {
      showToast("Bu email manziliga ega admin allaqachon mavjud!");
      return;
    }

    const createdAdmin: AdminUser = {
      id: 'admin-' + Date.now(),
      fullName: newAdminForm.fullName.trim(),
      email: emailClean,
      password: newAdminForm.password.trim(),
      role: newAdminForm.role,
      isBlocked: false,
      createdAt: new Date().toISOString(),
    };

    onUpdateAdmins([...admins, createdAdmin]);
    setNewAdminForm({
      fullName: '',
      email: '',
      password: '',
      role: 'manager',
    });
    showToast(`Yangi admin "${createdAdmin.fullName}" muvaffaqiyatli qo‘shildi!`);
  };

  const handleToggleBlockAdmin = (adminId: string) => {
    const target = admins.find(a => a.id === adminId);
    if (!target) return;
    if (target.role === 'superadmin' || target.email === 'axiy3735@gmail.com') {
      showToast("Superadmin hisobini bloklash mumkin emas!");
      return;
    }

    const updated = admins.map(a => a.id === adminId ? { ...a, isBlocked: !a.isBlocked } : a);
    onUpdateAdmins(updated);
    showToast(`"${target.fullName}" ${!target.isBlocked ? 'bloklandi' : 'blokdan chiqarildi'}!`);
  };

  const handleDeleteAdmin = (adminId: string) => {
    const target = admins.find(a => a.id === adminId);
    if (!target) return;
    if (target.role === 'superadmin' || target.email === 'axiy3735@gmail.com') {
      showToast("Asosiy Superadmin hisobini o'chirib bo'lmaydi!");
      return;
    }

    onUpdateAdmins(admins.filter(a => a.id !== adminId));
    showToast(`"${target.fullName}" admini o'chirildi!`);
  };

  // Change Superadmin password
  const handleChangeSuperadminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!superadminNewPass.trim() || superadminNewPass.trim().length < 4) {
      showToast("Yangi parol kamida 4 belgidan iborat bo'lishi kerak.");
      return;
    }

    const updated = admins.map(a => {
      if (a.email === 'axiy3735@gmail.com') {
        return { ...a, password: superadminNewPass.trim() };
      }
      return a;
    });

    onUpdateAdmins(updated);
    setSuperadminNewPass('');
    setIsChangingSuperPass(false);
    showToast("Superadmin paroli muvaffaqiyatli yangilandi!");
  };

  // Filtered lists (filteredProductList is memoized above)

  const filteredOrders = orders.filter(o => {
    if (crmStatusFilter !== 'Hammasi' && o.status !== crmStatusFilter) return false;
    if (crmSearch) {
      const q = crmSearch.toLowerCase();
      return (
        o.customer.fullName.toLowerCase().includes(q) ||
        o.customer.phone.includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.customer.region.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const newOrdersCount = orders.filter(o => o.status === 'Yangi').length;

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center ${isFullscreen ? 'p-0' : 'p-0 sm:p-3'} bg-black/95 backdrop-blur-md overflow-hidden animate-in fade-in duration-200`}>
      <div 
        className={`w-full ${isFullscreen ? 'h-full rounded-none border-0' : 'max-w-[100vw] sm:max-w-[98vw] h-[94vh] sm:h-[97vh] rounded-t-3xl sm:rounded-3xl border-t sm:border border-red-600/60 shadow-2xl'} bg-[#0c0e14] flex flex-col overflow-hidden relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast Alert */}
        {toast && (
          <div className="absolute top-16 sm:top-20 right-3 sm:right-6 left-3 sm:left-auto z-50 bg-red-600 text-white font-racing text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl border border-red-400 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
            <Check className="w-4 h-4 bg-white text-red-600 rounded-full p-0.5 shrink-0" />
            <span className="truncate">{toast}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="p-3 sm:p-5 bg-gradient-to-r from-red-950 via-zinc-950 to-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-900/50 shrink-0">
              <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="font-racing text-sm sm:text-xl font-bold text-white tracking-wide truncate">
                  RAVON AUTO ADMIN
                </span>
                {isSuperadmin ? (
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-red-600 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md shadow-red-950 shrink-0">
                    <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-200" />
                    <span>SUPERADMIN</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[9px] sm:text-[10px] font-bold shrink-0">
                    {currentUser.role === 'full_admin' ? 'Katta Admin' : 'Menejer'}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate">
                <strong className="text-zinc-200">{currentUser.fullName}</strong> ({currentUser.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('diagnostics')}
              className={`min-h-[40px] sm:min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isSystemHealthy
                  ? 'bg-emerald-950/90 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-600/60'
                  : 'bg-red-950/90 hover:bg-red-900/90 text-red-300 border border-red-600/60'
              }`}
              title="🩺 Tizim Holati va Diagnostika (Site Health) bo'limini ochish"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isSystemHealthy ? 'bg-emerald-400 animate-ping' : 'bg-red-400 animate-pulse'
                }`}
              />
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">
                {isSystemHealthy ? 'Tizim Soz' : 'Nosozlik'}
              </span>
              <span className="font-mono text-[11px] tabular-nums opacity-90">
                {livePingMs}ms
              </span>
            </button>
            <button
              type="button"
              onClick={handleManualCloudSync}
              disabled={isCloudSyncing}
              className="min-h-[40px] sm:min-h-[42px] px-2.5 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
              title="Barcha mahsulotlarni Cloud Firestore bazasi bilan majburiy sinxronlash"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-400 ${isCloudSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">
                {isCloudSyncing ? 'Sinxronlanmoqda...' : `Cloud Baza (${products.length})`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="hidden sm:flex min-h-[42px] px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold items-center gap-1.5 transition active:scale-95"
              title={isFullscreen ? "Oyna rejimiga o'tish" : "To'liq ekranga yoyish (Full-screen)"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="hidden sm:inline">{isFullscreen ? 'Kichraytirish' : 'To‘liq ekran'}</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
              title="Admin seansidan chiqish"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline">Chiqish</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] sm:min-w-[42px] sm:min-h-[42px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-red-600 text-zinc-400 hover:text-white border border-zinc-800 transition active:scale-95"
              title="Yopish va do'konni ko'rish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar (RBAC Filtered & Horizontally Swipeable on Mobile) */}
        <div className="bg-[#10121a] border-b border-zinc-800 px-3 sm:px-4 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 py-2 whitespace-nowrap">
          {/* CRM: visible to all roles */}
          <button
            type="button"
            onClick={() => setActiveTab('crm')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition active:scale-95 ${
              activeTab === 'crm'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-900/40 border border-red-500'
                : 'bg-zinc-900/80 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <ClipboardList className={`w-4 h-4 ${activeTab === 'crm' ? 'text-white' : 'text-red-400'}`} />
            <span>Kelgan buyurtmalar (CRM)</span>
            {newOrdersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-red-600 text-[10px] font-black flex items-center justify-center animate-pulse">
                {newOrdersCount}
              </span>
            )}
          </button>

          {/* Buyurtma stoli (Photo Part Requests): visible to all roles */}
          <button
            type="button"
            onClick={() => setActiveTab('part-requests')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition active:scale-95 ${
              activeTab === 'part-requests'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-900/40 border border-red-500'
                : 'bg-zinc-900/80 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Camera className={`w-4 h-4 ${activeTab === 'part-requests' ? 'text-white' : 'text-amber-400'}`} />
            <span>Buyurtma stoli (Rasm so‘rovlar)</span>
            <span className="px-1.5 py-0.2 rounded bg-red-600/30 text-red-200 text-[10px] font-mono font-bold">
              {partRequests.length}
            </span>
          </button>

          {/* AI Add Product: visible to all roles */}
          <button
            type="button"
            onClick={() => setActiveTab('ai-add')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition active:scale-95 ${
              activeTab === 'ai-add'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-900/40 border border-red-500'
                : 'bg-zinc-900/80 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${activeTab === 'ai-add' ? 'text-white' : 'text-red-400'}`} />
            <span>AI Zapchast qo‘shish</span>
          </button>

          {/* Products: visible to all roles */}
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition active:scale-95 ${
              activeTab === 'products'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-900/40 border border-red-500'
                : 'bg-zinc-900/80 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Package className={`w-4 h-4 ${activeTab === 'products' ? 'text-white' : 'text-red-400'}`} />
            <span>Mahsulotlar va Kategoriyalar [{products.length}]</span>
          </button>

          {/* Reviews & Ratings: visible to all roles */}
          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition active:scale-95 ${
              activeTab === 'reviews'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-900/40 border border-red-500'
                : 'bg-zinc-900/80 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Star className={`w-4 h-4 ${activeTab === 'reviews' ? 'text-amber-300 fill-amber-300' : 'text-amber-400'}`} />
            <span>Baholar va Izohlar</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
              {localReviews.length}
            </span>
          </button>

          {/* Banner: visible to superadmin and full_admin */}
          {!isManager && (
            <button
              type="button"
              onClick={() => setActiveTab('banner')}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition active:scale-95 ${
                activeTab === 'banner'
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-900/40 border border-red-500'
                  : 'bg-zinc-900/80 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <Megaphone className={`w-4 h-4 ${activeTab === 'banner' ? 'text-white' : 'text-red-400'}`} />
              <span>Aksiya va E‘lonlar banneri</span>
            </button>
          )}

          {/* Promokodlar: visible to superadmin and managers */}
          <button
            type="button"
            onClick={() => setActiveTab('promocodes')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition active:scale-95 ${
              activeTab === 'promocodes'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-900/40 border border-red-500'
                : 'bg-zinc-900/80 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Ticket className={`w-4 h-4 ${activeTab === 'promocodes' ? 'text-white' : 'text-red-400'}`} />
            <span>Promokodlar</span>
            <span className="px-1.5 py-0.2 rounded bg-red-600/30 text-red-300 text-[10px] font-mono font-bold">
              {promoCodes.length}
            </span>
          </button>

          {/* Settings: visible to superadmin and full_admin */}
          {!isManager && (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition active:scale-95 ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-900/40 border border-red-500'
                : 'bg-zinc-900/80 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-white' : 'text-red-400'}`} />
              <span>Sayt sozlamalari va Aloqa</span>
            </button>
          )}

          {/* 6. ADMINS MANAGEMENT TAB - EXCLUSIVELY FOR SUPERADMIN (axiy3735@gmail.com) */}
          {isSuperadmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admins')}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition active:scale-95 ${
                activeTab === 'admins'
                  ? 'bg-gradient-to-r from-amber-500 to-red-600 text-white shadow-md shadow-amber-950/60 border border-amber-400'
                  : 'bg-zinc-900/80 hover:bg-zinc-850 text-amber-400 hover:text-amber-300 border border-amber-900/40'
              }`}
            >
              <Users className="w-4 h-4 text-amber-300" />
              <span>Adminlar boshqaruvi</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                {admins.length}
              </span>
            </button>
          )}

          {/* 7. SITE HEALTH & DIAGNOSTICS TAB: visible to all roles */}
          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition active:scale-95 ${
              activeTab === 'diagnostics'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-950/60 border border-emerald-400'
                : 'bg-zinc-900/80 hover:bg-zinc-850 text-emerald-400 hover:text-emerald-300 border border-emerald-900/50'
            }`}
          >
            <Activity className={`w-4 h-4 ${activeTab === 'diagnostics' ? 'text-white' : 'text-emerald-400'}`} />
            <span>🩺 Tizim Holati (Diagnostika)</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums ${
                isSystemHealthy
                  ? 'bg-emerald-500/25 text-emerald-200'
                  : 'bg-red-500/30 text-red-200'
              }`}
            >
              {isSystemHealthy ? 'SOZ' : 'XATO'}
            </span>
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 bg-[#090b10] pb-16 sm:pb-6">
          {/* TAB: TIZIM HOLATI VA DIAGNOSTIKA (SITE HEALTH) */}
          {activeTab === 'diagnostics' && (
            <SiteHealthDiagnosticsTab
              products={products}
              siteSettings={tempSettings}
              onOpenProductsWithFilter={(missingOnly) => {
                setOnlyMissingImages(missingOnly);
                setActiveTab('products');
              }}
              onOpenSettingsTab={() => setActiveTab('settings')}
              onStatusChange={(healthy, ping) => {
                setIsSystemHealthy(healthy);
                setLivePingMs(ping);
              }}
            />
          )}
          
          {/* TAB: ADMINLARNI BOSHQARISH (FAQAT SUPERADMIN axiy3735@gmail.com UCHUN) */}
          {activeTab === 'admins' && isSuperadmin && (
            <div className="w-full space-y-6 animate-in fade-in duration-200">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      Faqat Superadmin huquqi
                    </span>
                  </div>
                  <h3 className="text-xl font-racing font-bold text-white tracking-wide mt-2">
                    Adminlar va Xodimlarni Boshqarish
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Siz (axiy3735@gmail.com) mutlaq Superadminsiz. Yangi yordamchi adminlarni qo‘shish, huquq berish yoki bloklash mumkin.
                  </p>
                </div>

                {/* Superadmin change password trigger */}
                <button
                  onClick={() => setIsChangingSuperPass(!isChangingSuperPass)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-2 transition"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Superadmin Parolini O‘zgartirish</span>
                </button>
              </div>

              {/* Superadmin Password Change Box */}
              {isChangingSuperPass && (
                <form 
                  onSubmit={handleChangeSuperadminPassword}
                  className="bg-gradient-to-r from-amber-950/30 to-red-950/30 border border-amber-700/50 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4" />
                      <span>Superadmin (axiy3735@gmail.com) uchun yangi parol o‘rnatish:</span>
                    </h4>
                    <button 
                      type="button" 
                      onClick={() => setIsChangingSuperPass(false)}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      required
                      value={superadminNewPass}
                      onChange={(e) => setSuperadminNewPass(e.target.value)}
                      placeholder="Yangi kuchli parolni kiriting (masalan: YangiParol2026!)..."
                      className="flex-1 bg-zinc-900 border border-zinc-750 rounded-xl px-4 py-2 text-xs text-white font-mono"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-racing font-bold text-xs uppercase tracking-wider transition"
                    >
                      Parolni Yangilash
                    </button>
                  </div>
                </form>
              )}

              {/* Add New Admin Form */}
              <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-red-500" />
                  <span>Yangi Yordamchi Admin Qo‘shish</span>
                </h4>

                <form onSubmit={handleCreateNewAdmin} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-zinc-300 mb-1 font-semibold">Ism va Familiya *</label>
                      <input
                        type="text"
                        required
                        value={newAdminForm.fullName}
                        onChange={(e) => setNewAdminForm({ ...newAdminForm, fullName: e.target.value })}
                        placeholder="Masalan: Jamshid (Sotuvchi)"
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-300 mb-1 font-semibold">Email Manzili *</label>
                      <input
                        type="email"
                        required
                        value={newAdminForm.email}
                        onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                        placeholder="masalan: jamshid@ravon.uz"
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-300 mb-1 font-semibold">Boshlang‘ich Parol *</label>
                      <input
                        type="text"
                        required
                        value={newAdminForm.password}
                        onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                        placeholder="Parol kiriting..."
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-300 mb-1 font-semibold">Huquqlari (Roli) *</label>
                      <select
                        value={newAdminForm.role}
                        onChange={(e) => setNewAdminForm({ ...newAdminForm, role: e.target.value as AdminRole })}
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="manager">Menejer (Faqat zapchast & CRM)</option>
                        <option value="full_admin">Katta Admin (To‘liq sozlamalar)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-900/40"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adminni Ro‘yxatga Qo‘shish</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Admins Table */}
              <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-red-500" />
                    <span>Mavjud Adminlar Ro‘yxati ({admins.length} ta)</span>
                  </h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                      <tr>
                        <th className="p-3">Admin</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Paroli</th>
                        <th className="p-3">Roli & Huquqlari</th>
                        <th className="p-3">Holati</th>
                        <th className="p-3 text-right">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {admins.map(admin => {
                        const isMainSuper = admin.email === 'axiy3735@gmail.com';
                        return (
                          <tr key={admin.id} className="hover:bg-zinc-900/40 transition">
                            <td className="p-3">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                {isMainSuper && <Crown className="w-4 h-4 text-amber-400" />}
                                <span>{admin.fullName}</span>
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                Qo‘shilgan: {new Date(admin.createdAt).toLocaleDateString('uz-UZ')}
                              </div>
                            </td>
                            <td className="p-3 font-mono text-zinc-300">
                              {admin.email}
                            </td>
                            <td className="p-3 font-mono text-zinc-400">
                              {admin.password}
                            </td>
                            <td className="p-3">
                              {admin.role === 'superadmin' ? (
                                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px] uppercase">
                                  Bosh Superadmin
                                </span>
                              ) : admin.role === 'full_admin' ? (
                                <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold text-[10px] uppercase">
                                  Katta Admin
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold text-[10px] uppercase">
                                  Sotuv Menejeri
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {admin.isBlocked ? (
                                <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold uppercase">
                                  Bloklangan
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-green-950 text-green-400 border border-green-800 text-[10px] font-bold uppercase">
                                  Faol
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {isMainSuper ? (
                                <span className="text-[11px] text-amber-400 font-semibold italic">
                                  Himoyalangan
                                </span>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleToggleBlockAdmin(admin.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
                                      admin.isBlocked
                                        ? 'bg-green-950/80 hover:bg-green-900 text-green-400 border border-green-800'
                                        : 'bg-zinc-850 hover:bg-red-950 text-zinc-300 hover:text-red-400 border border-zinc-750'
                                    }`}
                                  >
                                    {admin.isBlocked ? 'Ochish' : 'Bloklash'}
                                  </button>

                                  <button
                                    onClick={() => handleDeleteAdmin(admin.id)}
                                    className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-800/60 transition"
                                    title="O‘chirish"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: SAYT SOZLAMALARI VA ALOQA */}
          {activeTab === 'settings' && !isManager && (
            <form onSubmit={handleSaveSettings} className="w-full space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-lg font-racing font-bold text-white">
                    Do‘kon nomi, brend va asosiy sarlavhalar
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Bosh sahifadagi barcha matnlar, logotip va kontaktlarni shu yerdan o'zgartiring.
                  </p>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-racing font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-900/50 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Saqlash</span>
                </button>
              </div>

              {/* Branding */}
              <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>Do‘kon Brendi va Logotipi</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">To‘liq do‘kon nomi</label>
                    <input
                      type="text"
                      value={tempSettings.shopName}
                      onChange={(e) => setTempSettings({ ...tempSettings, shopName: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Logotip 1-so‘zi (Oq rangda)</label>
                    <input
                      type="text"
                      value={tempSettings.brandLogoWord1}
                      onChange={(e) => setTempSettings({ ...tempSettings, brandLogoWord1: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Logotip 2-so‘zi (Qizil rangda)</label>
                    <input
                      type="text"
                      value={tempSettings.brandLogoWord2}
                      onChange={(e) => setTempSettings({ ...tempSettings, brandLogoWord2: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Hero Asosiy Sarlavha (1-qism)</label>
                    <input
                      type="text"
                      value={tempSettings.heroTitlePrefix}
                      onChange={(e) => setTempSettings({ ...tempSettings, heroTitlePrefix: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Hero Rangli Urg‘u (2-qism)</label>
                    <input
                      type="text"
                      value={tempSettings.heroTitleHighlight}
                      onChange={(e) => setTempSettings({ ...tempSettings, heroTitleHighlight: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Hero ostidagi ta'rif (Subtitle)</label>
                  <textarea
                    rows={2}
                    value={tempSettings.heroSubtitle}
                    onChange={(e) => setTempSettings({ ...tempSettings, heroSubtitle: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                  />
                </div>
              </div>

              {/* Contacts & Address */}
              <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>Aloqa va Bozor Manzili</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Asosiy Telefon raqam</label>
                    <input
                      type="text"
                      value={tempSettings.phonePrimary}
                      onChange={(e) => setTempSettings({ ...tempSettings, phonePrimary: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Qo‘shimcha telefon / Operator</label>
                    <input
                      type="text"
                      value={tempSettings.phoneSecondary}
                      onChange={(e) => setTempSettings({ ...tempSettings, phoneSecondary: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Ish vaqti</label>
                    <input
                      type="text"
                      value={tempSettings.workingHours}
                      onChange={(e) => setTempSettings({ ...tempSettings, workingHours: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Shahar va Tuman</label>
                    <input
                      type="text"
                      value={tempSettings.addressCity}
                      onChange={(e) => setTempSettings({ ...tempSettings, addressCity: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Bozor nomi</label>
                    <input
                      type="text"
                      value={tempSettings.addressBazaar}
                      onChange={(e) => setTempSettings({ ...tempSettings, addressBazaar: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Do‘kon / Blok raqami</label>
                    <input
                      type="text"
                      value={tempSettings.addressDetails}
                      onChange={(e) => setTempSettings({ ...tempSettings, addressDetails: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Google / Yandex xarita havolasi (Lokatsiya)</label>
                  <input
                    type="url"
                    value={tempSettings.mapLocationUrl}
                    onChange={(e) => setTempSettings({ ...tempSettings, mapLocationUrl: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
                  />
                </div>
              </div>

              {/* Social Media */}
              <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>Ijtimoiy Tarmoqlar</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Telegram Kanal Havolasi</label>
                    <input
                      type="text"
                      value={tempSettings.telegramChannel}
                      onChange={(e) => setTempSettings({ ...tempSettings, telegramChannel: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Telegram User / Bot (@siz)</label>
                    <input
                      type="text"
                      value={tempSettings.telegramUsername}
                      onChange={(e) => setTempSettings({ ...tempSettings, telegramUsername: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Instagram Profil Havolasi</label>
                    <input
                      type="text"
                      value={tempSettings.instagramUrl}
                      onChange={(e) => setTempSettings({ ...tempSettings, instagramUrl: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery & Payment details */}
              <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span>Yetkazib Berish Narxi & Karta Ma'lumotlari (Mijozga ko'rinadi)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Standart Yetkazish Narxi (so‘mda)</label>
                    <input
                      type="number"
                      value={tempSettings.deliveryCost}
                      onChange={(e) => setTempSettings({ ...tempSettings, deliveryCost: Number(e.target.value) })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100 font-racing"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Bepul yetkazish chegarasi (so‘mda)</label>
                    <input
                      type="number"
                      value={tempSettings.freeDeliveryThreshold}
                      onChange={(e) => setTempSettings({ ...tempSettings, freeDeliveryThreshold: Number(e.target.value) })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100 font-racing"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Click/Payme Karta raqami</label>
                    <input
                      type="text"
                      value={tempSettings.paymentCardNumber}
                      onChange={(e) => setTempSettings({ ...tempSettings, paymentCardNumber: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Karta egasi ismi</label>
                    <input
                      type="text"
                      value={tempSettings.paymentCardHolder}
                      onChange={(e) => setTempSettings({ ...tempSettings, paymentCardHolder: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Bank nomi</label>
                    <input
                      type="text"
                      value={tempSettings.paymentCardBank}
                      onChange={(e) => setTempSettings({ ...tempSettings, paymentCardBank: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Telegram Bot Settings (Prompt 5 requirement) */}
              <div className="bg-[#12141e] border border-blue-900/50 rounded-2xl p-5 space-y-4 shadow-lg shadow-blue-950/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                      <Send className="w-4 h-4 text-blue-400" />
                      <span>Telegram Bot Sozlamalari (Xabarnomalar tizimi)</span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Yangi buyurtmalar va AI qidiruv so‘rovlari ushbu Telegram bot orqali Admin chatiga real vaqtda yetib boradi.
                    </p>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold self-start sm:self-auto">
                    Ulangan
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1 font-semibold flex items-center justify-between">
                      <span>Telegram Bot Token:</span>
                      <span className="text-[10px] text-zinc-500 font-normal">BotFather bergan token</span>
                    </label>
                    <input
                      type="text"
                      value={tempSettings.telegramBotToken}
                      onChange={(e) => setTempSettings({ ...tempSettings, telegramBotToken: e.target.value })}
                      placeholder="9275377452:AAFe5jKxocDThflP-icoMWITCNeJyuSKWbw"
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-300 mb-1 font-semibold flex items-center justify-between">
                      <span>Admin Chat ID:</span>
                      <span className="text-[10px] text-zinc-500 font-normal">@userinfobot orqali ID</span>
                    </label>
                    <input
                      type="text"
                      value={tempSettings.telegramAdminChatId}
                      onChange={(e) => setTempSettings({ ...tempSettings, telegramAdminChatId: e.target.value })}
                      placeholder="6664036733"
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Bot Capabilities & Live Status */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-zinc-200 font-bold">Faol Bot:</span>
                      <a 
                        href="https://t.me/ravonavto_bot" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-400 hover:text-blue-300 font-mono font-bold hover:underline"
                      >
                        @ravonavto_bot ↗
                      </a>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/50 font-bold">
                      Mini App & AI Rasm Qidiruv Ulangan
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-zinc-400">
                    <div className="bg-black/40 p-2 rounded-lg border border-zinc-800/50">
                      <span className="text-blue-400 font-bold block">📸 AI Rasm Qidiruv:</span>
                      <span>Mijozlar rasm yuborganda Gemini 3.8 Flash zapchastni darhol aniqlaydi.</span>
                    </div>
                    <div className="bg-black/40 p-2 rounded-lg border border-zinc-800/50">
                      <span className="text-blue-400 font-bold block">🚀 Mini App Do'kon:</span>
                      <span>Telegram ichida to'liq interaktiv internet-do'kon ochiladi.</span>
                    </div>
                    <div className="bg-black/40 p-2 rounded-lg border border-zinc-800/50">
                      <span className="text-blue-400 font-bold block">🔔 Tezkor Xabarnomalar:</span>
                      <span>Barcha yangi buyurtmalar to'g'ridan-to'g'ri admin chatiga yetkaziladi.</span>
                    </div>
                  </div>
                </div>

                {/* Test button & status */}
                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs">
                    {telegramTestStatus && (
                      <div className={`p-2.5 rounded-xl text-xs font-medium border ${
                        telegramTestStatus.success 
                          ? 'bg-green-950/80 border-green-800 text-green-300' 
                          : 'bg-red-950/80 border-red-800 text-red-300'
                      }`}>
                        {telegramTestStatus.message}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href="https://t.me/ravonavto_bot"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center gap-1.5 transition border border-zinc-700"
                    >
                      <span>Botni ochish (@ravonavto_bot)</span>
                      <span>↗</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleSendTelegramTest}
                      disabled={isSendingTelegramTest}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-racing font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-950/40 transition disabled:opacity-50"
                    >
                      {isSendingTelegramTest ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Yuborilmoqda...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Test xabar yuborish</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Google Gemini AI Settings & Diagnostic Block (Prompt 6 requirement) */}
              <div className="bg-[#12141e] border border-amber-900/40 rounded-2xl p-5 space-y-4 shadow-lg shadow-amber-950/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Google Gemini AI (Vision & Zapchast tahlili) integratsiyasi</span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Rasm orqali zapchast qidirish va yangi mahsulotlarni avtomatik aniqlash uchun ishlatiladi.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-amber-400" />
                      Model: Gemini Flash (Auto-Fallback & Retry)
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-green-950 text-green-300 border border-green-800 text-[10px] font-bold">
                      Server Proxy Faol
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                    <div className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>Gemini API Kaliti Holati:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400">Joriy faol kalit:</span>
                      <code className="text-xs font-mono font-bold text-amber-300 bg-black/60 px-2 py-0.5 rounded border border-amber-900/50">
                        {activeGeminiMaskedKey || 'ENV orqali sozlangan'}
                      </code>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-700/50 font-bold">
                        Faol
                      </span>
                    </div>
                  </div>

                  {/* Input field to change/update API key */}
                  <div className="pt-1 space-y-2">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Yangi Gemini API Kalitini O'rnatish:
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={geminiApiKeyInput}
                        onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                        placeholder="Yangi Gemini API kalitini bu yerga kiriting..."
                        className="flex-1 bg-black/60 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleUpdateGeminiKey}
                        disabled={isUpdatingGeminiKey || !geminiApiKeyInput.trim()}
                        className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-40 shrink-0"
                      >
                        {isUpdatingGeminiKey ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Saqlanmoqda...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Kalitni Saqlash</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Yangi kalit kiritilganda u darhol serverda faollashadi va rasm orqali qidirish tizimida qo'llaniladi.
                    </p>
                  </div>
                </div>

                {/* Gemini Test button & status */}
                <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs flex-1">
                    {geminiTestStatus && (
                      <div className={`p-2.5 rounded-xl text-xs font-medium border ${
                        geminiTestStatus.success 
                          ? 'bg-green-950/80 border-green-800 text-green-300' 
                          : 'bg-red-950/80 border-red-800 text-red-300'
                      }`}>
                        {geminiTestStatus.message}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleTestGemini}
                    disabled={isTestingGemini}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-black font-racing font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-950/40 transition disabled:opacity-50 shrink-0"
                  >
                    {isTestingGemini ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>AI Tekshirilmoqda...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Ulanishini Tekshirish (Test)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold text-sm uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-red-900/50"
                >
                  <Save className="w-4 h-4" />
                  <span>Barcha Sozlamalarni Saqlash</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: AI ORQALI YANGI ZAPCHAST QO'SHISH */}
          {activeTab === 'ai-add' && (
            <div className="w-full space-y-6">
              <div className="border-b border-zinc-800 pb-3">
                <h3 className="text-lg font-racing font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-red-500 animate-pulse" />
                  <span>AI (Gemini 3.8 Flash) yordamida yangi zapchast qo‘shish</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Zapchast rasmini yuklang, "AI orqali avtomatik to‘ldirish" tugmasini bosing — Gemini model O‘zbekiston bozoridagi nomi, laqabi, mos mashinalar va tavsifini avtomatik to'ldiradi!
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Image Upload Box */}
                <div className="lg:col-span-5 space-y-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-750 hover:border-red-500 rounded-2xl p-4 min-h-[220px] flex flex-col items-center justify-center text-center cursor-pointer bg-zinc-950/60 transition group relative overflow-hidden"
                  >
                    {aiImage ? (
                      <div className="relative w-full h-[220px] flex items-center justify-center">
                        <img
                          src={aiImage}
                          alt="Yuklangan detal"
                          loading="lazy"
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAiImage('');
                          }}
                          className="absolute top-2 right-2 bg-black/80 text-zinc-300 hover:text-white px-2 py-1 rounded text-xs"
                        >
                          O‘chirish
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 mx-auto rounded-xl bg-red-950/50 border border-red-800/40 flex items-center justify-center text-red-500 group-hover:scale-110 transition">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-xs font-bold text-white">Rasm yuklash (Bosing)</div>
                        <div className="text-[10px] text-zinc-400">JPG, PNG, WEBP fayllar</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Yoki rasm URL havolasi:</label>
                    <input
                      type="url"
                      value={aiImage.startsWith('data:') ? '' : aiImage}
                      onChange={(e) => {
                        setAiImage(e.target.value);
                        setNewProduct(prev => ({ ...prev, image: e.target.value }));
                      }}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-200"
                    />
                  </div>

                  {aiError && (
                    <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs">
                      {aiError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAiAnalyze}
                    disabled={isAiAnalyzing || !aiImage}
                    className={`w-full py-3.5 rounded-xl font-racing font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition ${
                      isAiAnalyzing || !aiImage
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-600 via-red-500 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-900/50 glow-red active:scale-95'
                    }`}
                  >
                    {isAiAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-red-400" />
                        <span>AI tahlil qilmoqda...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>AI orqali avtomatik to‘ldirish</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Form fields */}
                <form onSubmit={handleSaveNewProduct} className="lg:col-span-7 bg-[#12141e] border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-300 font-semibold mb-1">Rasmiy Nomi *</label>
                      <input
                        type="text"
                        required
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        placeholder="Masalan: Gentra Optra Stop Fara"
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-300 font-semibold mb-1">Bozordagi laqabi (Slang) *</label>
                      <input
                        type="text"
                        required
                        value={newProduct.bazaarName}
                        onChange={(e) => setNewProduct({ ...newProduct, bazaarName: e.target.value })}
                        placeholder="Masalan: Optra stop"
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-red-400 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-300 font-semibold mb-1">
                        Artikul / Katalog raqami (ixtiyoriy)
                      </label>
                      <input
                        type="text"
                        value={newProduct.sku || ''}
                        onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                        placeholder="Masalan: 96550234 yoki GM-01"
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-300 font-semibold mb-1">Brend / Ishlab chiqaruvchi</label>
                      <select
                        value={newProduct.brand || 'GM Genuine (Original)'}
                        onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-amber-300 font-semibold"
                      >
                        {brands.filter(b => b !== 'Hammasi').map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-300 font-semibold mb-1">Kategoriya</label>
                      <select
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-200"
                      >
                        {categories.filter(c => c !== 'Hammasi').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-300 font-semibold mb-1">Sotuv narxi (so‘m) *</label>
                      <input
                        type="number"
                        required
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white font-racing font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-300 font-semibold mb-1">Eski narx (chizilgan)</label>
                      <input
                        type="number"
                        value={newProduct.originalPrice || ''}
                        onChange={(e) => setNewProduct({ ...newProduct, originalPrice: Number(e.target.value) })}
                        placeholder="Ixtiyoriy"
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-400"
                      />
                    </div>
                  </div>

                  {/* Compatible cars checkboxes */}
                  <div>
                    <label className="block text-xs text-zinc-300 font-semibold mb-1.5">
                      Mos keladigan avtomobillar (bir nechtasini tanlash mumkin):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {carModels.filter(m => m !== 'Hammasi').map(car => {
                        const isSelected = newProduct.carModels?.includes(car);
                        return (
                          <button
                            type="button"
                            key={car}
                            onClick={() => {
                              const current = newProduct.carModels || [];
                              const updated = isSelected 
                                ? current.filter(c => c !== car) 
                                : [...current, car];
                              setNewProduct({ ...newProduct, carModels: updated });
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                              isSelected
                                ? 'bg-red-600 text-white border-red-500'
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            {car}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-300 font-semibold mb-1">Ombordagi holati</label>
                      <select
                        value={newProduct.inStock && (newProduct.stock ?? 10) > 0 ? 'true' : 'false'}
                        onChange={(e) => {
                          const isAvail = e.target.value === 'true';
                          setNewProduct({
                            ...newProduct,
                            inStock: isAvail,
                            stock: isAvail ? ((newProduct.stock ?? 0) > 0 ? newProduct.stock : 10) : 0,
                          });
                        }}
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-200"
                      >
                        <option value="true">Sotuvda bor (Omborda mavjud)</option>
                        <option value="false">Tugagan (Omborda yo'q)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-300 font-semibold mb-1">
                        Ombordagi soni (dona) *
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={newProduct.stock ?? 10}
                        onChange={(e) => {
                          const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                          setNewProduct({
                            ...newProduct,
                            stock: val,
                            inStock: val > 0,
                          });
                        }}
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-emerald-400 font-racing font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-300 font-semibold mb-1">Nishon (Badge)</label>
                      <select
                        value={newProduct.badge || ''}
                        onChange={(e) => setNewProduct({ ...newProduct, badge: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-200"
                      >
                        <option value="">Nishonsiz</option>
                        <option value="YANGILIK">YANGILIK</option>
                        <option value="XIT TYUNING">XIT TYUNING</option>
                        <option value="TOP XARID">TOP XARID</option>
                        <option value="CHEGIRMA">CHEGIRMA</option>
                        <option value="SUPER YORUG‘LIK">SUPER YORUG‘LIK</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-300 font-semibold mb-1">Tavsif va Usta maslahati</label>
                    <textarea
                      rows={3}
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      placeholder="Detalning vazifasi va o'rnatish haqida..."
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-100"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-red-900/50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Mahsulotni Do‘konga Qo‘shish</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: MAHSULOTLAR VA KATEGORIYALAR BOSHQARUVI */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              
              {/* Car Models, Categories & Brands Management sub-section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Car Models Management */}
                <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Car className="w-4 h-4 text-red-500" />
                      <span>Mashina Modellari ({carModels.length - 1} ta)</span>
                    </h4>
                  </div>

                  {!isManager && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCarModelName}
                        onChange={(e) => setNewCarModelName(e.target.value)}
                        placeholder="Yangi model (masalan: Captiva)..."
                        className="flex-1 bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddCarModel}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Qo‘shish
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {carModels.map(model => (
                      <span 
                        key={model} 
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5"
                      >
                        {model}
                        {!isManager && model !== 'Hammasi' && (
                          <button 
                            type="button"
                            onClick={() => handleDeleteCarModel(model)}
                            className="text-zinc-500 hover:text-red-400 text-[10px]"
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Categories Management */}
                <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-red-500" />
                      <span>Kategoriyalar ({categories.length - 1} ta)</span>
                    </h4>
                  </div>

                  {!isManager && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Yangi kategoriya (masalan: Moylar)..."
                        className="flex-1 bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddCategory}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Qo‘shish
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {categories.map(cat => (
                      <span 
                        key={cat} 
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5"
                      >
                        {cat}
                        {!isManager && cat !== 'Hammasi' && (
                          <button 
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            className="text-zinc-500 hover:text-red-400 text-[10px]"
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Brands / Manufacturers Management */}
                <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Brendlar / Ishlab chiqaruvchilar ({Math.max(0, brands.length - 1)} ta)</span>
                    </h4>
                  </div>

                  {!isManager && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newBrandName}
                        onChange={(e) => setNewBrandName(e.target.value)}
                        placeholder="Yangi brend (masalan: Bosch)..."
                        className="flex-1 bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddBrand}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Qo‘shish
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {brands.map(brand => (
                      <span 
                        key={brand} 
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-amber-300/90 flex items-center gap-1.5"
                      >
                        {brand}
                        {!isManager && brand !== 'Hammasi' && (
                          <button 
                            type="button"
                            onClick={() => handleDeleteBrand(brand)}
                            className="text-zinc-500 hover:text-red-400 text-[10px]"
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Products List, Bulk CSV/Excel Import/Export & Search */}
              <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4">
                {cloudUploadWarning && (
                  <div className="p-3.5 rounded-xl bg-red-950/90 border border-red-600/80 text-red-100 text-xs flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-bold text-red-300">
                        ⚠️ Cloud Baza ogohlantirishi (IndexedDB zaxira xotirasi faol):
                      </p>
                      <p>{cloudUploadWarning}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCloudUploadWarning(null)}
                      className="text-red-300 hover:text-white px-2 py-1 rounded bg-red-900/60 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-racing text-base font-bold text-white">
                      Mavjud Zapchastlar Ro‘yxati ({products.length} ta)
                    </h3>
                    <p className="text-xs text-zinc-400">
                      7 000+ tovarni CSV/Excel orqali ommaviy yuklash, narx va ombor qoldig‘ini boshqarish
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Hidden Excel (.xlsx / .xls) & CSV File Input */}
                    <input
                      type="file"
                      ref={csvFileInputRef}
                      onChange={handleCsvFileUpload}
                      accept=".xlsx,.xls,.csv,.tsv,.txt"
                      className="hidden"
                    />

                    {/* Excel / CSV Bulk Import Button (Opens Column Mapping & Preview Modal) */}
                    <button
                      type="button"
                      onClick={() => csvFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition cursor-pointer active:scale-95"
                      title="Haqiqiy Excel (.xlsx / .xls) yoki CSV faylni ustunlarni tanlab va oldin ko'rib (Preview) yuklash"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel / CSV yuklash (.xlsx / .xls)</span>
                    </button>

                    {/* Undo Button ("↩️ Orqaga qaytarish (Ctrl+Z)") */}
                    <button
                      type="button"
                      disabled={undoStackSize === 0}
                      onClick={handleUndoProducts}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer active:scale-95 ${
                        undoStackSize > 0
                          ? 'bg-amber-500 hover:bg-amber-400 text-black border-amber-400 shadow-lg shadow-amber-950/50'
                          : 'bg-zinc-900/60 text-zinc-500 border-zinc-800 cursor-not-allowed opacity-60'
                      }`}
                      title={
                        undoHistoryRef.current.length > 0
                          ? `Oxirgi amalni bekor qilish (${undoHistoryRef.current[0].label} — ${undoHistoryRef.current[0].products.length} ta tovarni qaytarish) [Ctrl+Z]`
                          : 'Orqaga qaytarish uchun saqlangan amal yo‘q (Ctrl+Z)'
                      }
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>
                        ↩️ Orqaga qaytarish{' '}
                        {undoHistoryRef.current.length > 0
                          ? `(${undoHistoryRef.current[0].products.length} ta • Ctrl+Z)`
                          : '(Ctrl+Z)'}
                      </span>
                    </button>

                    {/* 1-Click Delete All Button ("🗑️ Barchasini o'chirish (Delete All)") */}
                    {!isManager && (
                      <button
                        type="button"
                        disabled={products.length === 0}
                        onClick={handleDeleteAllProducts}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer active:scale-95 ${
                          products.length > 0
                            ? 'bg-red-950/90 hover:bg-red-600 text-red-200 hover:text-white border-red-600/70 shadow-md shadow-red-950/50'
                            : 'bg-zinc-900/60 text-zinc-600 border-zinc-800 cursor-not-allowed opacity-50'
                        }`}
                        title="Barcha mahsulotlarni 1 klikda tozalash (Ctrl+Z orqali istalgan payt qaytarish mumkin)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>🗑️ Barchasini o‘chirish ({products.length})</span>
                      </button>
                    )}

                    {/* Export Catalog to CSV Button */}
                    <button
                      type="button"
                      onClick={() => {
                        exportProductsToCsv(products);
                        showToast(`Barcha ${products.length} ta mahsulot CSV jadval ko‘rinishida yuklab olindi!`);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      title="Barcha mahsulotlarni Excel uchun CSV formatida yuklab olish"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>Export CSV</span>
                    </button>

                    {/* Sample Excel (.xlsx) Template Download */}
                    <button
                      type="button"
                      onClick={() => {
                        downloadSampleCsvTemplate();
                        showToast("Excel (.xlsx) namuna shablon yuklab olindi!");
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Excelda to'ldirish uchun tayyor .xlsx namuna jadvalni yuklab olish"
                    >
                      <span>Namuna .xlsx</span>
                    </button>

                    {/* Hidden Quick Row Image Input (File / Gallery) */}
                    <input
                      type="file"
                      ref={quickImageInputRef}
                      onChange={handleQuickImageInputChange}
                      accept="image/*"
                      className="hidden"
                    />

                    {/* Hidden Quick Row Camera Input (Direct Mobile Camera Capture) */}
                    <input
                      type="file"
                      ref={quickCameraInputRef}
                      onChange={handleQuickImageInputChange}
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                    />

                    <div className="relative">
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Qidiruv (nomi, артикул, жентра)..."
                        className="bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-1.5 pl-8 text-base sm:text-xs text-white"
                      />
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>

                    {/* "Rasmsiz mahsulotlar" Filter Toggle Button with Count */}
                    <button
                      type="button"
                      onClick={() => {
                        setOnlyMissingImages((prev) => !prev);
                        setAdminCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                        onlyMissingImages
                          ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-950/60'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
                      }`}
                      title="Faqat rasmi joylanmagan (Exceldan kiritilgan) mahsulotlarni ajratib ko'rsatish"
                    >
                      <Camera className={`w-3.5 h-3.5 ${onlyMissingImages ? 'text-white' : 'text-red-400'}`} />
                      <span>Faqat rasmsizlar</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md font-racing text-[10px] font-bold ${
                          onlyMissingImages
                            ? 'bg-black/40 text-white'
                            : missingImagesCount > 0
                            ? 'bg-red-600 text-white'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {missingImagesCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveTab('ai-add')}
                      className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Yangi qo‘shish</span>
                    </button>
                  </div>
                </div>

                {/* Quick Image Upload / Drag & Drop / Ctrl+V Helper Banner */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-red-950/35 via-zinc-900/90 to-zinc-900/80 border border-red-900/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-red-600/20 border border-red-500/40 text-red-300 font-racing font-bold uppercase tracking-wider">
                      ⚡ Tezkor Rasm Joylash Tizimi
                    </span>
                    <span>
                      <strong>1)</strong> Ro‘yxatdan <strong className="text-white">"📷 Rasm joylash"</strong> tugmasini bosing (yoki telefonda kameraga oling) •{' '}
                      <strong>2) Drag & Drop:</strong> Rasm faylini istalgan qator ustiga sichqoncha bilan tortib tashlang •{' '}
                      <strong>3) Ctrl+V:</strong> Qatorni tanlab <kbd className="px-1.5 py-0.5 rounded bg-black border border-zinc-700 text-amber-300 font-mono text-[10px]">Ctrl+V</kbd> bosing!
                    </span>
                  </div>
                  {onlyMissingImages && (
                    <span className="text-red-400 font-bold">
                      Rasm kutayotgan tovarlar: {missingImagesCount} ta
                    </span>
                  )}
                </div>

                {/* Products Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                      <tr>
                        <th className="p-3 min-w-[195px]">Tezkor Rasm Joylash</th>
                        <th className="p-3">Nomi, Bozor Laqabi & Artikul</th>
                        <th className="p-3">Brend</th>
                        <th className="p-3">Kategoriya</th>
                        <th className="p-3">Mos modellar</th>
                        <th className="p-3">Narxi</th>
                        <th className="p-3">Holati</th>
                        <th className="p-3 text-right">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {visibleAdminProductList.map(prod => {
                        const hasPhoto = hasRealProductImage(prod.image);
                        const isDraggingHere = dragOverProductId === prod.id;
                        const isPasteActive = activePasteProductId === prod.id;
                        const isUploadingThis = uploadingProductId === prod.id;

                        return (
                          <tr
                            key={prod.id}
                            tabIndex={0}
                            onMouseEnter={() => setActivePasteProductId(prod.id)}
                            onClick={() => setActivePasteProductId(prod.id)}
                            onFocus={() => setActivePasteProductId(prod.id)}
                            onPaste={(e) => handleRowPaste(e, prod.id)}
                            onDragOver={(e) => handleRowDragOver(e, prod.id)}
                            onDragLeave={() =>
                              setDragOverProductId((prev) => (prev === prod.id ? null : prev))
                            }
                            onDrop={(e) => handleRowDrop(e, prod.id)}
                            className={`transition focus:outline-none ${
                              isDraggingHere
                                ? 'bg-red-950/60 ring-2 ring-red-500'
                                : isPasteActive
                                ? 'bg-zinc-900/70'
                                : 'hover:bg-zinc-900/40'
                            }`}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                {/* Thumbnail or Branded Placeholder */}
                                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-zinc-700 bg-black">
                                  {hasPhoto ? (
                                    <img
                                      src={prod.image}
                                      alt={prod.name}
                                      loading="lazy"
                                      decoding="async"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <ProductImagePlaceholder
                                      name={prod.name}
                                      category={prod.category}
                                      variant="thumb"
                                      className="w-full h-full"
                                    />
                                  )}
                                  {isUploadingThis && (
                                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                                      <RefreshCw className="w-4 h-4 text-red-400 animate-spin" />
                                    </div>
                                  )}
                                </div>

                                {/* Quick Upload / Replace Action Buttons */}
                                <div className="flex flex-col items-start gap-1">
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={isUploadingThis}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerQuickFileSelect(prod.id, false);
                                      }}
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 ${
                                        hasPhoto
                                          ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700'
                                          : 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-950/60'
                                      }`}
                                      title="Fayldan yoki galereyadan rasm tanlash (avtomatik 600px JPEG 0.7 siqiladi)"
                                    >
                                      <span>{hasPhoto ? '🔄 Almashtirish' : '📷 Rasm joylash'}</span>
                                    </button>

                                    {/* Direct Mobile Camera Capture Button */}
                                    <button
                                      type="button"
                                      disabled={isUploadingThis}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerQuickFileSelect(prod.id, true);
                                      }}
                                      className="sm:hidden p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 active:scale-95"
                                      title="Telefondan to'g'ridan-to'g'ri kamera orqali rasmga olish"
                                    >
                                      <Camera className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <span className="text-[9px] text-zinc-500 leading-tight">
                                    {isDraggingHere ? (
                                      <strong className="text-red-400">📥 Rasmni shu yerga tashlang!</strong>
                                    ) : isPasteActive ? (
                                      <span className="text-amber-400/90 font-medium">
                                        Tortib tashlang yoki Ctrl+V bosing
                                      </span>
                                    ) : (
                                      'Drag & Drop yoki Ctrl+V'
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>
                          <td className="p-3 min-w-[200px] max-w-[420px]">
                            <div className="font-bold text-white">{prod.name}</div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-red-400 font-bold">"{prod.bazaarName}"</span>
                              {prod.sku && (
                                <span className="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-zinc-300">
                                  OEM: {prod.sku}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 text-[10px] font-semibold text-amber-300">
                              {prod.brand || 'GM Genuine (Original)'}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-300">{prod.category}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1 max-w-[260px]">
                              {prod.carModels.slice(0, 2).map(c => (
                                <span key={c} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300">
                                  {c}
                                </span>
                              ))}
                              {prod.carModels.length > 2 && (
                                <span className="text-[10px] text-zinc-500">+{prod.carModels.length - 2}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-racing font-bold text-red-400">
                            {formatUzbekSum(prod.price)}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col items-start gap-1">
                              <button
                                onClick={() => handleToggleStock(prod.id)}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition ${
                                  prod.inStock && (prod.stock ?? 10) > 0
                                    ? 'bg-green-950 text-green-400 border border-green-800'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                }`}
                              >
                                {prod.inStock && (prod.stock ?? 10) > 0 ? 'Sotuvda bor' : "Tugagan (Omborda yo'q)"}
                              </button>
                              <span
                                className={`text-[11px] font-semibold ${
                                  prod.inStock && (prod.stock ?? 10) > 0
                                    ? 'text-emerald-400'
                                    : 'text-red-400'
                                }`}
                              >
                                Omborda: {prod.inStock ? (prod.stock ?? 10) : 0} dona
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-right space-x-1.5">
                            <button
                              onClick={() => setEditingProduct(prod)}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
                              title="Tahrirlash"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {!isManager && (
                              <button
                                onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-800/60"
                                title="O‘chirish"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                          </tr>
                        );
                      })}
                      {visibleAdminProductList.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-zinc-400">
                            {onlyMissingImages ? (
                              <div className="space-y-1">
                                <div className="text-emerald-400 font-bold text-sm">
                                  ✅ Barcha zapchastlarga rasm joylangan!
                                </div>
                                <div className="text-xs text-zinc-500">
                                  Rasm kutayotgan (rasmsiz) mahsulotlar qolmadi.
                                </div>
                              </div>
                            ) : (
                              <span>Qidiruv bo‘yicha mahsulot topilmadi.</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Requirement 1: Admin Products Strict 50-item Pagination ("Oldingi / Keyingi sahifa (1 of 89)") */}
                {filteredProductList.length > 0 && (
                  <div className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-zinc-400">
                      Ko‘rsatilmoqda:{' '}
                      <strong className="text-white font-mono">
                        {adminPageStartIndex + 1}–
                        {Math.min(
                          adminPageStartIndex + ADMIN_PRODUCTS_PAGE_SIZE,
                          filteredProductList.length
                        )}
                      </strong>{' '}
                      / Jami <strong className="text-red-400 font-mono">{filteredProductList.length}</strong> ta mahsulot
                      <span className="ml-2 text-zinc-500">(har sahifada 50 tadan)</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        disabled={safeAdminPage <= 1}
                        onClick={() => setAdminCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-zinc-900 text-zinc-100 hover:text-white border border-zinc-700 font-racing text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        ⬅️ Oldingi sahifa
                      </button>

                      <div className="px-3.5 py-2 rounded-xl bg-black/80 border border-zinc-700 text-xs font-mono font-bold text-white">
                        Sahifa: <span className="text-red-400">{safeAdminPage}</span> of{' '}
                        <span className="text-emerald-400">{totalAdminPages}</span>
                      </div>

                      <button
                        type="button"
                        disabled={safeAdminPage >= totalAdminPages}
                        onClick={() =>
                          setAdminCurrentPage((p) => Math.min(totalAdminPages, p + 1))
                        }
                        className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-zinc-900 text-zinc-100 hover:text-white border border-zinc-700 font-racing text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        Keyingi sahifa ➡️
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Edit Modal if editingProduct is open */}
              {editingProduct && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                  <div className="w-full max-w-lg bg-[#10121a] border border-zinc-700 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                      <h4 className="font-racing text-base font-bold text-white">
                        Mahsulotni Tahrirlash
                      </h4>
                      <button 
                        onClick={() => setEditingProduct(null)}
                        className="text-zinc-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleSaveProductEdit} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-zinc-300 mb-1">Mahsulot Nomi</label>
                        <input
                          type="text"
                          required
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-zinc-300 mb-1">Bozordagi Laqabi</label>
                          <input
                            type="text"
                            required
                            value={editingProduct.bazaarName}
                            onChange={(e) => setEditingProduct({ ...editingProduct, bazaarName: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-red-400 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-300 mb-1">Artikul / Katalog raqami</label>
                          <input
                            type="text"
                            value={editingProduct.sku || ''}
                            onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                            placeholder="Ixtiyoriy (OEM)"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-300 mb-1">Narxi (so‘m)</label>
                          <input
                            type="number"
                            required
                            value={editingProduct.price}
                            onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white font-racing"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-zinc-300 mb-1">Brend / Ishlab chiqaruvchi</label>
                          <select
                            value={editingProduct.brand || 'GM Genuine (Original)'}
                            onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-amber-300 font-semibold"
                          >
                            {brands.filter(b => b !== 'Hammasi').map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-zinc-300 mb-1">Kategoriya</label>
                          <select
                            value={editingProduct.category}
                            onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                          >
                            {categories.filter(c => c !== 'Hammasi').map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-zinc-300 mb-1">Ombordagi holati</label>
                          <select
                            value={editingProduct.inStock && (editingProduct.stock ?? 10) > 0 ? 'true' : 'false'}
                            onChange={(e) => {
                              const isAvail = e.target.value === 'true';
                              setEditingProduct({
                                ...editingProduct,
                                inStock: isAvail,
                                stock: isAvail
                                  ? (editingProduct.stock ?? 0) > 0
                                    ? editingProduct.stock
                                    : 10
                                  : 0,
                              });
                            }}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                          >
                            <option value="true">Sotuvda bor (Omborda mavjud)</option>
                            <option value="false">Tugagan (Omborda yo'q)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-zinc-300 mb-1">Ombordagi soni (dona) *</label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={editingProduct.inStock === false ? 0 : (editingProduct.stock ?? 10)}
                            onChange={(e) => {
                              const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                              setEditingProduct({
                                ...editingProduct,
                                stock: val,
                                inStock: val > 0,
                              });
                            }}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-emerald-400 font-racing font-bold"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-zinc-300 mb-1">Rasm (URL yoki yangi rasm yuklash — 600px/0.7 avtomatik siqiladi)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingProduct.image}
                            onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono text-[11px]"
                          />
                          <input
                            type="file"
                            ref={editFileInputRef}
                            onChange={handleEditImageFileUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => editFileInputRef.current?.click()}
                            className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1.5 shrink-0"
                          >
                            <Upload className="w-3.5 h-3.5 text-red-400" />
                            <span>Yuklash</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-zinc-300 mb-1">Tavsif</label>
                        <textarea
                          rows={3}
                          value={editingProduct.description}
                          onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-3">
                        <button
                          type="button"
                          onClick={() => setEditingProduct(null)}
                          className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        >
                          Bekor qilish
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
                        >
                          Saqlash
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Interactive Excel (.xlsx / .xls / .csv) Column Mapping & Live Preview Modal */}
              {excelPreviewModal && liveExcelPreviewResult && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-5xl max-h-[94vh] bg-[#0e1018] border border-emerald-600/60 rounded-3xl flex flex-col overflow-hidden shadow-2xl"
                  >
                    {/* Modal Header */}
                    <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950/90 via-zinc-950 to-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-racing text-sm sm:text-lg font-bold text-white truncate">
                            Ustunlarni Tekshirish va Oldin Ko‘rish (Excel Preview)
                          </h4>
                          <p className="text-xs text-zinc-400 truncate">
                            Fayl: <strong className="text-emerald-300">{excelPreviewModal.fileName}</strong> • Jami qatorlar:{' '}
                            <strong className="text-white">{liveExcelPreviewResult.totalRowsCount} ta</strong> (Preview uchun faqat dastlabki 5 tasi hisoblandi)
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={Boolean(bulkUploadProgress)}
                        onClick={() => setExcelPreviewModal(null)}
                        className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-red-600 disabled:opacity-40 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center transition cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Modal Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
                      {/* Sheet selector (if multi-sheet workbook) + Header row toggle + Import Mode */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                            Excel Varaq (Sheet)
                          </label>
                          <select
                            value={excelPreviewModal.activeSheetIndex}
                            onChange={(e) => {
                              const idx = Number(e.target.value);
                              const sheet = excelPreviewModal.sheets[idx];
                              if (!sheet) return;
                              const detected = detectInitialColumnMapping(sheet.rows);
                              setExcelPreviewModal({
                                ...excelPreviewModal,
                                activeSheetIndex: idx,
                                hasHeader: detected.hasHeader,
                                headers: detected.headers,
                                mapping: detected.mapping,
                                stockColumnDetected: detected.stockColumnDetected,
                              });
                            }}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-semibold"
                          >
                            {excelPreviewModal.sheets.map((s, idx) => (
                              <option key={s.sheetName} value={idx}>
                                {s.sheetName} ({s.rows.length} qator)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col justify-center">
                          <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-200 font-semibold">
                            <input
                              type="checkbox"
                              checked={excelPreviewModal.hasHeader}
                              onChange={(e) =>
                                setExcelPreviewModal({
                                  ...excelPreviewModal,
                                  hasHeader: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded accent-emerald-500"
                            />
                            <span>1-qator — ustun sarlavhalari (Header)</span>
                          </label>
                          <span className="text-[11px] text-zinc-500 mt-1">
                            Agar 1-qatorda ham mahsulot yozilgan bo‘lsa, belgini olib tashlang
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                            Yuklash usuli
                          </label>
                          <select
                            value={excelPreviewModal.importMode}
                            onChange={(e) =>
                              setExcelPreviewModal({
                                ...excelPreviewModal,
                                importMode: e.target.value as 'append' | 'replace',
                              })
                            }
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-amber-300 font-semibold"
                          >
                            <option value="append">
                              ➕ Mavjud tovarlar ustiga qo‘shish (+{liveExcelPreviewResult.totalRowsCount} ta)
                            </option>
                            <option value="replace">
                              🔄 Eski ro‘yxatni tozalab, faqat shu Excelni yuklash ({liveExcelPreviewResult.totalRowsCount} ta)
                            </option>
                          </select>
                        </div>
                      </div>

                      {/* Primary Column Mapping Dropdowns (Name, Price, Stock) */}
                      <div className="bg-[#131722] border border-emerald-500/40 rounded-2xl p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="font-racing text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>1-Qadam: Asosiy ustunlarni tanlang va tasdiqlang</span>
                          </h5>
                          <span className="text-[11px] text-zinc-400">
                            Exceldagi qaysi ustun Nomi, Narxi va Soni ekanligini tekshiring
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          {/* 1. Mahsulot Nomi */}
                          <div>
                            <label className="block text-xs font-bold text-white mb-1">
                              Mahsulot nomi ustuni <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={excelPreviewModal.mapping.name}
                              onChange={(e) =>
                                setExcelPreviewModal({
                                  ...excelPreviewModal,
                                  mapping: {
                                    ...excelPreviewModal.mapping,
                                    name: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full bg-zinc-950 border border-emerald-500/70 rounded-xl px-3 py-2.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value={-1}>— Ustunni tanlang —</option>
                              {excelPreviewModal.headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 2. Narxi */}
                          <div>
                            <label className="block text-xs font-bold text-white mb-1">
                              Narxi (so‘m) ustuni <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={excelPreviewModal.mapping.price}
                              onChange={(e) =>
                                setExcelPreviewModal({
                                  ...excelPreviewModal,
                                  mapping: {
                                    ...excelPreviewModal.mapping,
                                    price: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full bg-zinc-950 border border-emerald-500/70 rounded-xl px-3 py-2.5 text-red-400 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value={-1}>— Ustunni tanlang —</option>
                              {excelPreviewModal.headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 3. Ombordagi Soni (Dona / Qoldiq) */}
                          <div>
                            <label className="block text-xs font-bold text-white mb-1">
                              Ombordagi soni (Dona / Qoldiq) <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={excelPreviewModal.mapping.stock}
                              onChange={(e) => {
                                const nextStockCol = Number(e.target.value);
                                setExcelPreviewModal({
                                  ...excelPreviewModal,
                                  stockColumnDetected: nextStockCol >= 0,
                                  mapping: {
                                    ...excelPreviewModal.mapping,
                                    stock: nextStockCol,
                                  },
                                });
                              }}
                              className={`w-full bg-zinc-950 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-2 ${
                                excelPreviewModal.mapping.stock >= 0
                                  ? 'border border-emerald-500/70 text-emerald-400 focus:ring-emerald-500'
                                  : 'border-2 border-amber-500 text-amber-300 focus:ring-amber-500'
                              }`}
                            >
                              <option value={-1}>— Excelda "Soni" ustuni yo‘q —</option>
                              {excelPreviewModal.headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Missing Stock Column Prompt OR Exact Stock Confirmation Banner */}
                        {excelPreviewModal.mapping.stock === -1 ? (
                          <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>
                                  Soni ustuni topilmadi, standart nechta dona qo‘yilsin?
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-300">
                                Agar Excel jadvalingizda qoldiq (dona) ustuni bo‘lsa, yuqoridagi ro‘yxatdan tanlang. Aks holda barcha tovarlar uchun standart sonni kiriting:
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <input
                                type="number"
                                min={0}
                                value={excelPreviewModal.defaultStockWhenMissing}
                                onChange={(e) =>
                                  setExcelPreviewModal({
                                    ...excelPreviewModal,
                                    defaultStockWhenMissing: Math.max(
                                      0,
                                      Math.floor(Number(e.target.value) || 0)
                                    ),
                                  })
                                }
                                className="w-24 bg-zinc-950 border border-amber-400 rounded-xl px-3 py-2 text-center font-racing font-bold text-sm text-amber-300"
                              />
                              <span className="text-xs font-bold text-zinc-300">dona</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-700/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-300">
                            <span>
                              ✅ <strong>Soni ustuni faol:</strong> "25 dona", "1 500 шт" kabi yozuvlardan aniq butun son ajratib olinadi. Agar <strong>0</strong> yoki manfiy bo‘lsa, aynan <strong>0 dona — Tugagan (Omborda yo‘q)</strong> deb kiritiladi!
                            </span>
                            <span className="font-bold text-white">
                              Jami qatorlar: <span className="text-emerald-400">{liveExcelPreviewResult.totalRowsCount} ta</span>
                            </span>
                          </div>
                        )}

                        {/* Optional Columns Mapping (SKU, Category, Car Models, Brand, Bazaar Name) */}
                        <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                              Artikul / OEM kodi
                            </label>
                            <select
                              value={excelPreviewModal.mapping.sku}
                              onChange={(e) =>
                                setExcelPreviewModal({
                                  ...excelPreviewModal,
                                  mapping: {
                                    ...excelPreviewModal.mapping,
                                    sku: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200"
                            >
                              <option value={-1}>— Yo‘q —</option>
                              {excelPreviewModal.headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                              Kategoriya
                            </label>
                            <select
                              value={excelPreviewModal.mapping.category}
                              onChange={(e) =>
                                setExcelPreviewModal({
                                  ...excelPreviewModal,
                                  mapping: {
                                    ...excelPreviewModal.mapping,
                                    category: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200"
                            >
                              <option value={-1}>— Yo‘q (Standart) —</option>
                              {excelPreviewModal.headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                              Avtomobil modeli
                            </label>
                            <select
                              value={excelPreviewModal.mapping.carModels}
                              onChange={(e) =>
                                setExcelPreviewModal({
                                  ...excelPreviewModal,
                                  mapping: {
                                    ...excelPreviewModal.mapping,
                                    carModels: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200"
                            >
                              <option value={-1}>— Yo‘q (Standart) —</option>
                              {excelPreviewModal.headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                              Brend / Firma
                            </label>
                            <select
                              value={excelPreviewModal.mapping.brand}
                              onChange={(e) =>
                                setExcelPreviewModal({
                                  ...excelPreviewModal,
                                  mapping: {
                                    ...excelPreviewModal.mapping,
                                    brand: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200"
                            >
                              <option value={-1}>— Yo‘q (Standart) —</option>
                              {excelPreviewModal.headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                              Bozordagi laqabi
                            </label>
                            <select
                              value={excelPreviewModal.mapping.bazaarName}
                              onChange={(e) =>
                                setExcelPreviewModal({
                                  ...excelPreviewModal,
                                  mapping: {
                                    ...excelPreviewModal.mapping,
                                    bazaarName: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200"
                            >
                              <option value={-1}>— Nomi bilan bir xil —</option>
                              {excelPreviewModal.headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Live Preview of First 5 Products */}
                      <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="font-racing text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                            2-Qadam: Dastlabki 5 ta tovarni tekshiring (Preview)
                          </h5>
                          <span className="text-[11px] text-zinc-400">
                            Jami <strong className="text-white">{liveExcelPreviewResult.totalRowsCount} ta</strong> qatordan dastlabki 5 tasi
                          </span>
                        </div>

                        <div className="overflow-x-auto border border-zinc-800 rounded-xl">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-900 text-zinc-400 uppercase text-[10px] border-b border-zinc-800">
                              <tr>
                                <th className="p-2.5">#</th>
                                <th className="p-2.5">Artikul</th>
                                <th className="p-2.5">Mahsulot nomi</th>
                                <th className="p-2.5">Kategoriya / Model</th>
                                <th className="p-2.5">Narxi (so‘m)</th>
                                <th className="p-2.5">Ombordagi soni</th>
                                <th className="p-2.5">Holati</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/80">
                              {liveExcelPreviewResult.previewProducts.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-zinc-900/50">
                                  <td className="p-2.5 text-zinc-500 font-mono">{idx + 1}</td>
                                  <td className="p-2.5 font-mono text-amber-300">
                                    {item.sku || '—'}
                                  </td>
                                  <td className="p-2.5 font-bold text-white max-w-xs truncate">
                                    {item.name}
                                  </td>
                                  <td className="p-2.5 text-zinc-300">
                                    {item.category} • {item.carModels.join(', ')}
                                  </td>
                                  <td className="p-2.5 font-racing font-bold text-red-400">
                                    {formatUzbekSum(item.price)}
                                  </td>
                                  <td className="p-2.5 font-racing font-bold">
                                    <span
                                      className={
                                        (item.stock ?? 0) > 0
                                          ? 'text-emerald-400'
                                          : 'text-red-400'
                                      }
                                    >
                                      {item.stock ?? 0} dona
                                    </span>
                                  </td>
                                  <td className="p-2.5">
                                    {item.inStock && (item.stock ?? 0) > 0 ? (
                                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                                        Sotuvda bor
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold">
                                        Tugagan (Omborda yo‘q)
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {liveExcelPreviewResult.previewProducts.length === 0 && (
                                <tr>
                                  <td colSpan={7} className="p-6 text-center text-zinc-400">
                                    Tanlangan ustunlar bo‘yicha mahsulot topilmadi. Yuqoridagi ustunlarni tekshiring.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Requirement 3: Live Progress Bar during Non-Blocking Chunked Upload */}
                      {bulkUploadProgress && (
                        <div className="p-4 rounded-2xl bg-emerald-950/50 border-2 border-emerald-500/80 space-y-2.5 animate-pulse">
                          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-racing font-bold text-white">
                            <span className="flex items-center gap-2">
                              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                              <span>{bulkUploadProgress.phaseText}</span>
                            </span>
                            <span className="text-emerald-300 font-mono">
                              {bulkUploadProgress.percent}%
                            </span>
                          </div>
                          <div className="w-full h-3.5 rounded-full bg-black/80 border border-emerald-700/60 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 transition-all duration-150"
                              style={{ width: `${Math.max(4, bulkUploadProgress.percent)}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-zinc-300">
                            500 tadan bo‘lib (chunk) Firebase bazaga qotmasdan yuborilmoqda. Iltimos, oynani yopmang...
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 sm:p-5 bg-zinc-950 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                      <div className="text-xs text-zinc-400">
                        Yuklashdan oldin mavjud holat xotirada (<code className="text-amber-300">useRef</code>) saqlanadi (<strong className="text-amber-300">Ctrl + Z</strong> orqali qaytarish mumkin).
                      </div>
                      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          disabled={Boolean(bulkUploadProgress)}
                          onClick={() => setExcelPreviewModal(null)}
                          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 border border-zinc-700 text-xs font-bold cursor-pointer"
                        >
                          Bekor qilish
                        </button>
                        <button
                          type="button"
                          disabled={
                            liveExcelPreviewResult.previewProducts.length === 0 ||
                            Boolean(bulkUploadProgress)
                          }
                          onClick={handleConfirmExcelImport}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-racing text-xs sm:text-sm font-bold uppercase tracking-wider shadow-lg shadow-emerald-950/60 flex items-center gap-2 cursor-pointer active:scale-95 transition"
                        >
                          {bulkUploadProgress ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>{bulkUploadProgress.phaseText}</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>
                                Tasdiqlash va Bazaga yuklash ({liveExcelPreviewResult.totalRowsCount} ta)
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 4: AKSIYA VA E'LONLAR BANNERI */}
          {activeTab === 'banner' && !isManager && (
            <form onSubmit={handleSaveBanner} className="w-full space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-lg font-racing font-bold text-white flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-red-500" />
                    <span>Aksiya va E‘lonlar Lentasini Boshqarish</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Saytning eng tepa qismida ko'rinuvchi e'lon, chegirmalar va aksiyalarni sozlang.
                  </p>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-racing font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-900/50"
                >
                  <Save className="w-4 h-4" />
                  <span>Saqlash</span>
                </button>
              </div>

              {/* Banner Toggle Card */}
              <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-5 space-y-5">
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <div>
                    <div className="text-xs font-bold text-white">Banner holati (Sayt tepasida ko‘rinishi)</div>
                    <div className="text-[11px] text-zinc-400">
                      {tempBanner.enabled ? 'Aksiya lentasi hozir saytda faol ko‘rinmoqda' : 'Aksiya lentasi o‘chirilgan'}
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempBanner.enabled}
                      onChange={(e) => setTempBanner({ ...tempBanner, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Nishon Matni (Badge)</label>
                    <input
                      type="text"
                      value={tempBanner.badgeText}
                      onChange={(e) => setTempBanner({ ...tempBanner, badgeText: e.target.value })}
                      placeholder="🔥 QAYNOQ AKSIYA"
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-red-400 font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-zinc-300 mb-1">Asosiy E‘lon Matni *</label>
                    <input
                      type="text"
                      required
                      value={tempBanner.text}
                      onChange={(e) => setTempBanner({ ...tempBanner, text: e.target.value })}
                      placeholder="Barcha Gentra va Cobalt tyuning mahsulotlariga 15% chegirma!"
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Tugma matni (ixtiyoriy)</label>
                    <input
                      type="text"
                      value={tempBanner.linkText || ''}
                      onChange={(e) => setTempBanner({ ...tempBanner, linkText: e.target.value })}
                      placeholder="Katalogga o‘tish"
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Tugma havolasi (ixtiyoriy)</label>
                    <input
                      type="text"
                      value={tempBanner.linkUrl || ''}
                      onChange={(e) => setTempBanner({ ...tempBanner, linkUrl: e.target.value })}
                      placeholder="#katalog"
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono"
                    />
                  </div>
                </div>

                {/* Live Preview Box */}
                <div className="pt-4 border-t border-zinc-800">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Jonli ko‘rinish (Saytdagi ko‘rinishi):
                  </div>
                  <div className="p-3 bg-gradient-to-r from-red-950 via-zinc-950 to-red-950 border border-red-900/60 rounded-xl flex items-center justify-between text-xs text-zinc-200 shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-racing text-[10px] font-bold uppercase">
                        {tempBanner.badgeText || 'AKSIYA'}
                      </span>
                      <span>{tempBanner.text}</span>
                    </div>
                    {tempBanner.linkText && (
                      <span className="text-red-400 font-bold hover:underline cursor-pointer">
                        {tempBanner.linkText} →
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold text-xs uppercase tracking-wider shadow-xl shadow-red-900/50"
                >
                  Bannerni Saqlash
                </button>
              </div>
            </form>
          )}

          {/* TAB: PROMOKODLAR BOSHQARUVI VA YANGI PROMOKOD QO‘SHISH */}
          {activeTab === 'promocodes' && (
            <div className="space-y-6">
              {/* Header & Stats Banner */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-red-950/60 via-zinc-900 to-zinc-950 border border-red-900/40 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shadow-lg shadow-red-950/50">
                      <Ticket className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-racing text-xl font-bold text-white tracking-wide">
                        Promokodlar va Chegirmalar Tizimi
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Xaridorlar uchun yangi promokodlar yarating va chegirmalarni boshqaring. Barcha ma'lumotlar avtomatik saqlanadi.
                      </p>
                    </div>
                  </div>

                  {/* Top quick stats */}
                  <div className="flex items-center gap-3">
                    <div className="px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-center">
                      <div className="text-[10px] text-zinc-400 uppercase font-bold">Jami Promokodlar</div>
                      <div className="text-lg font-racing font-bold text-white mt-0.5">{localPromoCodes.length} ta</div>
                    </div>
                    <div className="px-3.5 py-2 rounded-xl bg-green-950/40 border border-green-800/60 text-center">
                      <div className="text-[10px] text-green-400 uppercase font-bold">Faol Kodlar</div>
                      <div className="text-lg font-racing font-bold text-green-400 mt-0.5">
                        {localPromoCodes.filter(p => p.isActive).length} ta
                      </div>
                    </div>
                    <div className="px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-center">
                      <div className="text-[10px] text-zinc-400 uppercase font-bold">Ishlatilishlar</div>
                      <div className="text-lg font-racing font-bold text-amber-400 mt-0.5">
                        {localPromoCodes.reduce((s, p) => s + (p.usageCount || 0), 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. YANGI PROMOKOD QO‘SHISH FORMASI */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10121a] border border-zinc-800 space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-red-500" />
                    <h4 className="font-racing text-base font-bold text-white tracking-wide uppercase">
                      Yangi Promokod Qo‘shish
                    </h4>
                  </div>

                  {/* Random Code Generator Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const prefixes = ['RAVON', 'TUNING', 'AUTO', 'TURBO', 'SPEED', 'VIP', 'CHEVY'];
                      const randomPref = prefixes[Math.floor(Math.random() * prefixes.length)];
                      const randomNum = Math.floor(10 + Math.random() * 90);
                      const generated = `${randomPref}${randomNum}`;
                      setNewPromoForm((prev) => ({ ...prev, code: generated }));
                      showToast(`Tasodifiy promokod generatsiya qilindi: ${generated}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white border border-zinc-750 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tasodifiy kod yaratish</span>
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const cleanCode = newPromoForm.code.trim().toUpperCase();
                    if (!cleanCode || cleanCode.length < 3) {
                      showToast("⚠️ Promokod kodi kamida 3 ta belgidan iborat bo‘lishi kerak.");
                      return;
                    }

                    if (newPromoForm.discountValue <= 0) {
                      showToast("⚠️ Chegirma miqdori 0 dan katta bo‘lishi kerak.");
                      return;
                    }

                    if (newPromoForm.discountType === 'percent' && newPromoForm.discountValue > 90) {
                      showToast("⚠️ Foizli chegirma 90% dan oshmasligi lozim.");
                      return;
                    }

                    // Check for existing duplicate code
                    if (localPromoCodes.some((p) => p.code.trim().toUpperCase() === cleanCode)) {
                      showToast(`⚠️ "${cleanCode}" nomli promokod allaqachon mavjud! Boshqa kod kiriting.`);
                      return;
                    }

                    const newPromoItem: PromoCode = {
                      id: 'promo-' + Date.now(),
                      code: cleanCode,
                      discountType: newPromoForm.discountType,
                      discountValue: Number(newPromoForm.discountValue),
                      minOrderAmount: Number(newPromoForm.minOrderAmount) || 0,
                      maxDiscountAmount: Number(newPromoForm.maxDiscountAmount) || undefined,
                      description: newPromoForm.description.trim() || undefined,
                      isActive: newPromoForm.isActive,
                      usageCount: 0,
                      maxUses: Number(newPromoForm.maxUses) || undefined,
                      createdAt: new Date().toISOString(),
                      expiresAt: newPromoForm.expiresAt ? new Date(newPromoForm.expiresAt).toISOString() : undefined,
                    };

                    const updated = [newPromoItem, ...localPromoCodes];
                    updatePromos(updated);
                    showToast(`✅ "${cleanCode}" promokodi muvaffaqiyatli saqlandi va faollashtirildi!`);

                    // Reset form
                    setNewPromoForm({
                      code: '',
                      discountType: 'percent',
                      discountValue: 10,
                      minOrderAmount: 0,
                      maxDiscountAmount: 0,
                      description: '',
                      isActive: true,
                      maxUses: 0,
                      expiresAt: '',
                    });
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Code input */}
                    <div>
                      <label className="block text-xs text-zinc-300 font-bold mb-1.5 uppercase tracking-wide">
                        Promokod kodi *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={newPromoForm.code}
                          onChange={(e) =>
                            setNewPromoForm({ ...newPromoForm, code: e.target.value.toUpperCase() })
                          }
                          placeholder="Masalan: RAVON25"
                          className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3.5 py-2.5 pl-9 text-sm font-racing font-bold text-white uppercase placeholder:normal-case placeholder:font-sans placeholder-zinc-500 focus:outline-none focus:border-red-500 tracking-wider"
                        />
                        <Tag className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {/* Discount Type */}
                    <div>
                      <label className="block text-xs text-zinc-300 font-bold mb-1.5 uppercase tracking-wide">
                        Chegirma turi *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewPromoForm({ ...newPromoForm, discountType: 'percent' })}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                            newPromoForm.discountType === 'percent'
                              ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-900/50'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-750 hover:bg-zinc-850'
                          }`}
                        >
                          <Percent className="w-3.5 h-3.5" />
                          <span>Foizda (%)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNewPromoForm({ ...newPromoForm, discountType: 'fixed' })}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                            newPromoForm.discountType === 'fixed'
                              ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-900/50'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-750 hover:bg-zinc-850'
                          }`}
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>Qat'iy (so‘m)</span>
                        </button>
                      </div>
                    </div>

                    {/* Discount Value */}
                    <div>
                      <label className="block text-xs text-zinc-300 font-bold mb-1.5 uppercase tracking-wide">
                        {newPromoForm.discountType === 'percent' ? "Chegirma foizi (%) *" : "Chegirma summasi (so‘m) *"}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min={1}
                          max={newPromoForm.discountType === 'percent' ? 90 : 50000000}
                          value={newPromoForm.discountValue || ''}
                          onChange={(e) =>
                            setNewPromoForm({ ...newPromoForm, discountValue: Number(e.target.value) })
                          }
                          placeholder={newPromoForm.discountType === 'percent' ? "15" : "50000"}
                          className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3.5 py-2.5 pl-9 text-sm font-racing font-bold text-white placeholder:font-sans placeholder-zinc-500 focus:outline-none focus:border-red-500"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-bold">
                          {newPromoForm.discountType === 'percent' ? '%' : 'UZS'}
                        </div>
                      </div>
                    </div>

                    {/* Min Order Amount */}
                    <div>
                      <label className="block text-xs text-zinc-300 font-bold mb-1.5 uppercase tracking-wide">
                        Minimal xarid summasi (so‘m)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={newPromoForm.minOrderAmount || ''}
                        onChange={(e) =>
                          setNewPromoForm({ ...newPromoForm, minOrderAmount: Number(e.target.value) })
                        }
                        placeholder="0 (cheklovsiz)"
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  {/* Secondary row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Description */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-zinc-300 font-bold mb-1.5 uppercase tracking-wide">
                        Tavsif / Maqsad (Mijozlarga ko‘rsatiladi)
                      </label>
                      <input
                        type="text"
                        value={newPromoForm.description}
                        onChange={(e) =>
                          setNewPromoForm({ ...newPromoForm, description: e.target.value })
                        }
                        placeholder="Masalan: Gentra va Cobalt aksessuarlariga 15% chegirma"
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-red-500"
                      />
                    </div>

                    {/* Expiration date */}
                    <div>
                      <label className="block text-xs text-zinc-300 font-bold mb-1.5 uppercase tracking-wide">
                        Amal qilish muddati (ixtiyoriy)
                      </label>
                      <input
                        type="date"
                        value={newPromoForm.expiresAt}
                        onChange={(e) =>
                          setNewPromoForm({ ...newPromoForm, expiresAt: e.target.value })
                        }
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  {/* Submit actions and active toggle */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newPromoForm.isActive}
                        onChange={(e) =>
                          setNewPromoForm({ ...newPromoForm, isActive: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-zinc-900 border-zinc-700"
                      />
                      <span className="text-xs text-zinc-200 font-medium">
                        Darhol faollashtirish (Saytda ishlaydigan qilish)
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="px-8 py-3 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 active:scale-95 transition"
                    >
                      <Save className="w-4 h-4" />
                      <span>Yangi Promokodni Saqlash</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* 2. MAVJUD PROMOKODLAR RO‘YXATI (Boshqaruv, faollik, o‘chirish) */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#10121a] border border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-red-500" />
                    <h4 className="font-racing text-base font-bold text-white tracking-wide uppercase">
                      Mavjud Promokodlar Ro‘yxati
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-mono font-bold">
                      {localPromoCodes.length}
                    </span>
                  </div>

                  {/* Filter and Search */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={promoSearch}
                        onChange={(e) => setPromoSearch(e.target.value)}
                        placeholder="Qidirish (kod yoki tavsif)..."
                        className="bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-1.5 pl-8 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-red-500 w-48 sm:w-60"
                      />
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>

                    <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-xl text-xs">
                      <button
                        type="button"
                        onClick={() => setPromoFilter('all')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium ${
                          promoFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Hammasi
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromoFilter('active')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium ${
                          promoFilter === 'active' ? 'bg-green-950 text-green-300' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Faollar
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromoFilter('inactive')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium ${
                          promoFilter === 'inactive' ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Nofaollar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Promo list */}
                {(() => {
                  const filtered = localPromoCodes.filter((p) => {
                    const matchSearch =
                      promoSearch.trim() === '' ||
                      p.code.toLowerCase().includes(promoSearch.toLowerCase()) ||
                      (p.description || '').toLowerCase().includes(promoSearch.toLowerCase());
                    const matchFilter =
                      promoFilter === 'all' ||
                      (promoFilter === 'active' && p.isActive) ||
                      (promoFilter === 'inactive' && !p.isActive);
                    return matchSearch && matchFilter;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center text-zinc-500 text-xs rounded-xl bg-zinc-900/40 border border-zinc-850">
                        Hech qanday promokod topilmadi.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                      {filtered.map((promo) => {
                        const isExpired = promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now();

                        return (
                          <div
                            key={promo.id}
                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                              promo.isActive && !isExpired
                                ? 'bg-zinc-900/80 hover:bg-zinc-850 border-zinc-800 hover:border-zinc-700'
                                : 'bg-zinc-950/60 border-zinc-850 opacity-70'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-racing text-lg font-bold text-white tracking-wider">
                                    {promo.code}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(promo.code);
                                      setCopiedPromoId(promo.id);
                                      setTimeout(() => setCopiedPromoId(null), 2000);
                                    }}
                                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white transition"
                                    title="Nusxa olish"
                                  >
                                    {copiedPromoId === promo.id ? (
                                      <Check className="w-3.5 h-3.5 text-green-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                      promo.isActive && !isExpired
                                        ? 'bg-green-950/80 border border-green-800 text-green-400'
                                        : 'bg-zinc-850 border border-zinc-700 text-zinc-400'
                                    }`}
                                  >
                                    {isExpired ? 'Muddati o‘tgan' : promo.isActive ? 'Faol' : 'To‘xtatilgan'}
                                  </span>
                                </div>

                                {promo.description && (
                                  <p className="text-xs text-zinc-300 mt-1">
                                    {promo.description}
                                  </p>
                                )}
                              </div>

                              {/* Discount badge */}
                              <div className="px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-800 text-right shrink-0">
                                <div className="font-racing font-bold text-base text-red-400">
                                  {promo.discountType === 'percent'
                                    ? `-${promo.discountValue}%`
                                    : `-${formatUzbekSum(promo.discountValue)}`}
                                </div>
                                <div className="text-[9px] text-zinc-400 uppercase font-semibold">
                                  {promo.discountType === 'percent' ? 'Foiz chegirma' : 'Naqd chegirma'}
                                </div>
                              </div>
                            </div>

                            {/* Details row */}
                            <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                              <div className="flex flex-wrap items-center gap-3">
                                <span>
                                  Foydalanildi: <strong className="text-white font-mono">{promo.usageCount || 0} marta</strong>
                                </span>
                                {promo.minOrderAmount && promo.minOrderAmount > 0 && (
                                  <span>
                                    Min buyurtma: <strong className="text-zinc-300">{formatUzbekSum(promo.minOrderAmount)}</strong>
                                  </span>
                                )}
                                {promo.expiresAt && (
                                  <span>
                                    Muddati: <strong className="text-zinc-300">{new Date(promo.expiresAt).toLocaleDateString('uz-UZ')}</strong>
                                  </span>
                                )}
                              </div>

                              {/* Toggle & Delete buttons */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = localPromoCodes.map((p) =>
                                      p.id === promo.id || p.code === promo.code ? { ...p, isActive: !p.isActive } : p
                                    );
                                    updatePromos(updated);
                                    showToast(
                                      `"${promo.code}" promokodi ${!promo.isActive ? 'faollashtirildi' : 'to‘xtatildi'}.`
                                    );
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                                    promo.isActive
                                      ? 'bg-amber-950/40 hover:bg-amber-950 text-amber-300 border-amber-800/60'
                                      : 'bg-green-950/40 hover:bg-green-950 text-green-300 border-green-800/60'
                                  }`}
                                >
                                  {promo.isActive ? 'To‘xtatish' : 'Faollashtirish'}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Remove immediately without blocking confirm()
                                    const targetId = promo.id;
                                    const targetCode = promo.code;
                                    const updated = localPromoCodes.filter((p) => p.id !== targetId && p.code !== targetCode);
                                    updatePromos(updated);
                                    showToast(`"${promo.code}" promokodi muvaffaqiyatli o‘chirildi.`);
                                  }}
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-900/60 text-zinc-400 hover:text-red-300 border border-zinc-700 transition"
                                  title="O‘chirish"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          {activeTab === 'crm' && (
            <div className="space-y-6">
              
              {/* 30-Day Store Performance Charts (Recharts: Daily Order Trends & Total Revenue) */}
              <StorePerformanceCharts orders={orders} />

              {/* CRM Top Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#12141e] border border-zinc-800">
                  <div className="text-xs text-zinc-400">Jami Buyurtmalar</div>
                  <div className="text-2xl font-racing font-bold text-white mt-1 tabular-nums">
                    {orders.length} ta
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-red-950/30 border border-red-900/60">
                  <div className="text-xs text-red-300">Yangi Buyurtmalar</div>
                  <div className="text-2xl font-racing font-bold text-red-400 mt-1 tabular-nums">
                    {orders.filter(o => o.status === 'Yangi').length} ta
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-900/60">
                  <div className="text-xs text-amber-300">Yetkazilmoqda</div>
                  <div className="text-2xl font-racing font-bold text-amber-400 mt-1 tabular-nums">
                    {orders.filter(o => o.status === 'Yetkazilmoqda').length} ta
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-green-950/30 border border-green-900/60">
                  <div className="text-xs text-green-300">Bajarildi</div>
                  <div className="text-2xl font-racing font-bold text-green-400 mt-1 tabular-nums">
                    {orders.filter(o => o.status === 'Bajarildi').length} ta
                  </div>
                </div>
              </div>

              {/* CRM Filters & Search */}
              <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
                  {['Hammasi', 'Yangi', 'Yetkazilmoqda', 'Bajarildi', 'Bekor qilindi'].map(st => (
                    <button
                      key={st}
                      onClick={() => setCrmStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-racing font-bold transition shrink-0 ${
                        crmStatusFilter === st
                          ? 'bg-red-600 text-white shadow-md'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={crmSearch}
                    onChange={(e) => setCrmSearch(e.target.value)}
                    placeholder="Mijoz ismi, telefon, ID..."
                    className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-1.5 pl-8 text-xs text-white"
                  />
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Orders List */}
              {filteredOrders.length === 0 ? (
                <div className="p-12 text-center bg-[#12141e] border border-zinc-800 rounded-2xl space-y-2">
                  <div className="text-sm font-bold text-zinc-300">Buyurtmalar topilmadi</div>
                  <p className="text-xs text-zinc-500">
                    Tanlangan filtr yoki qidiruv bo‘yicha hozircha hech qanday buyurtma mavjud emas.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map(order => {
                    const cleanPhone = order.customer.phone.replace(/\D/g, '');
                    const receiptImg = order.receiptImage || order.customer?.receiptImage;
                    const isOnlineOrder = order.customer.paymentMethod !== 'cash';
                    return (
                      <div 
                        key={order.id}
                        className="bg-[#12141e] border border-zinc-800 hover:border-zinc-750 rounded-2xl p-5 space-y-4 shadow-lg transition"
                      >
                        {/* Order Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                          <div className="flex items-center flex-wrap gap-2.5">
                            <span className="font-racing font-black text-sm text-red-400">
                              #{order.id}
                            </span>
                            <span className="text-xs text-zinc-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(order.createdAt).toLocaleString('uz-UZ')}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-zinc-900 text-zinc-300 border-zinc-700">
                              {order.customer.deliveryMethod === 'courier' ? 'Kuryer' : order.customer.deliveryMethod === 'post' ? 'BTS/Fargo Pochta' : 'Uychi tumanidan Olib ketish'}
                            </span>
                            {isOnlineOrder && (
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  receiptImg
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/70'
                                    : 'bg-amber-950/80 text-amber-300 border-amber-700/70'
                                }`}
                              >
                                {receiptImg
                                  ? `💳 ${order.customer.paymentMethod.toUpperCase()} • Chek yuklangan`
                                  : `💳 ${order.customer.paymentMethod.toUpperCase()} • Chek kutilmoqda`}
                              </span>
                            )}
                          </div>

                          {/* Status Dropdown */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400">Holat:</span>
                            <select
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as OrderStatus)}
                              className={`rounded-xl px-3 py-1.5 text-xs font-bold font-racing cursor-pointer border ${
                                order.status === 'Yangi' || order.status === 'To‘lov cheki tekshirilmoqda'
                                  ? 'bg-red-950 text-red-300 border-red-700'
                                  : order.status === 'Yetkazilmoqda'
                                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                                  : order.status === 'Bajarildi'
                                  ? 'bg-green-950 text-green-300 border-green-700'
                                  : 'bg-zinc-900 text-zinc-400 border-zinc-750'
                              }`}
                            >
                              <option value="Yangi">🔴 Yangi</option>
                              <option value="To‘lov cheki tekshirilmoqda">🟠 To‘lov cheki tekshirilmoqda</option>
                              <option value="Yetkazilmoqda">🟡 Yetkazilmoqda</option>
                              <option value="Bajarildi">🟢 Bajarildi</option>
                              <option value="Bekor qilindi">⚪ Bekor qilindi</option>
                            </select>
                          </div>
                        </div>

                        {/* Customer & Address & Receipt Screenshot & Quick Actions */}
                        <div className={`grid grid-cols-1 ${receiptImg ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 text-xs`}>
                          {/* Col 1: Customer details */}
                          <div className="space-y-1.5">
                            <div className="text-[10px] uppercase font-bold text-zinc-500">Buyurtmachi:</div>
                            <div className="font-bold text-white text-sm">{order.customer.fullName}</div>
                            <div className="text-red-400 font-semibold">{order.customer.phone}</div>
                            {order.customer.notes && (
                              <div className="text-zinc-400 italic text-[11px] bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                                Izoh: "{order.customer.notes}"
                              </div>
                            )}
                          </div>

                          {/* Col 2: Address */}
                          <div className="space-y-1.5">
                            <div className="text-[10px] uppercase font-bold text-zinc-500">Yetkazish Manzili:</div>
                            <div className="font-semibold text-zinc-200">{order.customer.region}</div>
                            <div className="text-zinc-400">{order.customer.cityAddress}</div>
                            <div className="text-[11px] text-zinc-500">
                              To‘lov turi: <strong className="text-zinc-300 uppercase">{order.customer.paymentMethod}</strong>
                            </div>
                          </div>

                          {/* Col 3 (if online order with receipt): Payment Receipt Screenshot Preview & Enlarge */}
                          {receiptImg && (
                            <div className="p-3 rounded-xl bg-zinc-900/90 border border-amber-700/60 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewReceiptOrder({
                                    orderId: order.id,
                                    customerName: order.customer.fullName,
                                    phone: order.customer.phone,
                                    totalAmount: order.totalAmount,
                                    paymentMethod: order.customer.paymentMethod,
                                    receiptImage: receiptImg,
                                    status: order.status,
                                  })
                                }
                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-amber-500/80 shrink-0 group cursor-pointer"
                                title="To‘lov chekini kattalashtirib ochish"
                              >
                                <img
                                  src={receiptImg}
                                  alt="To‘lov cheki"
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                  <Eye className="w-4 h-4 text-white" />
                                </div>
                              </button>
                              <div className="min-w-0 space-y-1.5">
                                <div className="text-[10px] uppercase font-bold text-amber-400">
                                  To‘lov cheki (Skrinshot):
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewReceiptOrder({
                                      orderId: order.id,
                                      customerName: order.customer.fullName,
                                      phone: order.customer.phone,
                                      totalAmount: order.totalAmount,
                                      paymentMethod: order.customer.paymentMethod,
                                      receiptImage: receiptImg,
                                      status: order.status,
                                    })
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-racing font-bold text-[11px] uppercase flex items-center gap-1.5 transition"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Kattalashtirib ochish</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Col 4: 1-click Contact Buttons */}
                          <div className="space-y-2 flex flex-col justify-center">
                            <a
                              href={`tel:${cleanPhone}`}
                              className="w-full py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-racing font-bold text-xs uppercase flex items-center justify-center gap-2 transition"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Qo‘ng‘iroq qilish</span>
                            </a>
                            <a
                              href={`https://t.me/+${cleanPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-racing font-bold text-xs uppercase flex items-center justify-center gap-2 transition"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Telegramdan yozish</span>
                            </a>
                          </div>
                        </div>

                        {/* Order Items & Total */}
                        <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase font-bold text-zinc-500">Buyurtma qilingan detallar:</div>
                            <div className="flex flex-wrap gap-2">
                              {order.items.map((item, i) => (
                                <span 
                                  key={i}
                                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs flex items-center gap-1.5"
                                >
                                  <span className="font-bold text-red-400">"{item.product.bazaarName}"</span>
                                  <span className="text-zinc-400">× {item.quantity} dona</span>
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-[10px] text-zinc-500">Jami to‘lov:</div>
                              <div className="font-racing font-black text-lg text-white">
                                {formatUzbekSum(order.totalAmount)}
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="p-2 rounded-xl bg-zinc-900 hover:bg-red-950 text-zinc-500 hover:text-red-400 transition"
                              title="Buyurtmani o'chirish"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: BAHOLAR VA IZOHLARNI BOSHQARISH */}
          {activeTab === 'reviews' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Top Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#12141e] border border-zinc-800">
                  <div className="text-xs text-zinc-400">Jami Izohlar</div>
                  <div className="text-2xl font-racing font-bold text-white mt-1">
                    {localReviews.length} ta
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-900/60">
                  <div className="text-xs text-amber-300">O‘rtacha Baho</div>
                  <div className="text-2xl font-racing font-bold text-amber-400 mt-1 flex items-center gap-1.5">
                    <span>
                      {localReviews.length > 0
                        ? (
                            localReviews.reduce((acc, r) => acc + Number(r.rating || 5), 0) /
                            localReviews.length
                          ).toFixed(1)
                        : '5.0'}
                    </span>
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-900/60">
                  <div className="text-xs text-emerald-300">Faol (Ko‘rinadigan)</div>
                  <div className="text-2xl font-racing font-bold text-emerald-400 mt-1">
                    {localReviews.filter((r) => r.isApproved !== false).length} ta
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                  <div className="text-xs text-zinc-400">Yashirilgan</div>
                  <div className="text-2xl font-racing font-bold text-zinc-300 mt-1">
                    {localReviews.filter((r) => r.isApproved === false).length} ta
                  </div>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReviewRatingFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-racing font-bold transition ${
                      reviewRatingFilter === 'all'
                        ? 'bg-red-600 text-white'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    Barcha baholar
                  </button>
                  {[5, 4, 3, 2, 1].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRatingFilter(star)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                        reviewRatingFilter === star
                          ? 'bg-amber-500 text-black'
                          : 'bg-zinc-900 text-amber-400 hover:bg-zinc-800 border border-zinc-800'
                      }`}
                    >
                      <span>{star}</span>
                      <Star className="w-3 h-3 fill-current" />
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setReviewStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition font-medium ${
                        reviewStatusFilter === 'all'
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Hammasi
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewStatusFilter('approved')}
                      className={`px-2.5 py-1 rounded-lg transition font-medium ${
                        reviewStatusFilter === 'approved'
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Faol
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewStatusFilter('hidden')}
                      className={`px-2.5 py-1 rounded-lg transition font-medium ${
                        reviewStatusFilter === 'hidden'
                          ? 'bg-zinc-800 text-zinc-300'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Yashirilgan
                    </button>
                  </div>

                  <div className="relative flex-1 sm:w-64">
                    <input
                      type="text"
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                      placeholder="Mijoz, tovar yoki izoh bo'yicha qidiruv..."
                      className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-1.5 pl-8 text-xs text-white"
                    />
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Reviews List */}
              {(() => {
                const filteredReviews = localReviews.filter((r) => {
                  if (reviewRatingFilter !== 'all' && Number(r.rating) !== reviewRatingFilter) {
                    return false;
                  }
                  if (reviewStatusFilter === 'approved' && r.isApproved === false) {
                    return false;
                  }
                  if (reviewStatusFilter === 'hidden' && r.isApproved !== false) {
                    return false;
                  }
                  if (reviewSearch.trim()) {
                    const q = reviewSearch.toLowerCase();
                    return (
                      (r.customerName || '').toLowerCase().includes(q) ||
                      (r.comment || '').toLowerCase().includes(q) ||
                      (r.productName || '').toLowerCase().includes(q) ||
                      (r.productBazaarName || '').toLowerCase().includes(q)
                    );
                  }
                  return true;
                });

                if (filteredReviews.length === 0) {
                  return (
                    <div className="p-12 text-center bg-[#12141e] border border-zinc-800 rounded-2xl space-y-2">
                      <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto" />
                      <div className="text-sm font-bold text-zinc-300">
                        Baholar va izohlar topilmadi
                      </div>
                      <p className="text-xs text-zinc-500">
                        Mijozlar tovar kartalarida baho va qisqa izoh qoldirganda ular shu yerda
                        aks etadi.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredReviews.map((rev) => {
                      const isEditing = editingReviewId === rev.id;
                      const linkedProduct = products.find((p) => p.id === rev.productId);

                      return (
                        <div
                          key={rev.id}
                          className={`p-4 rounded-2xl border transition flex flex-col justify-between gap-3 ${
                            rev.isApproved !== false
                              ? 'bg-[#12141e] border-zinc-800 hover:border-zinc-700'
                              : 'bg-zinc-950/70 border-zinc-850 opacity-75'
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Product & Status Header */}
                            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-zinc-800/80">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {linkedProduct?.image && (
                                  <img
                                    src={linkedProduct.image}
                                    alt={rev.productName}
                                    className="w-10 h-10 rounded-lg object-cover border border-zinc-800 shrink-0"
                                  />
                                )}
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-white truncate">
                                    {rev.productName}
                                  </div>
                                  {rev.productBazaarName && (
                                    <div className="text-[11px] font-racing text-red-400 truncate">
                                      Bozorda: "{rev.productBazaarName}"
                                    </div>
                                  )}
                                </div>
                              </div>

                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                                  rev.isApproved !== false
                                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/70'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                }`}
                              >
                                {rev.isApproved !== false ? "Ko'rinadi" : 'Yashirilgan'}
                              </span>
                            </div>

                            {/* Customer Name, Rating & Date */}
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-xs font-bold text-zinc-200">
                                  {rev.customerName}
                                </div>
                                <div className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3" />
                                  <span>{new Date(rev.createdAt).toLocaleString('uz-UZ')}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-0.5 text-amber-400">
                                {[1, 2, 3, 4, 5].map((st) => (
                                  <Star
                                    key={st}
                                    className={`w-3.5 h-3.5 ${
                                      st <= rev.rating
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-zinc-700'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Comment or Edit Mode */}
                            {isEditing ? (
                              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-zinc-400">Baho:</span>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((st) => (
                                      <button
                                        key={st}
                                        type="button"
                                        onClick={() => setEditReviewRating(st)}
                                        className="p-0.5"
                                      >
                                        <Star
                                          className={`w-4 h-4 ${
                                            st <= editReviewRating
                                              ? 'fill-amber-400 text-amber-400'
                                              : 'text-zinc-600'
                                          }`}
                                        />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <textarea
                                  rows={2}
                                  value={editReviewComment}
                                  onChange={(e) => setEditReviewComment(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:border-red-500 focus:outline-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingReviewId(null)}
                                    className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                                  >
                                    Bekor qilish
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = localReviews.map((item) =>
                                        item.id === rev.id
                                          ? {
                                              ...item,
                                              rating: editReviewRating,
                                              comment: editReviewComment.trim() || item.comment,
                                            }
                                          : item
                                      );
                                      updateReviewsList(updated);
                                      setEditingReviewId(null);
                                      showToast('Izoh va baho yangilandi!');
                                    }}
                                    className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1"
                                  >
                                    <Save className="w-3 h-3" />
                                    <span>Saqlash</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 text-xs text-zinc-200 leading-relaxed">
                                "{rev.comment}"
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingReviewId(rev.id);
                                setEditReviewComment(rev.comment);
                                setEditReviewRating(rev.rating);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs flex items-center gap-1 transition"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                              <span>Tahrirlash</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const updated = localReviews.map((item) =>
                                  item.id === rev.id
                                    ? { ...item, isApproved: item.isApproved === false }
                                    : item
                                );
                                updateReviewsList(updated);
                                showToast(
                                  rev.isApproved === false
                                    ? "Izoh do'konda ko'rinadigan qilindi."
                                    : "Izoh do'kondan yashirildi."
                                );
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs flex items-center gap-1 transition"
                            >
                              {rev.isApproved !== false ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Yashirish</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Ko‘rsatish</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const updated = localReviews.filter((item) => item.id !== rev.id);
                                updateReviewsList(updated);
                                showToast("Izoh muvaffaqiyatli o'chirildi.");
                              }}
                              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950 text-zinc-400 hover:text-red-400 border border-zinc-750 transition"
                              title="Izohni o'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 9: BUYURTMA STOLI (RASM ORQALI ZAPCHAST SO'ROVLARI) */}
          {activeTab === 'part-requests' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                <div>
                  <h3 className="text-lg sm:text-xl font-racing font-bold text-white flex items-center gap-2">
                    <Camera className="w-5 h-5 text-red-500" />
                    <span>Buyurtma Stoli — Rasm Orqali Zapchast So‘rovlari ({partRequests.length} ta)</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Mijozlar katalogdan topa olmagan zapchastlarining rasmini, mashina rusumini va telefon raqamini yuborgan so‘rovlar.
                  </p>
                </div>
              </div>

              {partRequests.length === 0 ? (
                <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-12 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                    <Camera className="w-7 h-7 text-red-500/60" />
                  </div>
                  <div className="font-racing text-base font-bold text-white">
                    Hozircha rasm orqali zapchast so‘rovlari yo‘q
                  </div>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Mijozlar katalogdagi "Kerakli zapchastni topmadingizmi? Rasmini yuboring!" tugmasi orqali so‘rov yuborganda shu yerda va Telegram botda chiqadi.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {partRequests.map((req) => (
                    <div
                      key={req.id}
                      className="bg-[#12141e] border border-zinc-800 hover:border-red-600/50 rounded-2xl overflow-hidden flex flex-col justify-between transition"
                    >
                      <div>
                        <div
                          className="relative aspect-16/10 bg-black overflow-hidden cursor-pointer group"
                          onClick={() => setPreviewPartRequest(req)}
                        >
                          <img
                            src={req.image}
                            alt={req.partName || req.carModel}
                            loading="lazy"
                            className="w-full h-full object-contain group-hover:scale-105 transition duration-300"
                          />
                          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/80 text-white font-mono text-[11px] font-bold border border-zinc-700">
                            #{req.id}
                          </span>
                          <span
                            className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[10px] font-racing font-bold uppercase ${
                              req.status === 'Yangi'
                                ? 'bg-red-600 text-white'
                                : req.status === 'Topildi / Bog‘lanildi'
                                ? 'bg-emerald-600 text-white'
                                : req.status === 'Ko‘rib chiqilmoqda'
                                ? 'bg-amber-500 text-black'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>

                        <div className="p-4 space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-md bg-red-600/20 text-red-400 border border-red-500/40 font-racing font-bold">
                              Mashina: {req.carModel}
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              {new Date(req.createdAt).toLocaleString('uz-UZ')}
                            </span>
                          </div>

                          {req.partName && (
                            <div className="font-bold text-white text-sm">
                              Detal: {req.partName}
                            </div>
                          )}

                          <div className="space-y-1 pt-1 border-t border-zinc-800/80">
                            <div className="text-zinc-300">
                              Mijoz: <strong className="text-white">{req.fullName}</strong>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">Telefon:</span>
                              <a
                                href={`tel:${req.phone.replace(/\s+/g, '')}`}
                                className="font-mono font-bold text-emerald-400 hover:underline flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" />
                                {req.phone}
                              </a>
                            </div>
                          </div>

                          {req.note && (
                            <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
                              Izoh: {req.note}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-zinc-950/70 border-t border-zinc-800 flex items-center justify-between gap-2">
                        <select
                          value={req.status}
                          onChange={(e) =>
                            handleUpdatePartRequestStatus(req.id, e.target.value as PartRequestStatus)
                          }
                          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="Yangi">Yangi</option>
                          <option value="Ko‘rib chiqilmoqda">Ko‘rib chiqilmoqda</option>
                          <option value="Topildi / Bog‘lanildi">Topildi / Bog‘lanildi</option>
                          <option value="Bekor qilindi">Bekor qilindi</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => setPreviewPartRequest(req)}
                          className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                          title="Rasmni kattalashtirib ko'rish"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePartRequest(req.id)}
                          className="p-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-800/60 transition"
                          title="O‘chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Lightbox for Photo Part Request ("Buyurtma stoli") */}
      {previewPartRequest && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setPreviewPartRequest(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-[#10121a] border border-zinc-700 rounded-2xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 gap-3">
              <div>
                <div className="text-xs font-racing font-bold text-red-400 uppercase tracking-wider">
                  Zapchast so‘rovi • #{previewPartRequest.id} ({previewPartRequest.carModel})
                </div>
                <div className="text-xs text-zinc-300 mt-0.5">
                  Mijoz: <strong className="text-white">{previewPartRequest.fullName}</strong> ({previewPartRequest.phone})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPartRequest(null)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto rounded-xl bg-black border border-zinc-800 flex items-center justify-center p-2">
              <img
                src={previewPartRequest.image}
                alt={previewPartRequest.partName || previewPartRequest.carModel}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800">
              <a
                href={`tel:${previewPartRequest.phone.replace(/\s+/g, '')}`}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-racing font-bold text-xs uppercase flex items-center gap-2 transition"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Mijozga qo‘ng‘iroq qilish ({previewPartRequest.phone})</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewPartRequest(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-racing font-bold text-xs uppercase transition"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Lightbox Modal for Inspecting Customer Payment Receipt Screenshot */}
      {previewReceiptOrder && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setPreviewReceiptOrder(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-[#10121a] border border-zinc-700 rounded-2xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 gap-3">
              <div>
                <div className="text-xs font-racing font-bold text-amber-400 uppercase tracking-wider">
                  To‘lov cheki skrinshoti • #{previewReceiptOrder.orderId}
                </div>
                <div className="text-xs text-zinc-300 mt-0.5">
                  Xaridor: <strong className="text-white">{previewReceiptOrder.customerName}</strong> ({previewReceiptOrder.phone}) • To‘lov: <strong className="text-red-400">{formatUzbekSum(previewReceiptOrder.totalAmount)}</strong> ({previewReceiptOrder.paymentMethod.toUpperCase()})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceiptOrder(null)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[68vh] overflow-auto rounded-xl bg-black border border-zinc-800 flex items-center justify-center p-2">
              <img
                src={previewReceiptOrder.receiptImage}
                alt={`To‘lov cheki #${previewReceiptOrder.orderId}`}
                className="max-w-full max-h-[64vh] object-contain rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateOrderStatus(previewReceiptOrder.orderId, 'Yetkazilmoqda');
                    setPreviewReceiptOrder({
                      ...previewReceiptOrder,
                      status: 'Yetkazilmoqda',
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-racing font-bold text-xs uppercase transition"
                >
                  ✅ To‘lovni tasdiqlash (Yetkazilmoqda)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateOrderStatus(previewReceiptOrder.orderId, 'Bajarildi');
                    setPreviewReceiptOrder({
                      ...previewReceiptOrder,
                      status: 'Bajarildi',
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-racing font-bold text-xs uppercase transition"
                >
                  🟢 Bajarildi deb belgilash
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewReceiptOrder(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-racing font-bold text-xs uppercase transition"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
