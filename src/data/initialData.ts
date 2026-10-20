import { SiteSettings, AnnouncementBanner, OrderRecord, PromoCode } from '../types';
import { PRODUCTS } from './products';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  shopName: 'Ravon Auto Tuning',
  brandLogoWord1: 'RAVON',
  brandLogoWord2: 'AUTO',
  heroTitlePrefix: 'Zapchast nomini bilmaysizmi?',
  heroTitleHighlight: 'Rasmini yuklang, AI topib beradi!',
  heroSubtitle: 'Gentra, Cobalt, Nexia 3, Spark, Malibu, Onix va Damas ehtiyot qismlari hamda ommabop tyuning detallarini (Optra stop, Amerikanka, Malibu bar, Mers deflektor, Zimmer LED) sun\'iy intellekt orqali 2 soniyada aniqlang!',
  phonePrimary: '+998 95 463-37-36',
  phoneSecondary: '+998 71 200-00-00',
  workingHours: '08:30 - 20:00 (Dam olishsiz)',
  addressCity: 'Toshkent shahri, Sergeli tumani',
  addressBazaar: 'Avtomobil ehtiyot qismlari bozori (Moshina bozor)',
  addressDetails: '4-blok, 18-do‘kon (Tyuning va optika qatori)',
  mapLocationUrl: 'https://maps.google.com/?q=41.2285,69.2155',
  telegramChannel: 'https://t.me/RavonAutoTuningUz',
  telegramUsername: 'RavonAutoTuningUz',
  instagramUrl: 'https://instagram.com/ravon_autotuning',
  whatsappUrl: 'https://wa.me/998901234567',
  deliveryCost: 35000,
  freeDeliveryThreshold: 1000000,
  paymentCardNumber: '8600 4904 1234 5678',
  paymentCardHolder: 'SARDOR R. (RAVON AUTO)',
  paymentCardBank: 'Kapitalbank / TBC Bank',
  telegramBotToken: '8606681013:AAHtKlObBKbcOQWLP-rjnImGJqOAc3moljY',
  telegramAdminChatId: '6664036733',
};

export const DEFAULT_BANNER: AnnouncementBanner = {
  enabled: true,
  badgeText: '🔥 QAYNOQ AKSIYA',
  text: 'Barcha Gentra va Cobalt tyuning mahsulotlariga 15% chegirma! RAVON10 promokodidan foydalaning.',
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

export const INITIAL_ORDERS: OrderRecord[] = [
  {
    id: 'RAV-849201',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    customer: {
      fullName: 'Jasur Bekmirzayev',
      phone: '+998 93 456-78-90',
      region: 'Toshkent shahri',
      cityAddress: 'Yunusobod 14-mavze, 22-uy (mo‘ljal: Mega Planet)',
      deliveryMethod: 'courier',
      paymentMethod: 'click',
      notes: 'Cobalt 2022 avtomat oq rang, kunduz kuni yetkazing',
    },
    items: [
      { product: PRODUCTS[2], quantity: 1 }, // Malibu 2 rul
      { product: PRODUCTS[7], quantity: 1 }, // Zimmer LED
    ],
    totalAmount: 1900000,
    status: 'Yangi',
  },
  {
    id: 'RAV-629143',
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    customer: {
      fullName: 'Anvar Qodirov',
      phone: '+998 90 998-11-22',
      region: 'Samarqand viloyati',
      cityAddress: 'Samarqand sh., Registon ko‘chasi 15-uy',
      deliveryMethod: 'post',
      paymentMethod: 'payme',
      notes: 'Gentra 2023 qora lak',
    },
    items: [
      { product: PRODUCTS[0], quantity: 1 }, // Optra stop
      { product: PRODUCTS[1], quantity: 1 }, // Amerikanka fara
    ],
    totalAmount: 2050000,
    status: 'Yetkazilmoqda',
  },
  {
    id: 'RAV-419082',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    customer: {
      fullName: 'Dilshod Islomov',
      phone: '+998 97 123-99-88',
      region: 'Farg‘ona viloyati',
      cityAddress: 'Qo‘qon shahri, Istiqlol ko‘chasi 4',
      deliveryMethod: 'post',
      paymentMethod: 'cash',
      notes: 'Mers deflektor RGB pulti bilan bo‘lsin',
    },
    items: [
      { product: PRODUCTS[4], quantity: 1 }, // Mers deflektor
      { product: PRODUCTS[9], quantity: 1 }, // 7D polik
    ],
    totalAmount: 830000,
    status: 'Bajarildi',
  },
];

export const INITIAL_ADMINS = [
  {
    id: 'superadmin-master',
    fullName: 'Bosh Super Admin',
    email: 'axiy3735@gmail.com',
    password: 'Ravon7777',
    role: 'superadmin' as const,
    isBlocked: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'admin-manager-1',
    fullName: 'Sardorbek (Sotuvchi & CRM)',
    email: 'sardor@ravon.uz',
    password: 'manager123',
    role: 'manager' as const,
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
    usageCount: 14,
    createdAt: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
  },
  {
    id: 'promo-2',
    code: 'TYUNING15',
    discountType: 'percent',
    discountValue: 15,
    minOrderAmount: 500000,
    description: '500 000 so‘mdan yuqori buyurtmalar uchun 15% chegirma',
    isActive: true,
    usageCount: 8,
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
  },
  {
    id: 'promo-3',
    code: 'SERGELI50',
    discountType: 'fixed',
    discountValue: 50000,
    minOrderAmount: 300000,
    description: 'Sergeli filiali ochilishi munosabati bilan 50 000 so‘m naqd chegirma',
    isActive: true,
    usageCount: 22,
    createdAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
  },
  {
    id: 'promo-4',
    code: 'SUPER06',
    discountType: 'percent',
    discountValue: 20,
    minOrderAmount: 1000000,
    description: 'Doimiy va super mijozlar uchun 20% maxsus chegirma',
    isActive: true,
    usageCount: 5,
    createdAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
  },
];


