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
  INITIAL_ORDERS,
  INITIAL_ADMINS,
  DEFAULT_PROMO_CODES
} from './data/initialData';
import { 
  Product, 
  CartItem, 
  CarModel, 
  ProductCategory, 
  AiAnalysisResult, 
  OrderForm, 
  SiteSettings, 
  AnnouncementBanner, 
  OrderRecord,
  AdminUser,
  PromoCode,
  AppliedPromo,
  ProductReview
} from './types';
import { ShoppingBag, Sparkles, Check, Lock } from 'lucide-react';
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
} from './services/supabaseSync';

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

  // 3. Products List (LocalStorage backed - never reload static products like Zimmer if empty/cleared)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_products');
      if (!saved) {
        return [];
      }
      const parsed = JSON.parse(saved);
      const cleaned = sanitizeProductsList(parsed);
      if (Array.isArray(parsed) && cleaned.length !== parsed.length) {
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

  // Filters state
  const [selectedCar, setSelectedCar] = useState<CarModel>('Hammasi');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('Hammasi');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [discountPercent, setDiscountPercent] = useState(0);

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

  const handleUpdateProducts = (newProducts: Product[]) => {
    const cleaned = sanitizeProductsList(newProducts);
    setProducts(cleaned);
    localStorage.setItem('ravon_products', JSON.stringify(cleaned));
    pushRealtimeState({ products: cleaned });
  };

  const handleUpdateCarModels = (newModels: string[]) => {
    setCarModels(newModels);
    localStorage.setItem('ravon_car_models', JSON.stringify(newModels));
    pushRealtimeState({ carModels: newModels });
  };

  const handleUpdateCategories = (newCats: string[]) => {
    setCategories(newCats);
    localStorage.setItem('ravon_categories', JSON.stringify(newCats));
    pushRealtimeState({ categories: newCats });
  };

  const handleUpdateOrders = (newOrders: OrderRecord[]) => {
    setOrders(newOrders);
    localStorage.setItem('ravon_orders', JSON.stringify(newOrders));
    pushRealtimeState({ orders: newOrders });
  };

  const handleUpdatePromoCodes = (newPromos: PromoCode[]) => {
    setPromoCodes(newPromos);
    try {
      localStorage.setItem('ravon_promocodes', JSON.stringify(newPromos));
      pushRealtimeState({ promoCodes: newPromos });
    } catch (e) {
      console.error('Failed to save promo codes:', e);
    }
  };

  const handleUpdateReviews = (newReviews: ProductReview[]) => {
    setReviews(newReviews);
    try {
      localStorage.setItem('ravon_product_reviews', JSON.stringify(newReviews));
      pushRealtimeState({ reviews: newReviews });
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
      localStorage.setItem('ravon_products', JSON.stringify(updatedProducts));
    } catch {}
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

  // Real-time Cross-Device & Cross-Tab Synchronization listener
  useEffect(() => {
    const unsubscribe = subscribeToRealtimeSync((remote) => {
      if (remote.products !== undefined) {
        const cleaned = sanitizeProductsList(remote.products);
        setProducts(cleaned);
        try {
          localStorage.setItem('ravon_products', JSON.stringify(cleaned));
        } catch {}
      }
      if (remote.orders !== undefined) {
        setOrders(remote.orders);
        try {
          localStorage.setItem('ravon_orders', JSON.stringify(remote.orders));
        } catch {}
      }
      if (remote.siteSettings !== undefined) {
        const { settings: normalizedSettings } = sanitizeSiteSettings(remote.siteSettings);
        setSiteSettings(normalizedSettings);
        try {
          localStorage.setItem('ravon_site_settings', JSON.stringify(normalizedSettings));
        } catch {}
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
    });
    return unsubscribe;
  }, []);

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

  // Cart operations
  const handleAddToCart = (product: Product, quantity = 1) => {
    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    let newCart: CartItem[];

    if (existingIndex > -1) {
      newCart = cart.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
      );
    } else {
      newCart = [...cart, { product, quantity }];
    }

    saveCart(newCart);
    showToast(`"${product.bazaarName}" savatga qo‘shildi!`);
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
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

  // Telegram Mini App native MainButton sync
  useEffect(() => {
    try {
      const tg = window.Telegram?.WebApp;
      const mainBtn = tg?.MainButton;
      if (mainBtn) {
        if (cartCount > 0 && !isCheckoutOpen) {
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
  }, [cartCount, discountedCartTotal, isCheckoutOpen]);

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

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Car model filter
    if (selectedCar !== 'Hammasi') {
      result = result.filter((p) => p.carModels.includes(selectedCar));
    }

    // Category filter
    if (selectedCategory !== 'Hammasi') {
      result = result.filter((p) => p.category === selectedCategory);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const matchName = p.name.toLowerCase().includes(q);
        const matchBazaar = p.bazaarName.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const matchTags = p.tags.some((t) => t.toLowerCase().includes(q));
        const matchCars = p.carModels.some((c) => c.toLowerCase().includes(q));
        return matchName || matchBazaar || matchDesc || matchTags || matchCars;
      });
    }

    // Sorting
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else {
      // popular
      result.sort((a, b) => b.reviewCount - a.reviewCount);
    }

    return result;
  }, [products, selectedCar, selectedCategory, searchQuery, sortBy]);

  const scrollToAi = () => {
    const el = document.getElementById('ai-search');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToCatalog = () => {
    const el = document.getElementById('katalog');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-zinc-100 flex flex-col selection:bg-red-600 selection:text-white pb-24 lg:pb-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-600 text-white font-racing text-xs sm:text-sm font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-red-400 animate-in fade-in slide-in-from-bottom duration-300">
          <Check className="w-4 h-4 bg-white text-red-600 rounded-full p-0.5" />
          <span>{toastMessage}</span>
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Filter Controls (Cars, Categories, Sort) */}
        <FilterBar
          selectedCar={selectedCar}
          setSelectedCar={setSelectedCar}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          totalProductsCount={filteredProducts.length}
          carModels={carModels}
          categories={categories}
        />

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-[#0f1118] border border-zinc-800 rounded-3xl p-12 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
              <Sparkles className="w-8 h-8 text-red-500/60" />
            </div>
            <div>
              <h3 className="font-racing text-lg font-bold text-white mb-1">
                Mos mahsulot topilmadi
              </h3>
              <p className="text-xs text-zinc-400">
                "{searchQuery || selectedCar}" bo‘yicha tovar topilmadi yoki filtrni tozalab ko‘ring.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedCar('Hammasi');
                setSelectedCategory('Hammasi');
                setSearchQuery('');
              }}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-racing text-xs font-bold uppercase tracking-wider transition"
            >
              Barcha tovarlarni ko‘rsatish
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProducts.map((product) => {
              const inCartItem = cart.find((i) => i.product.id === product.id);
              const productReviews = reviews.filter((r) => r.productId === product.id);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  onOpenDetails={(p) => setSelectedProduct(p)}
                  inCartCount={inCartItem ? inCartItem.quantity : 0}
                  isCompared={compareItems.some((c) => c.id === product.id)}
                  onToggleCompare={handleToggleCompare}
                  reviews={productReviews}
                  onAddReview={handleAddReview}
                />
              );
            })}
          </div>
        )}

      </main>

      {/* Footer */}
      <Footer 
        siteSettings={siteSettings}
        onOpenAdminLogin={handleOpenAdminLogin}
        onOpenMyOrders={() => setIsMyOrdersOpen(true)}
      />

      {/* Persistent Mobile Bottom Navigation Bar (Prompt 4 requirement: Pastki qismdagi savatcha tugmasi doim ko'rinib tursin) */}
      <MobileBottomBar
        cartCount={cartCount}
        cartTotal={discountedCartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onScrollToAi={scrollToAi}
        onScrollToCatalog={scrollToCatalog}
        primaryPhone={siteSettings.phonePrimary}
        compareCount={compareItems.length}
        onOpenCompare={() => setIsCompareOpen(true)}
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

          // 1. Save new order to CRM orders list (Admin only)
          const newOrderRecord: OrderRecord = {
            id: orderId,
            createdAt: orderTimestamp,
            customer: orderData,
            items: orderedItems,
            totalAmount: finalAmount,
            status: 'Yangi',
            promoCodeUsed: appliedPromo?.code,
            discountAmount: savingsAmount > 0 ? savingsAmount : undefined,
          };
          const updatedOrders = [newOrderRecord, ...orders];
          handleUpdateOrders(updatedOrders);

          // 2. Save strictly to THIS customer's private personal receipt store (Customer privacy isolation)
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
            orders={orders}
            onUpdateOrders={handleUpdateOrders}
            promoCodes={promoCodes}
            onUpdatePromoCodes={handleUpdatePromoCodes}
            reviews={reviews}
            onUpdateReviews={handleUpdateReviews}
          />
        )}

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
