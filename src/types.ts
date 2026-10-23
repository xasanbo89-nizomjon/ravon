export type CarModel = string;
export type ProductCategory = string;
export type ProductBrand = string;

export interface Product {
  id: string;
  name: string;
  bazaarName: string;
  brand?: string;
  carModels: string[];
  category: string;
  price: number; // in UZS (so'm)
  originalPrice?: number;
  image: string;
  inStock: boolean;
  rating: number;
  reviewCount: number;
  badge?: string;
  description: string;
  specs: { label: string; value: string }[];
  tags: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderForm {
  fullName: string;
  phone: string;
  region: string;
  cityAddress: string;
  deliveryMethod: 'courier' | 'post' | 'pickup';
  paymentMethod: 'click' | 'payme' | 'cash';
  notes: string;
  telegramUserId?: number | string;
  telegramUsername?: string;
}

export type OrderStatus = 'Yangi' | 'Yetkazilmoqda' | 'Bajarildi' | 'Bekor qilindi';

export type AdminRole = 'superadmin' | 'full_admin' | 'manager';

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: AdminRole;
  isBlocked: boolean;
  createdAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number; // percent (e.g. 10) or sum in UZS (e.g. 50000)
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  description?: string;
  isActive: boolean;
  usageCount: number;
  maxUses?: number;
  createdAt: string;
  expiresAt?: string;
}

export interface AppliedPromo {
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  discountAmount: number;
  description?: string;
}

export interface OrderRecord {
  id: string;
  createdAt: string;
  customer: OrderForm;
  items: CartItem[];
  totalAmount: number;
  status: OrderStatus;
  promoCodeUsed?: string;
  discountAmount?: number;
}

export interface SiteSettings {
  shopName: string;
  brandLogoWord1: string;
  brandLogoWord2: string;
  heroTitlePrefix: string;
  heroTitleHighlight: string;
  heroSubtitle: string;
  phonePrimary: string;
  phoneSecondary: string;
  workingHours: string;
  addressCity: string;
  addressBazaar: string;
  addressDetails: string;
  mapLocationUrl: string;
  telegramChannel: string;
  telegramUsername: string;
  instagramUrl: string;
  deliveryCost: number;
  freeDeliveryThreshold: number;
  paymentCardNumber: string;
  paymentCardHolder: string;
  paymentCardBank: string;
  telegramBotToken: string;
  telegramAdminChatId: string;
}

export interface AnnouncementBanner {
  enabled: boolean;
  badgeText: string;
  text: string;
  linkText?: string;
  linkUrl?: string;
}

export interface AiAnalysisResult {
  partName: string;
  bazaarName: string;
  brand?: string;
  category: string;
  compatibleCars: string[];
  estimatedPriceRange: string;
  description: string;
  tuningTips: string;
  searchKeywords: string[];
  confidenceScore?: number;
}

export interface ProductReview {
  id: string;
  productId: string;
  productName: string;
  productBazaarName?: string;
  customerName: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
  isApproved: boolean;
}

