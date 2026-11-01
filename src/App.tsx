import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HeroAiSearch } from './components/HeroAiSearch';
import { FilterBar } from './components/FilterBar';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { MyOrdersModal } from './components/MyOrdersModal';
import { CompareModal } from './components/CompareModal';
import { CompareFloatingBar } from './components/CompareFloatingBar';
import { PromoCodeModal } from './components/PromoCodeModal';
import { PartRequestModal } from './components/PartRequestModal';
import { Footer } from './components/Footer';
import { AdminLoginModal } from './components/admin/AdminLoginModal';
import { AdminDashboardModal } from './components/admin/AdminDashboardModal';
import { SecretPinModal } from './components/admin/SecretPinModal';
import { PRODUCTS } from './data/products';
import { 
  DEFAULT_SITE_SETTINGS, 
  DEFAULT_BANNER, 
  DEFAULT_CAR_MODELS, 
  DEFAULT_CATEGORIES,
  DEFAULT_BRANDS,
  INITIAL_ORDERS,
  INITIAL_ADMINS,
  DEFAULT_PROMO_CODES
} from './data/initialData';
import { 
  Product, 
  CartItem, 
  CarModel, 
  ProductCategory,
  ProductBrand,
  AiAnalysisResult, 
  OrderForm, 
  SiteSettings, 
  AnnouncementBanner, 
  OrderRecord,
  AdminUser,
  PromoCode,
  AppliedPromo,
  ProductReview,
  PartRequest
} from './types';
import { ShoppingBag, Sparkles, Check, Lock, Camera } from 'lucide-react';
import { sendTelegramNotification, formatOrderTelegramMessage } from './utils/telegram';
import { MobileBottomBar } from './components/MobileBottomBar';
import { initTelegramWebApp, isTelegramWebApp } from './utils/telegramWebApp';
import { formatUzbekSum } from './utils/formatters';
import {
  sanitizeProductsList,
  sanitizeOrdersList,
  sanitizeSiteSettings,
  pushRealtimeState,
  subscribeToRealtimeSync,
  saveSingleProductToCloud,
  saveToHighTrafficCache,
} from './services/supabaseSync';
import {
  buildSearchIndexForProduct,
  matchesSmartSearch,
} from './utils/smartSearch';

export default function App() {
  // 1. Site Settings (LocalStorage backed - strictly Namangan viloyati, Uychi tumani)
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    try {
      const saved = localStorage.getItem('ravon_site_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const { settings, wasModified } = sanitizeSiteSettings(parsed);
        if (wasModified) {
          localStorage.setItem('ravon_site_settings', JSON.stringify(settings));
        }
        return settings;
      }
      localStorage.setItem('ravon_site_settings', JSON.stringify(DEFAULT_SITE_SETTINGS));
      return DEFAULT_SITE_SETTINGS;
    } catch {
      return DEFAULT_SITE_SETTINGS;
    }
  });

  // 2. Announcement Banner (LocalStorage backed)
  const [announcementBanner, setAnnouncementBanner] = useState<AnnouncementBanner>(() => {
    try {
      const saved = localStorage.getItem('ravon_announcement');
      return saved ? JSON.parse(saved) : DEFAULT_BANNER;
    } catch {
      return DEFAULT_BANNER;
    }
  });

  // 3. Products List (Only persisted in localStorage if <= 500 items; > 500 items use IndexedDB + Firebase)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_products');
      if (!saved) {
        return [];
      }
      const parsed = JSON.parse(saved);
      const cleaned = sanitizeProductsList(parsed);
      if (cleaned.length > 500) {
        localStorage.removeItem('ravon_products');
      } else if (Array.isArray(parsed) && cleaned.length !== parsed.length) {
        localStorage.setItem('ravon_products', JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  });

  // 4. Car Models & Categories (LocalStorage backed)
  const [carModels, setCarModels] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_car_models');
      return saved ? JSON.parse(saved) : DEFAULT_CAR_MODELS;
    } catch {
      return DEFAULT_CAR_MODELS;
    }
  });

  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_categories');
      return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  const [brands, setBrands] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_brands');
      return saved ? JSON.parse(saved) : DEFAULT_BRANDS;
    } catch {
      return DEFAULT_BRANDS;
    }
  });

  // 5. Orders CRM (LocalStorage backed - test orders stripped)
  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_orders');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const cleaned = sanitizeOrdersList(parsed);
      if (Array.isArray(parsed) && cleaned.length !== parsed.length) {
        localStorage.setItem('ravon_orders', JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  });

  // 6. Registered Admins (Strict Superadmin sherzodjanovich_7 only)
  const [admins, setAdmins] = useState<AdminUser[]>(() => {
    try {
      localStorage.setItem('ravon_admins', JSON.stringify(INITIAL_ADMINS));
    } catch {}
    return INITIAL_ADMINS;
  });

  // Current authenticated admin (NEVER auto-restored; requires 0606 + sherzodjanovich_7 + xasan.95 in sequence)
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    try {
      sessionStorage.removeItem('ravon_strict_auth_v2');
      sessionStorage.removeItem('ravon_admin_authorized');
      sessionStorage.removeItem('ravon_admin_logged');
      sessionStorage.removeItem('ravon_current_user');
      localStorage.removeItem('ravon_admin_authorized');
      localStorage.removeItem('ravon_admin_logged');
      localStorage.removeItem('ravon_current_user');
    } catch {}
    return null;
  });

  // Shopping Cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Filters & Pagination state (Uzum Market style: 24 items per page + debounced search)
  const CATALOG_PAGE_SIZE = 24;
  const [selectedCar, setSelectedCar] = useState<CarModel>('Hammasi');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('Hammasi');
  const [selectedBrand, setSelectedBrand] = useState<ProductBrand>('Hammasi');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [visibleCount, setVisibleCount] = useState<number>(CATALOG_PAGE_SIZE);
  const [discountPercent, setDiscountPercent] = useState(0);

  // Debounce search query (180ms) so typing never lags even with 7,000+ products
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim().toLowerCase());
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination to first 24 items whenever filters, sort, or debounced search changes
  useEffect(() => {
    setVisibleCount(CATALOG_PAGE_SIZE);
  }, [selectedCar, selectedCategory, selectedBrand, debouncedSearchQuery, sortBy]);

  // Modals state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{
    id: string;
    data: OrderForm;
    items: CartItem[];
    totalAmount: number;
    date: string;
  } | null>(null);

  // Buyer's personal orders and receipts (strictly isolated to this user/device)
  const [myPersonalOrders, setMyPersonalOrders] = useState<OrderRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_my_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);

  // Auto Parts Compare (Taqqoslash) state
  const [compareItems, setCompareItems] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_compare_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Promo Codes System (Admin created & LocalStorage backed)
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_promocodes');
      if (saved !== null) {
        return JSON.parse(saved);
      }
      localStorage.setItem('ravon_promocodes', JSON.stringify(DEFAULT_PROMO_CODES));
      return DEFAULT_PROMO_CODES;
    } catch {
      return DEFAULT_PROMO_CODES;
    }
  });

  // Customer Product Reviews & Ratings (LocalStorage backed)
  const [reviews, setReviews] = useState<ProductReview[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_product_reviews');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  // Photo Part Requests ("Zapchastni rasm orqali so'rash / Buyurtma stoli")
  const [partRequests, setPartRequests] = useState<PartRequest[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_part_requests');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch {
      return [];
    }
  });
  const [isPartRequestOpen, setIsPartRequestOpen] = useState(false);

  // Active Applied Promo for buyer session
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(() => {
    try {
      const saved = sessionStorage.getItem('ravon_applied_promo');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  // Admin Panel states (Strictly requires Step 1: 0606 PIN -> Step 2: Login sherzodjanovich_7 & Parol xasan.95)
  const [isPinVerified, setIsPinVerified] = useState<boolean>(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isSecretPinModalOpen, setIsSecretPinModalOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state changes to LocalStorage (Admins are strictly local, never pushed to cloud sync)
  const handleUpdateAdmins = (newAdmins: AdminUser[]) => {
    setAdmins(newAdmins);
    localStorage.setItem('ravon_admins', JSON.stringify(newAdmins));
    if (currentUser) {
      const fresh = newAdmins.find((a) => a.id === currentUser.id);
      if (fresh) {
        setCurrentUser(fresh);
        sessionStorage.setItem('ravon_current_user', JSON.stringify(fresh));
      }
    }
  };

  const handleUpdateSiteSettings = (newSettings: SiteSettings) => {
    setSiteSettings(newSettings);
    localStorage.setItem('ravon_site_settings', JSON.stringify(newSettings));
    pushRealtimeState({ siteSettings: newSettings });
  };

  const handleUpdateBanner = (newBanner: AnnouncementBanner) => {
    setAnnouncementBanner(newBanner);
    localStorage.setItem('ravon_announcement', JSON.stringify(newBanner));
    pushRealtimeState({ announcementBanner: newBanner });
  };

  // Track when initial load from IndexedDB / Firebase is complete (Requirement 1: Anti-Wipe Protection)
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState<boolean>(false);

  const handleUpdateProducts = (
    newProducts: Product[],
    options?: { skipCloudPush?: boolean; allowEmptyProducts?: boolean }
  ) => {
    const cleaned = sanitizeProductsList(newProducts);

    // Block accidental empty array [] from wiping products unless explicitly triggered by "Delete All"
    if (cleaned.length === 0 && !options?.allowEmptyProducts && products.length > 0) {
      return;
    }

    setProducts(cleaned);

    // Requirement 2: Never save to localStorage if products count > 500 (prevents QuotaExceededError & JSON.stringify freeze)
    try {
      if (cleaned.length <= 500) {
        localStorage.setItem('ravon_products', JSON.stringify(cleaned));
      } else {
        localStorage.removeItem('ravon_products');
      }
    } catch {
      // ignore quota errors
    }

    if (options?.skipCloudPush) {
      saveToHighTrafficCache(
        { products: cleaned },
        { allowEmptyProducts: options?.allowEmptyProducts }
      ).catch(() => {});
      return;
    }

    const newIdSet = new Set(cleaned.map((p) => p.id));
    const removedIds = products.filter((p) => !newIdSet.has(p.id)).map((p) => p.id);

    pushRealtimeState(
      {
        products: cleaned,
        ...(removedIds.length > 0 ? { deletedProductIds: removedIds } : {}),
      },
      {
        allowEmptyProducts: options?.allowEmptyProducts,
        isExplicitUserAction: true,
      }
    );
  };

  const handleUpdateCarModels = (newModels: string[]) => {
    setCarModels(newModels);
    localStorage.setItem('ravon_car_models', JSON.stringify(newModels));
    pushRealtimeState({ carModels: newModels }, { isExplicitUserAction: true });
  };

  const handleUpdateCategories = (newCats: string[]) => {
    setCategories(newCats);
    localStorage.setItem('ravon_categories', JSON.stringify(newCats));
    pushRealtimeState({ categories: newCats }, { isExplicitUserAction: true });
  };

  const handleUpdateBrands = (newBrands: string[]) => {
    setBrands(newBrands);
    localStorage.setItem('ravon_brands', JSON.stringify(newBrands));
    pushRealtimeState({ brands: newBrands }, { isExplicitUserAction: true });
  };

  const handleUpdateOrders = (newOrders: OrderRecord[]) => {
    setOrders(newOrders);
    localStorage.setItem('ravon_orders', JSON.stringify(newOrders));
    pushRealtimeState({ orders: newOrders }, { isExplicitUserAction: true });
  };

  const handleUpdatePromoCodes = (newPromos: PromoCode[]) => {
    setPromoCodes(newPromos);
    try {
      localStorage.setItem('ravon_promocodes', JSON.stringify(newPromos));
      pushRealtimeState({ promoCodes: newPromos }, { isExplicitUserAction: true });
    } catch (e) {
      console.error('Failed to save promo codes:', e);
    }
  };

  const handleUpdateReviews = (newReviews: ProductReview[]) => {
    setReviews(newReviews);
    try {
      localStorage.setItem('ravon_product_reviews', JSON.stringify(newReviews));
    } catch (e) {
      console.error('Failed to save reviews:', e);
    }

    // Recalculate product rating & reviewCount based on approved reviews
    const updatedProducts = products.map((prod) => {
      const prodReviews = newReviews.filter(
        (r) => r.productId === prod.id && r.isApproved !== false
      );
      if (prodReviews.length === 0) return prod;
      const avgRating = Number(
        (
          prodReviews.reduce((acc, item) => acc + Number(item.rating || 5), 0) /
          prodReviews.length
        ).toFixed(1)
      );
      return {
        ...prod,
        rating: avgRating,
        reviewCount: prodReviews.length,
      };
    });
    setProducts(updatedProducts);
    try {
      if (updatedProducts.length <= 500) {
        localStorage.setItem('ravon_products', JSON.stringify(updatedProducts));
      } else {
        localStorage.removeItem('ravon_products');
      }
    } catch {}
    pushRealtimeState(
      {
        reviews: newReviews,
        ...(updatedProducts.length > 0 && updatedProducts.length <= 500
          ? { products: updatedProducts }
          : {}),
      },
      { isExplicitUserAction: true }
    );
  };

  const handleAddReview = (
    product: Product,
    rating: number,
    customerName: string,
    comment: string
  ) => {
    const newReview: ProductReview = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId: product.id,
      productName: product.name,
      productBazaarName: product.bazaarName,
      customerName: customerName.trim() || 'Xaridor',
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
      isApproved: true,
    };

    const updatedReviews = [newReview, ...reviews];
    handleUpdateReviews(updatedReviews);
    showToast(`"${product.bazaarName}" uchun baho va izohingiz saqlandi!`);
  };

  // Auto-Migration: Ensure any legacy Telegram bot token or @ravon_tuning_uz_bot in localStorage or Firebase
  // is automatically overwritten with the new @ravonavto_bot and token 9275377452:AAFe5jKxocDThflP-icoMWITCNeJyuSKWbw
  // Runs ONLY after isInitialLoadComplete === true so it never races with initial product loading
  useEffect(() => {
    if (!isInitialLoadComplete) return;
    const MANDATORY_TOKEN = '9275377452:AAFe5jKxocDThflP-icoMWITCNeJyuSKWbw';
    const MANDATORY_USERNAME = 'ravonavto_bot';
    const MANDATORY_CHANNEL = 'https://t.me/ravonavto_bot';

    try {
      const savedRaw = localStorage.getItem('ravon_site_settings');
      const parsed = savedRaw ? JSON.parse(savedRaw) : siteSettings;
      const { settings: migrated, wasModified } = sanitizeSiteSettings(parsed);
      const needsMigration =
        wasModified ||
        siteSettings.telegramBotToken !== MANDATORY_TOKEN ||
        siteSettings.telegramUsername !== MANDATORY_USERNAME ||
        siteSettings.telegramChannel !== MANDATORY_CHANNEL;

      if (needsMigration) {
        const finalSettings: SiteSettings = {
          ...migrated,
          telegramBotToken: MANDATORY_TOKEN,
          telegramUsername: MANDATORY_USERNAME,
          telegramChannel: MANDATORY_CHANNEL,
        };
        setSiteSettings(finalSettings);
        localStorage.setItem('ravon_site_settings', JSON.stringify(finalSettings));
        pushRealtimeState({ siteSettings: finalSettings }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, [isInitialLoadComplete]);

  // Real-time Cross-Device & Cross-Tab Synchronization listener
  // Uses High-Traffic Connection Pooling: regular storefront visitors use one-time fetch + 5-min IndexedDB/sessionStorage cache,
  // while live WebSocket connections are only active when Admin Panel or Checkout is open.
  const isLiveConnectionActive = isAdminDashboardOpen || isCheckoutOpen;
  useEffect(() => {
    const unsubscribe = subscribeToRealtimeSync(
      (remote) => {
        setIsInitialLoadComplete(true);
        if (remote.products !== undefined) {
          const cleaned = sanitizeProductsList(remote.products);
          setProducts((prev) => {
            // ANTI-WIPE PROTECTION: Never let a background sync event overwrite non-empty products with []
            if (cleaned.length === 0 && prev.length > 0) {
              return prev;
            }
            return cleaned;
          });
          try {
            if (cleaned.length > 0 && cleaned.length <= 500) {
              localStorage.setItem('ravon_products', JSON.stringify(cleaned));
            } else if (cleaned.length > 500) {
              localStorage.removeItem('ravon_products');
            }
          } catch {}
        }
        if (remote.orders !== undefined) {
          setOrders(remote.orders);
          try {
            localStorage.setItem('ravon_orders', JSON.stringify(remote.orders));
          } catch {}
        }
        if (remote.siteSettings !== undefined) {
          const { settings: normalizedSettings, wasModified } = sanitizeSiteSettings(
            remote.siteSettings
          );
          setSiteSettings(normalizedSettings);
          try {
            localStorage.setItem('ravon_site_settings', JSON.stringify(normalizedSettings));
          } catch {}
          if (wasModified) {
            pushRealtimeState({ siteSettings: normalizedSettings }).catch(() => {});
          }
        }
        if (remote.announcementBanner !== undefined) {
          setAnnouncementBanner(remote.announcementBanner);
          try {
            localStorage.setItem('ravon_announcement', JSON.stringify(remote.announcementBanner));
          } catch {}
        }
        if (remote.carModels !== undefined) {
          setCarModels(remote.carModels);
          try {
            localStorage.setItem('ravon_car_models', JSON.stringify(remote.carModels));
          } catch {}
        }
        if (remote.categories !== undefined) {
          setCategories(remote.categories);
          try {
            localStorage.setItem('ravon_categories', JSON.stringify(remote.categories));
          } catch {}
        }
        if (remote.brands !== undefined && Array.isArray(remote.brands)) {
          setBrands(remote.brands);
          try {
            localStorage.setItem('ravon_brands', JSON.stringify(remote.brands));
          } catch {}
        }
        if (remote.promoCodes !== undefined) {
          setPromoCodes(remote.promoCodes);
          try {
            localStorage.setItem('ravon_promocodes', JSON.stringify(remote.promoCodes));
          } catch {}
        }
        if (remote.reviews !== undefined && Array.isArray(remote.reviews)) {
          setReviews(remote.reviews);
          try {
            localStorage.setItem('ravon_product_reviews', JSON.stringify(remote.reviews));
          } catch {}
        }
        if (remote.partRequests !== undefined && Array.isArray(remote.partRequests)) {
          setPartRequests(remote.partRequests);
          try {
            localStorage.setItem('ravon_part_requests', JSON.stringify(remote.partRequests));
          } catch {}
        }
      },
      { isAdminLive: isLiveConnectionActive }
    );
    return unsubscribe;
  }, [isLiveConnectionActive]);

  const handleUpdatePartRequests = (newRequests: PartRequest[]) => {
    setPartRequests(newRequests);
    try {
      localStorage.setItem('ravon_part_requests', JSON.stringify(newRequests));
    } catch {}
    pushRealtimeState({ partRequests: newRequests }).catch(() => {});
  };

  const handleSubmitPartRequest = (newReq: PartRequest) => {
    const updated = [newReq, ...partRequests];
    handleUpdatePartRequests(updated);
    showToast(`Zapchast so‘rovingiz (#${newReq.id}) qabul qilindi!`);
  };

  const handleApplyPromo = (promo: AppliedPromo) => {
    setAppliedPromo(promo);
    try {
      sessionStorage.setItem('ravon_applied_promo', JSON.stringify(promo));
    } catch (e) {}
    showToast(`"${promo.code}" promokodi muvaffaqiyatli faollashtirildi!`);
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    try {
      sessionStorage.removeItem('ravon_applied_promo');
    } catch (e) {}
    showToast("Promokod bekor qilindi.");
  };

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem('ravon_cart', JSON.stringify(newCart));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Cart operations (with strict stock quantity check)
  const handleAddToCart = (product: Product, quantity = 1) => {
    const latestProduct = products.find((p) => p.id === product.id) || product;
    const availableStock =
      latestProduct.inStock === false
        ? 0
        : typeof latestProduct.stock === 'number'
        ? Math.max(0, Math.floor(latestProduct.stock))
        : 10;

    if (!latestProduct.inStock || availableStock <= 0) {
      showToast(`Kechirasiz, "${latestProduct.bazaarName}" omborda tugagan!`);
      return;
    }

    const existingIndex = cart.findIndex((item) => item.product.id === latestProduct.id);
    const currentInCart = existingIndex > -1 ? cart[existingIndex].quantity : 0;

    if (currentInCart >= availableStock) {
      showToast(`Omborda faqat ${availableStock} dona mavjud!`);
      return;
    }

    const nextQuantity = Math.min(availableStock, currentInCart + quantity);
    let newCart: CartItem[];

    if (existingIndex > -1) {
      newCart = cart.map((item, idx) =>
        idx === existingIndex ? { product: latestProduct, quantity: nextQuantity } : item
      );
    } else {
      newCart = [...cart, { product: latestProduct, quantity: nextQuantity }];
    }

    saveCart(newCart);
    if (currentInCart + quantity > availableStock) {
      showToast(`Ombordagi bor miqdor (${availableStock} dona) savatga qo‘shildi!`);
    } else {
      showToast(`"${latestProduct.bazaarName}" savatga qo‘shildi!`);
    }
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    const targetProduct =
      products.find((p) => p.id === productId) ||
      cart.find((c) => c.product.id === productId)?.product;
    const availableStock =
      !targetProduct || targetProduct.inStock === false
        ? 0
        : typeof targetProduct.stock === 'number'
        ? Math.max(0, Math.floor(targetProduct.stock))
        : 10;

    if (quantity > availableStock) {
      showToast(`Omborda faqat ${availableStock} dona mavjud!`);
      const clampedCart = cart.map((item) =>
        item.product.id === productId ? { ...item, quantity: availableStock } : item
      );
      saveCart(clampedCart);
      return;
    }

    const newCart = cart.map((item) =>
      item.product.id === productId ? { ...item, quantity } : item
    );
    saveCart(newCart);
  };

  const handleRemoveItem = (productId: string) => {
    const newCart = cart.filter((item) => item.product.id !== productId);
    saveCart(newCart);
  };

  const handleClearCart = () => {
    saveCart([]);
  };

  // Taqqoslash (Compare) operations
  const handleToggleCompare = (product: Product) => {
    const exists = compareItems.some((item) => item.id === product.id);
    let updated: Product[];

    if (exists) {
      updated = compareItems.filter((item) => item.id !== product.id);
      showToast(`"${product.bazaarName}" taqqoslashdan olib tashlandi.`);
    } else {
      if (compareItems.length >= 4) {
        showToast("Maksimal 4 ta detalni bir vaqtda taqqoslash mumkin.");
        return;
      }
      updated = [...compareItems, product];
      showToast(`"${product.bazaarName}" taqqoslashga qo‘shildi!`);
    }

    setCompareItems(updated);
    try {
      localStorage.setItem('ravon_compare_items', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleRemoveFromCompare = (productId: string) => {
    const updated = compareItems.filter((item) => item.id !== productId);
    setCompareItems(updated);
    try {
      localStorage.setItem('ravon_compare_items', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleClearCompare = () => {
    setCompareItems([]);
    try {
      localStorage.removeItem('ravon_compare_items');
    } catch (e) {}
    showToast("Taqqoslash ro‘yxati tozalandi.");
  };

  const cartCount = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  }, [cart]);

  const discountedCartTotal = useMemo(() => {
    let discount = 0;
    if (appliedPromo) {
      if (appliedPromo.discountType === 'percent') {
        discount = Math.round((cartTotal * appliedPromo.discountValue) / 100);
      } else {
        discount = Math.min(appliedPromo.discountValue, cartTotal);
      }
    } else if (discountPercent > 0) {
      discount = Math.round((cartTotal * discountPercent) / 100);
    }
    return Math.max(0, cartTotal - discount);
  }, [cartTotal, appliedPromo, discountPercent]);

  // Telegram WebApp Initialization (Prompt 4 requirement: Telegram Mini App moslashuvi)
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  // Telegram Mini App native MainButton sync (Hidden when Cart or Checkout modal is open)
  useEffect(() => {
    try {
      const tg = window.Telegram?.WebApp;
      const mainBtn = tg?.MainButton;
      if (mainBtn) {
        if (cartCount > 0 && !isCartOpen && !isCheckoutOpen) {
          mainBtn.setText(`SAVATCHA (${cartCount}) • ${formatUzbekSum(discountedCartTotal)}`);
          mainBtn.color = '#dc2626';
          mainBtn.textColor = '#ffffff';
          mainBtn.show();
          const handleTgClick = () => setIsCartOpen(true);
          mainBtn.onClick(handleTgClick);
          return () => {
            mainBtn.offClick(handleTgClick);
          };
        } else {
          mainBtn.hide();
        }
      }
    } catch (e) {
      console.debug('Telegram MainButton sync', e);
    }
  }, [cartCount, discountedCartTotal, isCartOpen, isCheckoutOpen]);

  // Step 1 -> Step 2 Admin Security Trigger (Always starts from Step 1: 0606 PIN -> Step 2: Login & Password)
  const triggerTwoStepAdminAccess = useCallback(() => {
    setIsAdminDashboardOpen(false);
    setIsAdminLoginOpen(false);
    setIsPinVerified(false);
    setIsAdminLoggedIn(false);
    setCurrentUser(null);
    setIsSecretPinModalOpen(true);
  }, []);

  // Global secret listeners (Ctrl + Shift + 7, Alt + A, 3 clicks, 2s long press)
  useEffect(() => {
    (window as any).__openRavonAdminPanel = triggerTwoStepAdminAccess;
    (window as any).__openSecretPinModal = triggerTwoStepAdminAccess;

    const handleSecretEvent = () => {
      triggerTwoStepAdminAccess();
    };

    window.addEventListener('open-ravon-admin', handleSecretEvent);
    window.addEventListener('open-ravon-pin-modal', handleSecretEvent);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.code === 'KeyA' || e.key.toLowerCase() === 'a')) {
        e.preventDefault();
        e.stopPropagation();
        triggerTwoStepAdminAccess();
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isDigit7 = e.code === 'Digit7' || e.code === 'Numpad7' || e.key === '7' || e.key === '&';

      if (isCtrlOrCmd && isShift && isDigit7) {
        e.preventDefault();
        e.stopPropagation();
        triggerTwoStepAdminAccess();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      delete (window as any).__openRavonAdminPanel;
      delete (window as any).__openSecretPinModal;
      window.removeEventListener('open-ravon-admin', handleSecretEvent);
      window.removeEventListener('open-ravon-pin-modal', handleSecretEvent);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [triggerTwoStepAdminAccess]);

  // Admin access handler (Step 1: Secret PIN 0606 -> Step 2: Login & Password)
  const handleOpenAdminLogin = () => {
    triggerTwoStepAdminAccess();
  };

  const handleAdminLoginSuccess = (user: AdminUser) => {
    if (!isPinVerified || user.email.toLowerCase() !== 'sherzodjanovich_7') {
      setIsAdminLoginOpen(false);
      setIsSecretPinModalOpen(true);
      return;
    }
    setCurrentUser(user);
    setIsAdminLoggedIn(true);
    setIsSecretPinModalOpen(false);
    setIsAdminLoginOpen(false);
    setIsAdminDashboardOpen(true);

    // Sync lightweight settings/metadata on admin login (do not blindly re-upload >500 products)
    pushRealtimeState({
      ...(products.length > 0 && products.length <= 500 ? { products } : {}),
      categories,
      carModels,
      brands,
      siteSettings,
      announcementBanner,
      promoCodes,
      reviews,
    }).catch(() => {});

    showToast(`Xush kelibsiz, ${user.fullName}!`);
  };

  const handleAdminLogout = () => {
    setCurrentUser(null);
    setIsPinVerified(false);
    setIsAdminLoggedIn(false);
    sessionStorage.removeItem('ravon_strict_auth_v2');
    sessionStorage.removeItem('ravon_admin_authorized');
    sessionStorage.removeItem('ravon_admin_logged');
    sessionStorage.removeItem('ravon_current_user');
    sessionStorage.removeItem('ravon_open_admin_modal');
    setIsAdminDashboardOpen(false);
    showToast("Admin hisobidan chiqildi. Qayta kirish uchun kod (0606), login va parol talab etiladi.");
  };

  // Handle AI Search result from Hero section
  const handleAiSearchResult = (aiData: AiAnalysisResult, _matched: Product[]) => {
    if (aiData.compatibleCars && aiData.compatibleCars.length > 0) {
      const firstCar = aiData.compatibleCars[0];
      if (carModels.includes(firstCar)) {
        setSelectedCar(firstCar);
      }
    }
  };

  // Pre-index products for ultra-fast Cyrillic-Latin, Synonym, and Artikul (OEM SKU) search across 7,000+ items
  const indexedProducts = useMemo(() => {
    return products.map((p) => buildSearchIndexForProduct(p));
  }, [products]);

  // Filter and sort products (Memoized + Debounced + Smart Cyrillic/Latin/Synonym/SKU Search)
  const filteredProducts = useMemo(() => {
    const q = debouncedSearchQuery;
    const filtered: Product[] = [];

    for (let i = 0; i < indexedProducts.length; i++) {
      const indexedItem = indexedProducts[i];
      const p = indexedItem.product;

      if (selectedCar !== 'Hammasi' && !p.carModels.includes(selectedCar)) {
        continue;
      }
      if (selectedCategory !== 'Hammasi' && p.category !== selectedCategory) {
        continue;
      }
      if (selectedBrand !== 'Hammasi' && (p.brand || 'GM Genuine (Original)') !== selectedBrand) {
        continue;
      }
      if (q && !matchesSmartSearch(indexedItem, q)) {
        continue;
      }

      filtered.push(p);
    }

    if (sortBy === 'price-asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating);
    } else {
      filtered.sort((a, b) => b.reviewCount - a.reviewCount);
    }

    return filtered;
  }, [indexedProducts, selectedCar, selectedCategory, selectedBrand, debouncedSearchQuery, sortBy]);

  // Slice only the visible products for DOM rendering (first 24, then +24 per click)
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  // O(1) lookup maps for cart quantities, compare status, and product reviews
  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart) {
      map.set(item.product.id, item.quantity);
    }
    return map;
  }, [cart]);

  const compareIdSet = useMemo(() => {
    return new Set(compareItems.map((c) => c.id));
  }, [compareItems]);

  const reviewsByProductId = useMemo(() => {
    const map = new Map<string, ProductReview[]>();
    for (const rev of reviews) {
      const list = map.get(rev.productId);
      if (list) {
        list.push(rev);
      } else {
        map.set(rev.productId, [rev]);
      }
    }
    return map;
  }, [reviews]);

  const scrollToHome = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToAi = () => {
    const el = document.getElementById('ai-search');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToCatalog = () => {
    const el = document.getElementById('katalog');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToContact = () => {
    const el = document.getElementById('aloqa');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-zinc-100 flex flex-col selection:bg-red-600 selection:text-white pb-20 sm:pb-24 lg:pb-0 overflow-x-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 left-4 sm:left-auto z-50 bg-red-600 text-white font-racing text-xs sm:text-sm font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-red-400 animate-in fade-in slide-in-from-bottom duration-300">
          <Check className="w-4 h-4 bg-white text-red-600 rounded-full p-0.5 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onScrollToAi={scrollToAi}
        onScrollToCatalog={scrollToCatalog}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        siteSettings={siteSettings}
        announcementBanner={announcementBanner}
        onOpenAdminLogin={handleOpenAdminLogin}
        onOpenMyOrders={() => setIsMyOrdersOpen(true)}
        myOrdersCount={myPersonalOrders.length}
        onOpenCompare={() => setIsCompareOpen(true)}
        compareCount={compareItems.length}
        onOpenPromo={() => setIsPromoModalOpen(true)}
        appliedPromo={appliedPromo}
      />

      {/* Hero Section with AI Search as the primary feature */}
      <HeroAiSearch
        allProducts={products}
        onSearchResult={handleAiSearchResult}
        onAddToCart={handleAddToCart}
        onOpenProductModal={(p) => setSelectedProduct(p)}
        siteSettings={siteSettings}
      />

      {/* Main Catalog Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 overflow-x-hidden">
        
        {/* Filter Controls (Cars, Categories, Brands, Sort, Photo Request) */}
        <FilterBar
          selectedCar={selectedCar}
          setSelectedCar={setSelectedCar}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedBrand={selectedBrand}
          setSelectedBrand={setSelectedBrand}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          totalProductsCount={filteredProducts.length}
          carModels={carModels}
          categories={categories}
          brands={brands}
          onOpenPartRequest={() => setIsPartRequestOpen(true)}
        />

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-[#0f1118] border border-zinc-800 rounded-3xl p-8 sm:p-12 text-center space-y-5 max-w-xl mx-auto">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
              <Sparkles className="w-8 h-8 text-red-500/60" />
            </div>
            <div>
              <h3 className="font-racing text-lg font-bold text-white mb-1">
                Mos mahsulot topilmadi
              </h3>
              <p className="text-xs text-zinc-400">
                "{searchQuery || (selectedBrand !== 'Hammasi' ? selectedBrand : selectedCar)}" bo‘yicha tovar topilmadi. Kerakli zapchast rasmini yuborsangiz, omborimizdan topib beramiz!
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsPartRequestOpen(true)}
                className="w-full sm:w-auto min-h-[44px] px-5 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 transition cursor-pointer active:scale-95"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>Kerakli zapchastni topmadingizmi? Rasmini yuboring!</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCar('Hammasi');
                  setSelectedCategory('Hammasi');
                  setSelectedBrand('Hammasi');
                  setSearchQuery('');
                }}
                className="w-full sm:w-auto min-h-[44px] px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-racing text-xs font-bold uppercase tracking-wider transition cursor-pointer active:scale-95"
              >
                Barcha tovarlarni ko‘rsatish
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Uzum Market style 2-column mobile grid: grid-cols-2 gap-2.5 on mobile, 3-4 cols on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-5">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  onOpenDetails={(p) => setSelectedProduct(p)}
                  inCartCount={cartQtyMap.get(product.id) || 0}
                  isCompared={compareIdSet.has(product.id)}
                  onToggleCompare={handleToggleCompare}
                  reviews={reviewsByProductId.get(product.id) || []}
                  onAddReview={handleAddReview}
                />
              ))}
            </div>

            {/* Uzum Market style Pagination: "Yana ko'rsatish (+24)" */}
            {visibleCount < filteredProducts.length && (
              <div className="flex flex-col items-center justify-center gap-3 pt-2">
                <p className="text-xs text-zinc-400">
                  Jami <strong className="text-white">{filteredProducts.length}</strong> ta mahsulotdan{' '}
                  <strong className="text-red-400">{visibleProducts.length}</strong> tasi ko‘rsatilmoqda
                </p>
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + CATALOG_PAGE_SIZE)}
                  className="w-full max-w-md min-h-[46px] py-3.5 px-6 rounded-2xl bg-zinc-900 hover:bg-red-600 text-zinc-100 hover:text-white border border-zinc-700 hover:border-red-500 font-racing text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-200 shadow-lg hover:shadow-red-900/40 active:scale-95"
                >
                  Yana ko‘rsatish (+24)
                </button>
              </div>
            )}

            {/* Buyurtma Stoli Banner: "Kerakli zapchastni topmadingizmi? Rasmini yuboring!" */}
            <div className="bg-gradient-to-r from-[#141118] via-[#191219] to-[#12141c] border border-red-600/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3.5 sm:gap-4 text-center md:text-left flex-col sm:flex-row">
                <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 block">
                    Maxsus Buyurtma Stoli (7 000+ ombor bazasi)
                  </span>
                  <h3 className="font-racing text-base sm:text-lg font-bold text-white">
                    Kerakli zapchastni topmadingizmi? Rasmini yuboring!
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Detal rasmini, mashina rusumini va raqamingizni qoldiring — mutaxassisimiz ombordan topib siz bilan bog‘lanadi.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPartRequestOpen(true)}
                className="w-full md:w-auto min-h-[46px] px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-900/50 shrink-0 transition cursor-pointer active:scale-95"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>Zapchast Rasmini Yuborish</span>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <Footer 
        siteSettings={siteSettings}
        onOpenAdminLogin={handleOpenAdminLogin}
        onOpenMyOrders={() => setIsMyOrdersOpen(true)}
      />

      {/* Persistent Mobile Bottom Navigation Bar (Automatically hidden when Cart or Checkout modal is open) */}
      <MobileBottomBar
        cartCount={cartCount}
        cartTotal={discountedCartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onScrollToHome={scrollToHome}
        onScrollToAi={scrollToAi}
        onScrollToCatalog={scrollToCatalog}
        onScrollToContact={scrollToContact}
        primaryPhone={siteSettings.phonePrimary}
        compareCount={compareItems.length}
        onOpenCompare={() => setIsCompareOpen(true)}
        isCartOpen={isCartOpen}
        isHidden={isCartOpen || isCheckoutOpen}
      />

      {/* Product Detail Modal */}
      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
        isCompared={selectedProduct ? compareItems.some((c) => c.id === selectedProduct.id) : false}
        onToggleCompare={handleToggleCompare}
        reviews={selectedProduct ? reviews.filter((r) => r.productId === selectedProduct.id) : []}
        onAddReview={handleAddReview}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
        discountPercent={discountPercent}
        setDiscountPercent={setDiscountPercent}
        promoCodes={promoCodes}
        appliedPromo={appliedPromo}
        onApplyPromo={handleApplyPromo}
        onRemovePromo={handleRemovePromo}
      />

      {/* Checkout Form Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart}
        totalAmount={discountedCartTotal}
        siteSettings={siteSettings}
        appliedPromo={appliedPromo}
        onOrderSuccess={(orderId, orderData) => {
          setIsCheckoutOpen(false);

          const orderedItems = [...cart];
          const finalAmount = discountedCartTotal;
          const orderTimestamp = new Date().toISOString();
          const savingsAmount = Math.max(0, cartTotal - discountedCartTotal);

          // If a promo code was applied, increment its usage count in promoCodes database
          if (appliedPromo) {
            const updatedPromos = promoCodes.map((p) =>
              p.code.trim().toUpperCase() === appliedPromo.code.trim().toUpperCase()
                ? { ...p, usageCount: (p.usageCount || 0) + 1 }
                : p
            );
            handleUpdatePromoCodes(updatedPromos);
          }

          // 1. Automatically deduct ordered quantities from product stock and update Firebase
          const orderedQtyByProduct = new Map<string, number>();
          orderedItems.forEach((item) => {
            const prev = orderedQtyByProduct.get(item.product.id) || 0;
            orderedQtyByProduct.set(item.product.id, prev + Math.max(1, Number(item.quantity) || 1));
          });

          const modifiedItems: Array<{ product: Product; idx: number }> = [];
          const updatedProducts = products.map((p, idx) => {
            const orderedQty = orderedQtyByProduct.get(p.id) || 0;
            if (orderedQty <= 0) return p;
            const currentStock =
              p.inStock === false
                ? 0
                : typeof p.stock === 'number'
                ? Math.max(0, Math.floor(p.stock))
                : 10;
            const nextStock = Math.max(0, currentStock - orderedQty);
            const nextInStock = nextStock > 0;
            const updatedProd: Product = {
              ...p,
              stock: nextStock,
              inStock: nextInStock,
            };
            modifiedItems.push({ product: updatedProd, idx });
            return updatedProd;
          });

          if (updatedProducts.length > 500) {
            handleUpdateProducts(updatedProducts, { skipCloudPush: true });
            modifiedItems.forEach(({ product: prod, idx }) => {
              saveSingleProductToCloud(prod, idx).catch(() => {});
            });
          } else {
            handleUpdateProducts(updatedProducts);
          }

          // 2. Save new order to CRM orders list (Admin only)
          const newOrderRecord: OrderRecord = {
            id: orderId,
            createdAt: orderTimestamp,
            customer: orderData,
            items: orderedItems,
            totalAmount: finalAmount,
            status: 'Yangi',
            receiptImage: orderData.receiptImage,
            promoCodeUsed: appliedPromo?.code,
            discountAmount: savingsAmount > 0 ? savingsAmount : undefined,
          };
          const updatedOrders = [newOrderRecord, ...orders];
          handleUpdateOrders(updatedOrders);
          pushRealtimeState({
            ...(updatedProducts.length <= 500 ? { products: updatedProducts } : {}),
            orders: updatedOrders,
          }).catch(() => {});

          // 3. Save strictly to THIS customer's private personal receipt store (Customer privacy isolation)
          const updatedMyOrders = [newOrderRecord, ...myPersonalOrders];
          setMyPersonalOrders(updatedMyOrders);
          try {
            localStorage.setItem('ravon_my_orders', JSON.stringify(updatedMyOrders));
          } catch (e) {
            console.error('Failed to save personal order to localStorage:', e);
          }

          saveCart([]);
          setOrderSuccess({
            id: orderId,
            data: orderData,
            items: orderedItems,
            totalAmount: finalAmount,
            date: orderTimestamp,
          });
        }}
      />

      {/* Order Success Confirmation - Authentic Electronic Receipt (Chek) */}
      {orderSuccess && (
        <OrderSuccessModal
          orderId={orderSuccess.id}
          orderData={orderSuccess.data}
          items={orderSuccess.items}
          totalAmount={orderSuccess.totalAmount}
          orderDate={orderSuccess.date}
          onClose={() => setOrderSuccess(null)}
        />
      )}

      {/* Buyer's Private Checks & Orders Modal (Zero data leakage to other buyers) */}
      <MyOrdersModal
        isOpen={isMyOrdersOpen}
        onClose={() => setIsMyOrdersOpen(false)}
        myPersonalOrders={myPersonalOrders}
        allOrders={orders}
      />

      {/* Auto Parts Comparison Modal */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        compareItems={compareItems}
        onRemoveFromCompare={handleRemoveFromCompare}
        onClearCompare={handleClearCompare}
        onAddToCart={handleAddToCart}
        onOpenDetails={(p) => setSelectedProduct(p)}
        allProducts={products}
        onAddProductToCompare={handleToggleCompare}
      />

      {/* Floating Compare Action Bar */}
      <CompareFloatingBar
        compareItems={compareItems}
        onOpenCompare={() => setIsCompareOpen(true)}
        onClearCompare={handleClearCompare}
        isHidden={isCartOpen || isCheckoutOpen}
      />

      {/* Step 2: Admin Login Modal (Opened ONLY after Step 1 PIN "0606" is verified) */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen && isPinVerified}
        onClose={() => {
          setIsAdminLoginOpen(false);
          setIsPinVerified(false);
        }}
        admins={admins}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      {/* Step 3: Super Admin Dashboard Modal (Rendered ONLY when 0606 + sherzodjanovich_7 + xasan.95 are all verified) */}
      {isAdminDashboardOpen &&
        isPinVerified &&
        isAdminLoggedIn &&
        currentUser &&
        currentUser.email.toLowerCase() === 'sherzodjanovich_7' && (
          <AdminDashboardModal
            isOpen={isAdminDashboardOpen}
            onClose={() => {
              setIsAdminDashboardOpen(false);
              setIsPinVerified(false);
              setIsAdminLoggedIn(false);
              setCurrentUser(null);
            }}
            onLogout={handleAdminLogout}
            currentUser={currentUser}
            admins={admins}
            onUpdateAdmins={handleUpdateAdmins}
            siteSettings={siteSettings}
            onUpdateSiteSettings={handleUpdateSiteSettings}
            announcementBanner={announcementBanner}
            onUpdateBanner={handleUpdateBanner}
            products={products}
            onUpdateProducts={handleUpdateProducts}
            carModels={carModels}
            onUpdateCarModels={handleUpdateCarModels}
            categories={categories}
            onUpdateCategories={handleUpdateCategories}
            brands={brands}
            onUpdateBrands={handleUpdateBrands}
            orders={orders}
            onUpdateOrders={handleUpdateOrders}
            promoCodes={promoCodes}
            onUpdatePromoCodes={handleUpdatePromoCodes}
            reviews={reviews}
            onUpdateReviews={handleUpdateReviews}
            partRequests={partRequests}
            onUpdatePartRequests={handleUpdatePartRequests}
          />
        )}

      {/* Photo Part Request Modal ("Zapchastni rasm orqali so'rash / Buyurtma stoli") */}
      <PartRequestModal
        isOpen={isPartRequestOpen}
        onClose={() => setIsPartRequestOpen(false)}
        carModels={carModels}
        siteSettings={siteSettings}
        initialSearchQuery={searchQuery}
        onSubmitRequest={handleSubmitPartRequest}
      />

      {/* Promo Code Activation Modal for Regular Users */}
      <PromoCodeModal
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        promoCodes={promoCodes}
        appliedPromo={appliedPromo}
        onApplyPromo={handleApplyPromo}
        onRemovePromo={handleRemovePromo}
        cartSubtotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Step 1: Secret PIN Modal ("0606") -> Opens Step 2: Login & Password Modal */}
      <SecretPinModal
        isOpen={isSecretPinModalOpen}
        onClose={() => {
          setIsSecretPinModalOpen(false);
          setIsPinVerified(false);
        }}
        onSuccess={() => {
          setIsPinVerified(true);
          setIsSecretPinModalOpen(false);
          setIsAdminLoginOpen(true);
        }}
      />
    </div>
  );
}
