import { SiteSettings, AnnouncementBanner, OrderRecord, PromoCode, AdminUser } from '../types';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  shopName: 'Ravon Auto Tuning',
  brandLogoWord1: 'RAVON',
  brandLogoWord2: 'AUTO',
  heroTitlePrefix: 'Zapchast nomini bilmaysizmi?',
  heroTitleHighlight: 'Rasmini yuklang, AI topib beradi!',
  heroSubtitle: 'Gentra, Cobalt, Nexia 3, Spark, Malibu, Onix va Damas ehtiyot qismlari hamda ommabop tyuning detallarini sun\'iy intellekt orqali 2 soniyada aniqlang!',
  phonePrimary: '+998 (95) 463-37-36',
  phoneSecondary: '+998 (95) 463-37-36',
  workingHours: '08:30 - 20:00 (Dam olishsiz)',
  addressCity: 'Namangan viloyati, Uychi tumani',
  addressBazaar: 'Namangan viloyati, Uychi tumani',
  addressDetails: 'Namangan viloyati, Uychi tumani • Ravon Auto Tuning markazi',
  mapLocationUrl: 'https://maps.google.com/?q=Namangan+viloyati,+Uychi+tumani',
  telegramChannel: 'https://t.me/Doliyev_dilshod',
  telegramUsername: 'Doliyev_dilshod',
  instagramUrl: 'https://instagram.com/ravon_autotuning',
  whatsappUrl: 'https://wa.me/998954633736',
  deliveryCost: 35000,
  freeDeliveryThreshold: 1000000,
  paymentCardNumber: '8600 4904 1234 5678',
  paymentCardHolder: 'RAVON AUTO TUNING',
  paymentCardBank: 'Kapitalbank / TBC Bank',
  telegramBotToken: '8606681013:AAHtKlObBKbcOQWLP-rjnImGJqOAc3moljY',
  telegramAdminChatId: '6664036733',
};

export const DEFAULT_BANNER: AnnouncementBanner = {
  enabled: true,
  badgeText: '🔥 QAYNOQ AKSIYA',
  text: 'Barcha Gentra va Cobalt tyuning mahsulotlariga maxsus chegirma! RAVON10 promokodidan foydalaning.',
  linkText: 'Katalogga o‘tish',
  linkUrl: '#katalog',
};

export const DEFAULT_CAR_MODELS = [
  'Hammasi',
  'Gentra',
  'Cobalt',
  'Nexia 3',
  'Spark',
  'Malibu',
  'Tracker',
  'Onix',
  'Damas',
];

export const DEFAULT_CATEGORIES = [
  'Hammasi',
  'Optika',
  'Salon',
  'Kuzov',
  'Xodovoy',
  'Elektronika',
  'Aksessuarlar',
];

/**
 * Legacy test order IDs that must be stripped from localStorage and sync state.
 */
export const DEMO_ORDER_IDS = new Set<string>([
  'RAV-849201',
  'RAV-629143',
  'RAV-419082',
]);

/**
 * Empty initial orders so temporary test data never appears.
 */
export const INITIAL_ORDERS: OrderRecord[] = [];

export const INITIAL_ADMINS: AdminUser[] = [
  {
    id: 'superadmin-sherzod',
    fullName: 'Bosh Superadmin (@Sherzodjanovich_7)',
    email: 'sherzodjanovich_7',
    password: 'xasan.95',
    role: 'superadmin',
    isBlocked: false,
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_PROMO_CODES: PromoCode[] = [
  {
    id: 'promo-1',
    code: 'RAVON10',
    discountType: 'percent',
    discountValue: 10,
    minOrderAmount: 0,
    description: 'Barcha avto tyuning va ehtiyot qismlarga 10% doimiy chegirma',
    isActive: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
];
