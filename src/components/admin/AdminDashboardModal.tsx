import React, { useState, useRef, useEffect } from 'react';
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
  Copy
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
  PromoCode
} from '../../types';
import { formatUzbekSum } from '../../utils/formatters';
import { sendTelegramNotification } from '../../utils/telegram';

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
  onUpdateProducts: (products: Product[]) => void;
  carModels: string[];
  onUpdateCarModels: (models: string[]) => void;
  categories: string[];
  onUpdateCategories: (categories: string[]) => void;
  orders: OrderRecord[];
  onUpdateOrders: (orders: OrderRecord[]) => void;
  promoCodes?: PromoCode[];
  onUpdatePromoCodes?: (promoCodes: PromoCode[]) => void;
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
  orders,
  onUpdateOrders,
  promoCodes = [],
  onUpdatePromoCodes,
}) => {
  const isSuperadmin = currentUser.role === 'superadmin' || currentUser.email === 'axiy3735@gmail.com';
  const isManager = currentUser.role === 'manager';

  const [activeTab, setActiveTab] = useState<'crm' | 'settings' | 'ai-add' | 'products' | 'banner' | 'admins' | 'promocodes'>('crm');
  const [toast, setToast] = useState<string | null>(null);

  // TAB 1: Site Settings Form State
  const [tempSettings, setTempSettings] = useState<SiteSettings>(siteSettings);
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
    category: 'Optika',
    carModels: ['Gentra'],
    price: 500000,
    originalPrice: 600000,
    image: '',
    inStock: true,
    rating: 5.0,
    reviewCount: 1,
    badge: 'YANGILIK',
    description: '',
    specs: [],
    tags: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TAB 3: Products Management State
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newCarModelName, setNewCarModelName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  // TAB 4: Banner Form State
  const [tempBanner, setTempBanner] = useState<AnnouncementBanner>(announcementBanner);

  // TAB 5: CRM Filters State
  const [crmStatusFilter, setCrmStatusFilter] = useState<string>('Hammasi');
  const [crmSearch, setCrmSearch] = useState('');

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

  // Fetch active Gemini status on modal open (Must be called unconditionally before any early returns)
  useEffect(() => {
    if (isOpen) {
      fetch('/api/gemini/status')
        .then(res => res.json())
        .then(data => {
          if (data?.maskedKey) {
            setActiveGeminiMaskedKey(data.maskedKey);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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
      const res = await fetch('/api/gemini/test', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setGeminiTestStatus({
          success: true,
          message: `✅ Gemini 3.8 Flash ulanishi muvaffaqiyatli! Server javobi: "${data.message}"`,
        });
        showToast("Gemini 3.8 Flash AI ulanishi muvaffaqiyatli!");
      } else {
        setGeminiTestStatus({
          success: false,
          message: `❌ Xatolik: ${data.error || "Gemini API kaliti javob bermadi"}`,
        });
      }
    } catch (err: any) {
      setGeminiTestStatus({
        success: false,
        message: `❌ Ulanish xatosi: ${err?.message || "Server bilan aloqa uzildi"}`,
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
      const res = await fetch('/api/gemini/update-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newKey: geminiApiKeyInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.maskedKey) setActiveGeminiMaskedKey(data.maskedKey);
        setGeminiApiKeyInput('');
        showToast("Gemini API kaliti yangilandi!");
        setGeminiTestStatus({
          success: true,
          message: "✅ Yangi kalit serverda o'rnatildi! Tekshirish uchun quyidagi test tugmasini bosing.",
        });
      } else {
        showToast(data.error || "Kalitni yangilashda xatolik yuz berdi");
      }
    } catch (err: any) {
      showToast(err?.message || "Server bilan bog'lanishda xatolik yuz berdi");
    } finally {
      setIsUpdatingGeminiKey(false);
    }
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSiteSettings(tempSettings);
    showToast("Sayt sozlamalari muvaffaqiyatli saqlandi!");
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
      const response = await fetch('/api/analyze-part', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: aiImage.startsWith('data:') ? aiImage : undefined,
          imageUrl: !aiImage.startsWith('data:') ? aiImage : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "AI tahlilida xatolik yuz berdi");
      }

      const res: AiAnalysisResult = data.data;

      let estPrice = 500000;
      if (res.estimatedPriceRange) {
        const matches = res.estimatedPriceRange.replace(/\s+/g, '').match(/\d+/g);
        if (matches && matches[0]) {
          const parsed = parseInt(matches[0], 10);
          if (parsed > 10000) estPrice = parsed;
        }
      }

      setNewProduct(prev => ({
        ...prev,
        name: res.partName || prev.name,
        bazaarName: res.bazaarName || prev.bazaarName,
        category: res.category || prev.category || 'Optika',
        carModels: res.compatibleCars && res.compatibleCars.length > 0 ? res.compatibleCars : ['Gentra'],
        description: res.description + (res.tuningTips ? ` (Usta tavsiyasi: ${res.tuningTips})` : ''),
        tags: res.searchKeywords || ['tyuning', 'zapchast'],
        price: estPrice,
        originalPrice: Math.round(estPrice * 1.15),
        image: aiImage,
      }));

      showToast("Gemini AI detal ma'lumotlarini avtomatik to'ldirdi!");
    } catch (err: any) {
      console.error(err);
      setAiError(err?.message || "AI bilan bog'lanishda xatolik yuz berdi");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setAiImage(b64);
      setNewProduct(prev => ({ ...prev, image: b64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) {
      showToast("Iltimos, mahsulot nomi va narxini to'ldiring.");
      return;
    }

    const created: Product = {
      id: 'ravon-' + Date.now(),
      name: newProduct.name || 'Yangi Zapchast',
      bazaarName: newProduct.bazaarName || newProduct.name || 'Zapchast',
      category: newProduct.category || 'Optika',
      carModels: newProduct.carModels && newProduct.carModels.length > 0 ? newProduct.carModels : ['Gentra'],
      price: Number(newProduct.price) || 0,
      originalPrice: newProduct.originalPrice ? Number(newProduct.originalPrice) : undefined,
      image: newProduct.image || 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80',
      inStock: newProduct.inStock ?? true,
      rating: 5.0,
      reviewCount: 1,
      badge: newProduct.badge || 'YANGILIK',
      description: newProduct.description || '',
      specs: [
        { label: 'Mos modellar', value: (newProduct.carModels || []).join(', ') },
        { label: 'Kategoriya', value: newProduct.category || 'Optika' },
        { label: 'Kafolat', value: '14 kun tekshirish kafolati' },
      ],
      tags: newProduct.tags || ['zapchast', 'tyuning'],
    };

    onUpdateProducts([created, ...products]);
    showToast(`"${created.name}" katalogga qo‘shildi!`);

    setAiImage('');
    setNewProduct({
      name: '',
      bazaarName: '',
      category: 'Optika',
      carModels: ['Gentra'],
      price: 500000,
      originalPrice: 600000,
      image: '',
      inStock: true,
      badge: 'YANGILIK',
      description: '',
      tags: [],
    });
    setActiveTab('products');
  };

  // Product edits
  const handleToggleStock = (productId: string) => {
    const updated = products.map(p => p.id === productId ? { ...p, inStock: !p.inStock } : p);
    onUpdateProducts(updated);
    showToast("Mahsulot ombor holati o'zgartirildi!");
  };

  const handleDeleteProduct = (productId: string, name: string) => {
    const updated = products.filter(p => p.id !== productId);
    onUpdateProducts(updated);
    showToast(`"${name}" mahsuloti o'chirildi!`);
  };

  const handleSaveProductEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const updated = products.map(p => p.id === editingProduct.id ? editingProduct : p);
    onUpdateProducts(updated);
    setEditingProduct(null);
    showToast("Mahsulot muvaffaqiyatli yangilandi!");
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

  // Filtered lists
  const filteredProductList = products.filter(p => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.bazaarName.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      <div 
        className="w-full max-w-6xl h-[92vh] bg-[#0c0e14] border border-red-600/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast Alert */}
        {toast && (
          <div className="absolute top-20 right-6 z-50 bg-red-600 text-white font-racing text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl border border-red-400 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
            <Check className="w-4 h-4 bg-white text-red-600 rounded-full p-0.5" />
            <span>{toast}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-red-950 via-zinc-950 to-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-900/50">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-racing text-lg sm:text-xl font-bold text-white tracking-wide">
                  RAVON AUTO BOSHQARUV PANELI
                </span>
                {isSuperadmin ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md shadow-red-950">
                    <Crown className="w-3 h-3 text-amber-200" />
                    BOSH SUPERADMIN
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-bold">
                    {currentUser.role === 'full_admin' ? 'Katta Admin' : 'Menejer'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                Foydalanuvchi: <strong className="text-zinc-200">{currentUser.fullName}</strong> ({currentUser.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Admin seansidan chiqish"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Chiqish</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-red-600 text-zinc-400 hover:text-white border border-zinc-800 transition"
              title="Yopish va do'konni ko'rish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar (RBAC Filtered) */}
        <div className="bg-[#10121a] border-b border-zinc-800 px-4 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0 py-2">
          {/* CRM: visible to all roles */}
          <button
            onClick={() => setActiveTab('crm')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition ${
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

          {/* AI Add Product: visible to all roles */}
          <button
            onClick={() => setActiveTab('ai-add')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition ${
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
            onClick={() => setActiveTab('products')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition ${
              activeTab === 'products'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-900/40 border border-red-500'
                : 'bg-zinc-900/80 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Package className={`w-4 h-4 ${activeTab === 'products' ? 'text-white' : 'text-red-400'}`} />
            <span>Mahsulotlar va Kategoriyalar</span>
          </button>

          {/* Banner: visible to superadmin and full_admin */}
          {!isManager && (
            <button
              onClick={() => setActiveTab('banner')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition ${
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
            onClick={() => setActiveTab('promocodes')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition ${
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
              onClick={() => setActiveTab('settings')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition ${
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
              onClick={() => setActiveTab('admins')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide flex items-center gap-2 shrink-0 transition ${
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
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#090b10]">
          
          {/* TAB: ADMINLARNI BOSHQARISH (FAQAT SUPERADMIN axiy3735@gmail.com UCHUN) */}
          {activeTab === 'admins' && isSuperadmin && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
              
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
            <form onSubmit={handleSaveSettings} className="max-w-4xl mx-auto space-y-6">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                      placeholder="8606681013:AAHtKlObBKbcOQWLP-rjnImGJqOAc3moljY"
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
                        href="https://t.me/ravon_tuning_uz_bot" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-400 hover:text-blue-300 font-mono font-bold hover:underline"
                      >
                        @ravon_tuning_uz_bot ↗
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
                      href="https://t.me/ravon_tuning_uz_bot"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center gap-1.5 transition border border-zinc-700"
                    >
                      <span>Botni ochish</span>
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
            <div className="max-w-4xl mx-auto space-y-6">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-300 font-semibold mb-1">Ombordagi holati</label>
                      <select
                        value={newProduct.inStock ? 'true' : 'false'}
                        onChange={(e) => setNewProduct({ ...newProduct, inStock: e.target.value === 'true' })}
                        className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-zinc-200"
                      >
                        <option value="true">Sotuvda bor (Omborda mavjud)</option>
                        <option value="false">Tugagan (Sotuvda yo'q)</option>
                      </select>
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
              
              {/* Car Models & Categories Management sub-section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        placeholder="Yangi model (masalan: Captiva, Monza)..."
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
              </div>

              {/* Products List & Search */}
              <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-racing text-base font-bold text-white">
                      Mavjud Zapchastlar Ro‘yxati ({products.length} ta)
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Narxlarni tahrirlash, "Sotuvda yo'q" qilish yoki butunlay o'chirish
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Nomi bo‘yicha qidirish..."
                        className="bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-1.5 pl-8 text-xs text-white"
                      />
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>

                    <button
                      onClick={() => setActiveTab('ai-add')}
                      className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Yangi qo‘shish</span>
                    </button>
                  </div>
                </div>

                {/* Products Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                      <tr>
                        <th className="p-3">Rasm</th>
                        <th className="p-3">Nomi & Bozor Laqabi</th>
                        <th className="p-3">Kategoriya</th>
                        <th className="p-3">Mos modellar</th>
                        <th className="p-3">Narxi</th>
                        <th className="p-3">Holati</th>
                        <th className="p-3 text-right">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {filteredProductList.map(prod => (
                        <tr key={prod.id} className="hover:bg-zinc-900/40 transition">
                          <td className="p-3">
                            <img 
                              src={prod.image} 
                              alt={prod.name} 
                              className="w-12 h-12 rounded-lg object-cover border border-zinc-700 bg-black"
                            />
                          </td>
                          <td className="p-3 max-w-[220px]">
                            <div className="font-bold text-white truncate">{prod.name}</div>
                            <div className="text-[11px] text-red-400 font-bold">"{prod.bazaarName}"</div>
                          </td>
                          <td className="p-3 text-zinc-300">{prod.category}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
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
                            <button
                              onClick={() => handleToggleStock(prod.id)}
                              className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition ${
                                prod.inStock
                                  ? 'bg-green-950 text-green-400 border border-green-800'
                                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              }`}
                            >
                              {prod.inStock ? 'Sotuvda bor' : 'Tugagan'}
                            </button>
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
                      ))}
                    </tbody>
                  </table>
                </div>
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

                      <div className="grid grid-cols-2 gap-3">
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

                      <div>
                        <label className="block text-zinc-300 mb-1">Rasm URL havolasi</label>
                        <input
                          type="text"
                          value={editingProduct.image}
                          onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono text-[11px]"
                        />
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

            </div>
          )}

          {/* TAB 4: AKSIYA VA E'LONLAR BANNERI */}
          {activeTab === 'banner' && !isManager && (
            <form onSubmit={handleSaveBanner} className="max-w-3xl mx-auto space-y-6">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              
              {/* CRM Top Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#12141e] border border-zinc-800">
                  <div className="text-xs text-zinc-400">Jami Buyurtmalar</div>
                  <div className="text-2xl font-racing font-bold text-white mt-1">
                    {orders.length} ta
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-red-950/30 border border-red-900/60">
                  <div className="text-xs text-red-300">Yangi Buyurtmalar</div>
                  <div className="text-2xl font-racing font-bold text-red-400 mt-1">
                    {orders.filter(o => o.status === 'Yangi').length} ta
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-900/60">
                  <div className="text-xs text-amber-300">Yetkazilmoqda</div>
                  <div className="text-2xl font-racing font-bold text-amber-400 mt-1">
                    {orders.filter(o => o.status === 'Yetkazilmoqda').length} ta
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-green-950/30 border border-green-900/60">
                  <div className="text-xs text-green-300">Bajarildi</div>
                  <div className="text-2xl font-racing font-bold text-green-400 mt-1">
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
                    return (
                      <div 
                        key={order.id}
                        className="bg-[#12141e] border border-zinc-800 hover:border-zinc-750 rounded-2xl p-5 space-y-4 shadow-lg transition"
                      >
                        {/* Order Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                          <div className="flex items-center gap-3">
                            <span className="font-racing font-black text-sm text-red-400">
                              #{order.id}
                            </span>
                            <span className="text-xs text-zinc-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(order.createdAt).toLocaleString('uz-UZ')}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-zinc-900 text-zinc-300 border-zinc-700">
                              {order.customer.deliveryMethod === 'courier' ? 'Kuryer' : order.customer.deliveryMethod === 'post' ? 'BTS/Fargo Pochta' : 'Sergeli Olib ketish'}
                            </span>
                          </div>

                          {/* Status Dropdown */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400">Holat:</span>
                            <select
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as OrderStatus)}
                              className={`rounded-xl px-3 py-1.5 text-xs font-bold font-racing cursor-pointer border ${
                                order.status === 'Yangi'
                                  ? 'bg-red-950 text-red-300 border-red-700'
                                  : order.status === 'Yetkazilmoqda'
                                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                                  : order.status === 'Bajarildi'
                                  ? 'bg-green-950 text-green-300 border-green-700'
                                  : 'bg-zinc-900 text-zinc-400 border-zinc-750'
                              }`}
                            >
                              <option value="Yangi">🔴 Yangi</option>
                              <option value="Yetkazilmoqda">🟡 Yetkazilmoqda</option>
                              <option value="Bajarildi">🟢 Bajarildi</option>
                              <option value="Bekor qilindi">⚪ Bekor qilindi</option>
                            </select>
                          </div>
                        </div>

                        {/* Customer & Address & Quick Actions */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
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

                          {/* Col 3: 1-click Contact Buttons */}
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

        </div>
      </div>
    </div>
  );
};
