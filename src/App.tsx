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
  AppliedPromo
} from './types';
import { ShoppingBag, Sparkles, Check, Lock } from 'lucide-react';
import { sendTelegramNotification, formatOrderTelegramMessage } from './utils/telegram';
import { MobileBottomBar } from './components/MobileBottomBar';
import { initTelegramWebApp, isTelegramWebApp } from './utils/telegramWebApp';
import { formatUzbekSum } from './utils/formatters';

export default function App() {
  // 1. Site Settings (LocalStorage backed)
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    try {
      const saved = localStorage.getItem('ravon_site_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SITE_SETTINGS;
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

  // 3. Products List (LocalStorage backed)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_products');
      return saved ? JSON.parse(saved) : PRODUCTS;
    } catch {
      return PRODUCTS;
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

  // 5. Orders CRM (LocalStorage backed)
  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_orders');
      return saved ? JSON.parse(saved) : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  });

  // 6. Registered Admins (Role-based access, LocalStorage backed)
  const [admins, setAdmins] = useState<AdminUser[]>(() => {
    try {
      const saved = localStorage.getItem('ravon_admins');
      return saved ? JSON.parse(saved) : INITIAL_ADMINS;
    } catch {
      return INITIAL_ADMINS;
    }
  });

  // Current authenticated admin
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    try {
      const saved = sessionStorage.getItem('ravon_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
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

  // Admin Panel states
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('ravon_admin_logged') === 'true';
  });
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isSecretPinModalOpen, setIsSecretPinModalOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state changes to LocalStorage
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
  };

  const handleUpdateBanner = (newBanner: AnnouncementBanner) => {
    setAnnouncementBanner(newBanner);
    localStorage.setItem('ravon_announcement', JSON.stringify(newBanner));
  };

  const handleUpdateProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    localStorage.setItem('ravon_products', JSON.stringify(newProducts));
  };

  const handleUpdateCarModels = (newModels: string[]) => {
    setCarModels(newModels);
    localStorage.setItem('ravon_car_models', JSON.stringify(newModels));
  };

  const handleUpdateCategories = (newCats: string[]) => {
    setCategories(newCats);
    localStorage.setItem('ravon_categories', JSON.stringify(newCats));
  };

  const handleUpdateOrders = (newOrders: OrderRecord[]) => {
    setOrders(newOrders);
    localStorage.setItem('ravon_orders', JSON.stringify(newOrders));
  };

  const handleUpdatePromoCodes = (newPromos: PromoCode[]) => {
    setPromoCodes(newPromos);
    try {
      localStorage.setItem('ravon_promocodes', JSON.stringify(newPromos));
    } catch (e) {
      console.error('Failed to save promo codes:', e);
    }
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

  // Superadmin direct unlock via secret 0606 code
  const openSuperAdminDirectly = useCallback(() => {
    const superAdmin = admins.find((a) => a.role === 'superadmin') || admins[0];
    setCurrentUser(superAdmin);
    setIsAdminLoggedIn(true);
    sessionStorage.setItem('ravon_admin_authorized', 'true');
    sessionStorage.setItem('ravon_admin_logged', 'true');
    sessionStorage.setItem('ravon_current_user', JSON.stringify(superAdmin));
    setIsAdminLoginOpen(false);
    setIsSecretPinModalOpen(false);
    setIsAdminDashboardOpen(true);
    showToast("Superadmin paneliga xush kelibsiz!");
  }, [admins]);

  // Global secret listeners (Ctrl + Shift + 7, Alt + A, 3 clicks, 2s long press)
  useEffect(() => {
    const handleSecretTrigger = () => {
      const isAuth = sessionStorage.getItem('ravon_admin_authorized') === 'true' || 
                     sessionStorage.getItem('ravon_admin_logged') === 'true';
      if (isAuth) {
        openSuperAdminDirectly();
      } else {
        setIsSecretPinModalOpen(true);
      }
    };

    (window as any).__openRavonAdminPanel = openSuperAdminDirectly;
    (window as any).__openSecretPinModal = handleSecretTrigger;

    const handleSecretEvent = (e: any) => {
      if (e.detail?.code === '0606') {
        openSuperAdminDirectly();
      } else {
        handleSecretTrigger();
      }
    };

    const handlePinModalEvent = () => {
      handleSecretTrigger();
    };

    window.addEventListener('open-ravon-admin', handleSecretEvent);
    window.addEventListener('open-ravon-pin-modal', handlePinModalEvent);

    // Direct React hotkey listener: Alt + A yoki Ctrl + Shift + 7
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + A (or Alt + a)
      if (e.altKey && (e.code === 'KeyA' || e.key.toLowerCase() === 'a')) {
        e.preventDefault();
        e.stopPropagation();
        handleSecretTrigger();
        return;
      }

      // Ctrl + Shift + 7 (or Cmd + Shift + 7)
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isDigit7 = e.code === 'Digit7' || e.code === 'Numpad7' || e.key === '7' || e.key === '&';

      if (isCtrlOrCmd && isShift && isDigit7) {
        e.preventDefault();
        e.stopPropagation();
        handleSecretTrigger();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    // Agar index.html skripti ochish belgisini qoldirgan bo'lsa
    if (sessionStorage.getItem('ravon_open_admin_modal') === 'true') {
      sessionStorage.removeItem('ravon_open_admin_modal');
      openSuperAdminDirectly();
    }

    return () => {
      delete (window as any).__openRavonAdminPanel;
      delete (window as any).__openSecretPinModal;
      window.removeEventListener('open-ravon-admin', handleSecretEvent);
      window.removeEventListener('open-ravon-pin-modal', handlePinModalEvent);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [openSuperAdminDirectly]);

  // Admin access handler
  const handleOpenAdminLogin = () => {
    if (isAdminLoggedIn) {
      setIsAdminDashboardOpen(true);
    } else {
      setIsAdminLoginOpen(true);
    }
  };

  const handleAdminLoginSuccess = (user: AdminUser) => {
    setCurrentUser(user);
    setIsAdminLoggedIn(true);
    sessionStorage.setItem('ravon_admin_authorized', 'true');
    sessionStorage.setItem('ravon_admin_logged', 'true');
    sessionStorage.setItem('ravon_current_user', JSON.stringify(user));
    setIsAdminLoginOpen(false);
    setIsAdminDashboardOpen(true);
    showToast(`Xush kelibsiz, ${user.fullName}!`);
  };

  const handleAdminLogout = () => {
    setCurrentUser(null);
    setIsAdminLoggedIn(false);
    sessionStorage.removeItem('ravon_admin_authorized');
    sessionStorage.removeItem('ravon_admin_logged');
    sessionStorage.removeItem('ravon_current_user');
    sessionStorage.removeItem('ravon_open_admin_modal');
    setIsAdminDashboardOpen(false);
    showToast("Admin hisobidan chiqildi. Qayta kirish uchun parol talab etiladi.");
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
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  onOpenDetails={(p) => setSelectedProduct(p)}
                  inCartCount={inCartItem ? inCartItem.quantity : 0}
                  isCompared={compareItems.some((c) => c.id === product.id)}
                  onToggleCompare={handleToggleCompare}
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

      {/* Admin Login Modal (Email + Password, Google simulation) */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        admins={admins}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      {/* Super Admin Dashboard Modal (Role-Based Access) */}
      <AdminDashboardModal
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
        onLogout={handleAdminLogout}
        currentUser={currentUser || admins[0]}
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

      {/* Secret PIN Modal for Admin Access ("0606") */}
      <SecretPinModal
        isOpen={isSecretPinModalOpen}
        onClose={() => setIsSecretPinModalOpen(false)}
        onSuccess={() => {
          openSuperAdminDirectly();
        }}
      />
    </div>
  );
}
