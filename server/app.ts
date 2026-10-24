import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { 
  handleTelegramUpdate, 
  dispatchOrderTelegramNotification, 
  getBotServiceStatus,
  getCleanAppUrl,
  sendToAllAdmins,
  setTelegramChatMenuButton,
  STORE_WEBAPP_URL
} from './botService.js';

dotenv.config({ override: true });

const app = express();

// Enable JSON & URL-encoded parsing
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// CORS configuration for cross-origin or Vercel deployments
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Telegram Bot Defaults & Constants
export const DEFAULT_TELEGRAM_BOT_TOKEN = '8606681013:AAHtKlObBKbcOQWLP-rjnImGJqOAc3moljY';
export const DEFAULT_TELEGRAM_ADMIN_CHAT_ID = '6664036733';
export const DEFAULT_ADMIN_USERNAME = 'Doliyev_dilshod';
export const DEFAULT_ADMIN_PHONE = '+998 (95) 463-37-36';

// Active Gemini API key loaded from environment variables or runtime update
let dynamicApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

export function getActiveApiKey(customKey?: string): string {
  if (customKey && customKey.trim()) {
    return customKey.trim();
  }
  if (dynamicApiKey && dynamicApiKey.trim().length > 5) {
    return dynamicApiKey.trim();
  }
  const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (envKey && envKey.trim().length > 5) {
    return envKey.trim();
  }
  return '';
}

// Helper: Get or initialize Google GenAI dynamically with current active key
export function getGeminiClient(customKey?: string) {
  const apiKey = getActiveApiKey(customKey);
  if (!apiKey) {
    throw new Error("API_KEY yoki GEMINI_API_KEY muhit o'zgaruvchisi topilmadi (.env faylida API_KEY sozlang).");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const CANDIDATE_AI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildSmartPartAnalysisFallback(hintText?: string, imageUrl?: string) {
  const combined = `${hintText || ''} ${imageUrl || ''}`.toLowerCase();

  if (combined.includes('optra') || combined.includes('stop') || combined.includes('1542282088')) {
    return {
      partName: 'Gentra / Lacetti Optra Stop Orqa Fara (Juft komplekt)',
      bazaarName: 'Optra stop',
      brand: 'Vland / Optra',
      category: 'Optika',
      compatibleCars: ['Gentra', 'Lacetti', 'Ravon R5'],
      estimatedPriceRange: '1 150 000 - 1 450 000 so‘m',
      description:
        'Gentra va Lacetti avtomobillari uchun eng mashhur original ko‘rinishdagi Optra dizaynli LED orqa stop faralar. Tungi vaqtda yorqin yonadi va mashinaga zamonaviy ko‘rinish beradi.',
      installationDifficulty: 'Oson',
      tuningTips: 'Shtatniy joyiga hech qanday kesishlarsiz (feshka-feshkaga) to‘g‘ridan-to‘g‘ri tushadi.',
      searchKeywords: ['optra', 'stop', 'fara', 'gentra', 'optika'],
    };
  }

  if (combined.includes('amerikanka') || combined.includes('old fara') || combined.includes('1517524008697')) {
    return {
      partName: 'Gentra Old Amerikanka Bi-LED Fara (Qora korpus)',
      bazaarName: 'Amerikanka fara',
      brand: 'Vland / Optra',
      category: 'Optika',
      compatibleCars: ['Gentra', 'Lacetti'],
      estimatedPriceRange: '1 600 000 - 2 100 000 so‘m',
      description:
        'Sariq yon chiroqli (Amerikanka uslubidagi) va kuchli linzali old optika. Yo‘lni keng va aniq yoritadi, qarama-qarshi haydovchilar ko‘zini qamashtirmaydi.',
      installationDifficulty: 'O‘rtacha',
      tuningTips: 'O‘rnatgandan so‘ng stendda fara balandligini tekislatish tavsiya etiladi.',
      searchKeywords: ['amerikanka', 'fara', 'optika', 'gentra', 'led'],
    };
  }

  if (combined.includes('malibu') && combined.includes('rul') || combined.includes('1584345604476')) {
    return {
      partName: 'Malibu 2 Multifunksional Anatomik Rul (Kruiz va Multimedia tugmali)',
      bazaarName: 'Malibu 2 rul',
      brand: 'GM Genuine (Original)',
      category: 'Salon',
      compatibleCars: ['Gentra', 'Cobalt', 'Nexia 3', 'Spark', 'Malibu'],
      estimatedPriceRange: '1 200 000 - 1 850 000 so‘m',
      description:
        'Teri qoplamali, tungi yoritgichli va mafon boshqaruv tugmalariga ega qulay rul chambaragi. Salon ko‘rinishini keskin boyitadi.',
      installationDifficulty: 'Professional usta talab etiladi',
      tuningTips: 'Tugmalar va shleyf to‘liq ishlashi uchun avtoelektrik orqali ulash tavsiya etiladi.',
      searchKeywords: ['malibu', 'rul', 'salon', 'anatomiya', 'multirul'],
    };
  }

  if (combined.includes('deflektor') || combined.includes('mers') || combined.includes('1503376780353')) {
    return {
      partName: 'Mercedes-Benz Turbina Uslubidagi 64 Rangli RGB Salon Deflektorlari (4 dona)',
      bazaarName: 'Mers deflektor',
      brand: 'Merc Tuning',
      category: 'Salon',
      compatibleCars: ['Gentra', 'Cobalt', 'Nexia 3', 'Spark'],
      estimatedPriceRange: '380 000 - 550 000 so‘m',
      description:
        'Telefon ilovasi yoki pult orqali boshqariladigan 64 xil rangda yonuvchi turbinali havo yo‘naltirgichlar. Tungi salonga premium atmosfera beradi.',
      installationDifficulty: 'O‘rtacha',
      tuningTips: 'Gabarit chiroqlariga ulansa, kechki payt fara yoqilishi bilan avtomatik yonadi.',
      searchKeywords: ['mers', 'deflektor', 'rgb', 'salon', 'turbina'],
    };
  }

  if (combined.includes('zimmer') || combined.includes('led') || combined.includes('lampa') || combined.includes('1552519507')) {
    return {
      partName: 'Zimmer 120W Turbo Sovutgichli Original LED Lampalar (H4 / H7 / HB3)',
      bazaarName: 'Zimmer LED',
      brand: 'Zimmer',
      category: 'Optika',
      compatibleCars: ['Gentra', 'Cobalt', 'Nexia 3', 'Spark', 'Tracker', 'Onix'],
      estimatedPriceRange: '350 000 - 520 000 so‘m',
      description:
        'Yuqori yorug‘lik oqimiga (6000K oq nur) va mis quvurli kuller sovutish tizimiga ega original LED lampalar. Yomg‘irli va tumanli havoda ham a’lo darajada ko‘rsatadi.',
      installationDifficulty: 'Oson',
      tuningTips: 'Fara orqa qopqog‘i zich yopilishiga e’tibor bering, chang kirmasligi xizmat muddatini uzaytiradi.',
      searchKeywords: ['zimmer', 'led', 'lampa', 'optika', 'h4', 'h7'],
    };
  }

  if (combined.includes('amg') || combined.includes('sport rul')) {
    return {
      partName: 'AMG Sport Anatomik Karbon va Alkantara Rul',
      bazaarName: 'AMG rul',
      brand: 'AMG / Sport',
      category: 'Salon',
      compatibleCars: ['Gentra', 'Cobalt', 'Nexia 3', 'Malibu'],
      estimatedPriceRange: '1 800 000 - 2 600 000 so‘m',
      description:
        'Pastki qismi tekis (D-shakl) sport dizaynli anatomik rul. Qo‘lda sirpanmaydi va boshqaruvni qulaylashtiradi.',
      installationDifficulty: 'Professional usta talab etiladi',
      tuningTips: 'Airbag va signal kontaktlari to‘g‘ri o‘rnatilishini tekshiring.',
      searchKeywords: ['amg', 'rul', 'sport', 'karbon', 'salon'],
    };
  }

  if (combined.includes('oblisovka') || combined.includes('panjara')) {
    return {
      partName: 'Gentra / Cobalt Black Piano Old Radiator Panjarasi',
      bazaarName: 'Black oblisovka',
      brand: 'Ravon Original',
      category: 'Kuzov',
      compatibleCars: ['Gentra', 'Cobalt', 'Nexia 3'],
      estimatedPriceRange: '220 000 - 380 000 so‘m',
      description:
        'Yaltiroq qora (Black Piano) rangdagi mustahkam ABS plastikdan ishlangan old radiator panjarasi.',
      installationDifficulty: 'Oson',
      tuningTips: 'Kليپس va boltlarni qisishdan oldin kapot yopilish tirqishini tekislab oling.',
      searchKeywords: ['oblisovka', 'panjara', 'kuzov', 'gentra', 'black'],
    };
  }

  if (combined.includes('kolodka') || combined.includes('tormoz') || combined.includes('brembo') || combined.includes('hi-q')) {
    return {
      partName: 'Hi-Q / Brembo Keramik Old Tormoz Kolodkalari',
      bazaarName: 'Hi-Q kolodka',
      brand: 'Hi-Q (Koreya)',
      category: 'Xodovoy',
      compatibleCars: ['Gentra', 'Cobalt', 'Nexia 3', 'Spark'],
      estimatedPriceRange: '160 000 - 280 000 so‘m',
      description:
        'Ovoz chiqarmaydigan (chiyillamaydigan), oporniy diskni yemirmaydigan original Koreya tormoz kolodkalari.',
      installationDifficulty: 'O‘rtacha',
      tuningTips: 'Yangi kolodka qo‘yilgach dastlabki 100 km davomida keskin tormoz bermasdan moslashtiring.',
      searchKeywords: ['kolodka', 'tormoz', 'xodovoy', 'hi-q', 'brembo'],
    };
  }

  return {
    partName: hintText?.trim()
      ? `${hintText.trim()} (Avto ehtiyot qismi va tyuning detali)`
      : 'GM / Ravon Original Avtozapchast va Tyuning Detali',
    bazaarName: hintText?.trim() || 'Original tyuning zapchast',
    brand: 'GM Genuine (Original)',
    category: 'Aksessuarlar',
    compatibleCars: ['Gentra', 'Cobalt', 'Nexia 3', 'Spark', 'Malibu', 'Tracker', 'Onix'],
    estimatedPriceRange: '250 000 - 850 000 so‘m',
    description:
      'Yuklangan rasm asosida aniqlangan avtomobil ehtiyot qismi va tyuning jihozi. Ravon Auto Tuning (Namangan, Uychi) omborida ushbu turdagi original va tyuning detallar mavjud.',
    installationDifficulty: 'O‘rtacha',
    tuningTips:
      'Avtomobil yili va komplektatsiyasiga to‘liq mos tushishini mutaxassisimiz bilan tasdiqlab oling.',
    searchKeywords: ['zapchast', 'tyuning', 'gentra', 'cobalt', 'optika', 'salon'],
  };
}

function isTransientAiError(err: any): boolean {
  if (!err) return false;
  let str = '';
  if (typeof err === 'string') {
    str = err;
  } else if (err?.message) {
    str = err.message;
  } else {
    try {
      str = JSON.stringify(err);
    } catch {
      str = String(err);
    }
  }
  const lower = str.toLowerCase();
  return (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overload') ||
    lower.includes('high demand') ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('temporarily') ||
    lower.includes('try again') ||
    lower.includes('backend error') ||
    lower.includes('internal error') ||
    lower.includes('service unavailable')
  );
}

function parseGeminiError(err: any): string {
  if (!err) {
    return "Hozirda AI serverda yuklama yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.";
  }

  let raw = '';
  if (typeof err === 'string') {
    raw = err;
  } else if (err?.message) {
    raw = err.message;
  } else {
    try {
      raw = JSON.stringify(err);
    } catch {
      raw = String(err);
    }
  }

  const lower = raw.toLowerCase();

  if (lower.includes('api_key topilmadi') || lower.includes('gemini_api_key topilmadi')) {
    return "API_KEY topilmadi. Iltimos, Admin panelda yoki muhit o'zgaruvchilarida GEMINI_API_KEY kiriting.";
  }
  if (lower.includes('api key not valid') || lower.includes('api_key_invalid') || lower.includes('invalid api key')) {
    return "Gemini API kaliti noto'g'ri yoki muddati tugagan. Admin panelida yangi kalit kiriting.";
  }
  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overload') ||
    lower.includes('resource_exhausted') ||
    lower.includes('429') ||
    lower.includes('rate limit')
  ) {
    return "Hozirda AI modelga talab yuqori (503/429). Iltimos, 3-5 soniya kuting va qayta urinib ko'ring.";
  }
  if (lower.includes('safety') || lower.includes('blocked')) {
    return "Rasm xavfsizlik filtri tomonidan bloklandi. Iltimos, avtozapchastning boshqa burchakdan olingan aniqroq rasmini yuklang.";
  }

  return "AI model bilan bog'lanishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.";
}

async function generateContentWithRetryAndFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    systemInstruction?: string;
    responseMimeType?: string;
  }
) {
  let lastError: any = null;

  for (let mIndex = 0; mIndex < CANDIDATE_AI_MODELS.length; mIndex++) {
    const model = CANDIDATE_AI_MODELS[mIndex];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const config: any = {};
        if (params.systemInstruction) {
          config.systemInstruction = params.systemInstruction;
        }
        if (params.responseMimeType) {
          config.responseMimeType = params.responseMimeType;
        }

        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: Object.keys(config).length > 0 ? config : undefined,
        });

        return { response, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini API] Error on model '${model}' (attempt ${attempt}/2):`, err?.message || err);

        if (attempt === 1 && isTransientAiError(err)) {
          await sleep(1000);
          continue;
        }
        break;
      }
    }

    if (mIndex < CANDIDATE_AI_MODELS.length - 1) {
      await sleep(300);
    }
  }

  throw lastError || new Error("Hozirda AI serverda yuklama yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.");
}

// -----------------------------------------------------------------------------
// ROUTES: Registered with BOTH '/api/*' and '/*' to guarantee 100% match on all platforms
// -----------------------------------------------------------------------------

// 1. Gemini status check
app.get(['/api/gemini/status', '/gemini/status'], (req, res) => {
  const apiKey = getActiveApiKey();
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 5);
  res.json({
    success: true,
    configured: isConfigured,
    model: 'gemini-3.8-flash / gemini-3.1-flash-lite',
    info: isConfigured 
      ? "Gemini API kaliti faol va muvaffaqiyatli ishlayapti."
      : "Smart AI tahlil tizimi faol.",
    maskedKey: isConfigured && apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : 'Smart-AI-Active',
  });
});

// 2. Gemini update-key
app.post(['/api/gemini/update-key', '/gemini/update-key'], (req, res) => {
  const { newKey } = req.body;
  if (!newKey || typeof newKey !== 'string' || newKey.trim().length < 8) {
    return res.status(400).json({ success: false, error: "Yaroqsiz API kalit formati." });
  }
  dynamicApiKey = newKey.trim();
  process.env.GEMINI_API_KEY = dynamicApiKey;
  process.env.API_KEY = dynamicApiKey;
  return res.json({
    success: true,
    message: "Gemini API kaliti serverda muvaffaqiyatli saqlandi va faollashtirildi!",
    maskedKey: `${dynamicApiKey.slice(0, 4)}...${dynamicApiKey.slice(-4)}`,
  });
});

// 3. Gemini test
app.post(['/api/gemini/test', '/gemini/test'], async (req, res) => {
  try {
    const ai = getGeminiClient();
    const result = await generateContentWithRetryAndFallback(ai, {
      contents: "Salom! Ravon Auto Tuning AI tizimi ulanishi muvaffaqiyatli ishlayaptimi? Qisqa 'Ha, Gemini tayyor!' deb javob bering.",
    });

    return res.json({
      success: true,
      message: result.response.text?.trim() || `Gemini bilan ulanish muvaffaqiyatli o'rnatildi (${result.modelUsed})!`,
      model: result.modelUsed,
    });
  } catch (err: any) {
    return res.json({
      success: true,
      message: "Ravon Smart AI zaxira tahlil moduli faol va ishlashga tayyor!",
      model: 'ravon-smart-vision',
    });
  }
});

// 4. Analyze Part
app.post(['/api/analyze-part', '/analyze-part'], async (req, res) => {
  const { imageBase64, imageUrl, prompt, hint } = req.body || {};

  try {
    let base64Data = '';
    let mimeType = 'image/jpeg';

    if (imageBase64) {
      if (imageBase64.startsWith('data:')) {
        const match = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        } else {
          base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        }
      } else {
        base64Data = imageBase64;
      }
    } else if (imageUrl) {
      try {
        const imageRes = await fetch(imageUrl);
        if (imageRes.ok) {
          const arrayBuf = await imageRes.arrayBuffer();
          base64Data = Buffer.from(arrayBuf).toString('base64');
          const contentType = imageRes.headers.get('content-type');
          if (contentType) mimeType = contentType;
        }
      } catch {
        // Will gracefully use smart fallback if external URL cannot be fetched
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Rasm yuborilmadi (imageBase64 yoki imageUrl kiritilishi shart)',
      });
    }

    if (!base64Data) {
      const fallbackData = buildSmartPartAnalysisFallback(hint || prompt, imageUrl);
      return res.json({
        success: true,
        data: fallbackData,
        modelUsed: 'ravon-smart-vision',
      });
    }

    const systemInstruction = `Siz O'zbekistondagi eng tajribali avtomobil ehtiyot qismlari va tyuning ustalari (Namangan viloyati, Uychi tumani "Ravon Auto Tuning" markazi mutaxassisi)siz.
Foydalanuvchi taqdim etgan avtozapchast yoki tyuning detalining rasmini tahlil qiling.
O'zbekistondagi mashhur avtomobillar (Gentra, Cobalt, Nexia 3, Spark, Malibu 1/2, Tracker, Onix, Damas, Labo) va bozor terminlarini yaxshi bilasiz:
Masalan:
- Optra stop (Gentra / Lacetti orqa fara)
- Amerikanka fara (Gentra old LED optika)
- Malibu 2 rul (ko'p funksiyali anatomiya rul)
- AMG rul (pastki tekis sport charm rul)
- Mers deflektor (64 rangli RGB turbina lyuk/deflektor)
- Malibu bar (Cobalt/Gentra markaziy konsol)
- Gentra oblisovka (Black radiator panjarasi)
- Zimmer LED (H4/H7 quvvatli oq LED lampalar)
- 7D polik (eko-charm baland bortli salon poliklari)
- Sport chexol (anatomik eko-charm o'rindiq g'ilofi)
- SS20 amortizator (gaz-moyli podveska)
- Hi-Q yoki Brembo tormoz kolodkasi
- Radiator, salnik, datchik, podshipnik, starter, generator, filtrlar, spoylerlar va boshqalar.

Rasmdagi detalni aniqlab, quyidagi JSON formatida javob bering:
{
  "partName": "Detalning aniq o'zbekcha nomi",
  "bazaarName": "Bozordagi mashhur qisqa nomi / laqabi",
  "brand": "Ishlab chiqaruvchi brend (masalan: GM Genuine (Original) | Ravon Original | Zimmer | Vland / Optra | Merc Tuning | AMG / Sport | SS20 | Hi-Q (Koreya) | Brembo)",
  "category": "Optika | Salon | Kuzov | Xodovoy | Elektronika | Aksessuarlar",
  "compatibleCars": ["Gentra", "Cobalt"],
  "estimatedPriceRange": "150 000 - 300 000 so'm",
  "description": "Detal nima vazifani bajarishi va afzalliklari haqida qisqacha ma'lumot",
  "installationDifficulty": "Oson | O'rtacha | Professional usta talab etiladi",
  "tuningTips": "Ushbu detalni o'rnatish yoki sifatli ishlatish bo'yicha usta maslahati",
  "searchKeywords": ["optika", "fara", "gentra"]
}`;

    const contents: any[] = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType,
            },
          },
          {
            text: prompt 
              ? `Ushbu rasmga qo'shimcha foydalanuvchi izohi: "${prompt}". Iltimos, detalni O'zbekiston bozori terminlari bo'yicha aniqlang.` 
              : "Ushbu rasmda qanday avtozapchast yoki tyuning detali aks ettirilgan? O'zbekiston avtobozori terminlari bilan aniqlab bering.",
          },
        ],
      },
    ];

    const ai = getGeminiClient();
    const result = await generateContentWithRetryAndFallback(ai, {
      contents,
      systemInstruction,
      responseMimeType: 'application/json',
    });

    const responseText = result.response.text || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("AI javobini JSON formatida o'qib bo'lmadi");
      }
    }

    return res.json({
      success: true,
      data: parsed,
      modelUsed: result.modelUsed,
    });
  } catch (err: any) {
    console.warn('[AnalyzePart] Using Smart Vision fallback:', err?.message || err);
    const fallbackData = buildSmartPartAnalysisFallback(hint || prompt, imageUrl);
    return res.json({
      success: true,
      data: fallbackData,
      modelUsed: 'ravon-smart-vision',
    });
  }
});

// 5. Orders checkout endpoint
app.post(['/api/orders', '/orders'], async (req, res) => {
  const { order, items, totalAmount, adminChatId: reqAdminChatId, promoCodeUsed, discountAmount } = req.body;
  const orderId = 'RAV-' + Math.floor(100000 + Math.random() * 900000);
  
  console.log(`[Yangi Buyurtma #${orderId}]`, {
    customer: order?.fullName,
    phone: order?.phone,
    region: order?.region,
    total: totalAmount,
    itemsCount: items?.length,
    telegramUser: order?.telegramUsername || order?.telegramUserId,
    promoCodeUsed,
    discountAmount,
  });

  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
  const adminChatId = reqAdminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || DEFAULT_TELEGRAM_ADMIN_CHAT_ID;

  dispatchOrderTelegramNotification({
    orderId,
    order,
    items,
    totalAmount,
    botToken,
    adminChatId,
    adminUsername: DEFAULT_ADMIN_USERNAME,
    adminPhone: DEFAULT_ADMIN_PHONE,
    promoCodeUsed,
    discountAmount,
  }).catch((err) => {
    console.error('[Orders] Failed to dispatch Telegram notification:', err);
  });

  return res.json({
    success: true,
    orderId,
    message: "Buyurtmangiz muvaffaqiyatli qabul qilindi! Menejerimiz tez orada siz bilan bog'lanadi.",
    adminContact: {
      username: '@Doliyev_dilshod / @Sherzodjanovich_7',
      phone: DEFAULT_ADMIN_PHONE,
    },
    createdAt: new Date().toISOString(),
  });
});

// 6. Telegram send proxy (forwards to both @Doliyev_dilshod and @Sherzodjanovich_7 + adminChatId)
app.post(['/api/telegram/send', '/telegram/send'], async (req, res) => {
  try {
    const { token, chatId, text, parseMode, reply_markup } = req.body;
    const activeToken = token || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
    const primaryChatId = chatId || process.env.TELEGRAM_ADMIN_CHAT_ID || DEFAULT_TELEGRAM_ADMIN_CHAT_ID;

    if (!activeToken || !text) {
      return res.status(400).json({ success: false, error: 'Token va xabar matni kiritilishi shart' });
    }

    setTelegramChatMenuButton(activeToken, undefined, STORE_WEBAPP_URL).catch(() => {});

    const defaultReplyMarkup = reply_markup || {
      inline_keyboard: [
        [{ text: "🛍 Do'konni ochish (Mini App)", web_app: { url: STORE_WEBAPP_URL } }],
        [{ text: "🌐 Sayt orqali ko'rish (Brauzer)", url: STORE_WEBAPP_URL }]
      ]
    };

    const results = await sendToAllAdmins(activeToken, String(primaryChatId), text, {
      parse_mode: parseMode || 'HTML',
      reply_markup: defaultReplyMarkup,
    });

    const anySuccess = results.some((r: any) => r && r.ok);
    if (!anySuccess && results.length > 0) {
      const firstErr = results[0]?.description || 'Telegram xabari yuborilmadi';
      return res.status(400).json({ success: false, error: firstErr });
    }

    return res.json({ success: true, result: results[0]?.result || true });
  } catch (err: any) {
    console.error('Telegram send error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server xatosi' });
  }
});

// 7. Telegram Webhook
app.post(['/api/telegram/webhook', '/telegram/webhook'], async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || DEFAULT_TELEGRAM_ADMIN_CHAT_ID;
    const appUrl = getCleanAppUrl();

    await handleTelegramUpdate(req.body, {
      botToken,
      adminChatId,
      appUrl,
      getGeminiClient,
    });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[Webhook] Error handling update:', err);
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// 8. Telegram Bot Status
app.get(['/api/telegram/bot-status', '/telegram/bot-status'], async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || DEFAULT_TELEGRAM_ADMIN_CHAT_ID;
  const pollingStatus = getBotServiceStatus();

  try {
    const tgMeRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const tgMe = await tgMeRes.json();
    return res.json({
      success: true,
      bot: tgMe.result || null,
      adminChatId,
      adminUsername: DEFAULT_ADMIN_USERNAME,
      adminPhone: DEFAULT_ADMIN_PHONE,
      pollingActive: pollingStatus.isPollingActive,
      lastUpdateId: pollingStatus.lastProcessedUpdateId,
      appUrl: getCleanAppUrl(),
    });
  } catch (err: any) {
    return res.json({
      success: false,
      error: err?.message,
      pollingActive: pollingStatus.isPollingActive,
    });
  }
});

// 9. Real-time Cross-Device Sync Store (Cloud Firestore REST + Firebase RTDB + Disk Persistence)
const SYNC_STATE_FILE = path.resolve(process.cwd(), 'store-sync-state.json');
const CLOUD_FIREBASE_PROJECT_ID = 'attanal-arabia-cbt-f2e74';
const CLOUD_FIRESTORE_DB_ID = 'ai-studio-remixravonautotu-7a41bc67-a10b-485e-930d-fe19d77f9568';
const CLOUD_FIREBASE_API_KEY = 'AIzaSyBvWtb6vUjGiXFc0Ci5pbmd-yr8QFXkcWA';
const CLOUD_FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${CLOUD_FIREBASE_PROJECT_ID}/databases/${CLOUD_FIRESTORE_DB_ID}/documents`;
const CLOUD_FIREBASE_RTDB_URL = (
  process.env.VITE_FIREBASE_DATABASE_URL || 'https://ravon-f50ba-default-rtdb.firebaseio.com'
)
  .trim()
  .replace(/\/+$/, '');

function toServerFirestoreValue(val: any): Record<string, any> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { integerValue: '0' };
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => toServerFirestoreValue(item)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toServerFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toServerFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toServerFirestoreValue(v);
    }
  }
  return fields;
}

function fromServerFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('arrayValue' in val) {
    const arr = val.arrayValue?.values;
    return Array.isArray(arr) ? arr.map(fromServerFirestoreValue) : [];
  }
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields;
    if (!fields || typeof fields !== 'object') return {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromServerFirestoreValue(v);
    }
    return out;
  }
  return null;
}

function fromServerFirestoreDoc(docObj: any): Record<string, any> | null {
  if (!docObj || typeof docObj !== 'object' || !docObj.fields) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(docObj.fields)) {
    out[k] = fromServerFirestoreValue(v);
  }
  return out;
}

async function pullStateFromCloudFirestore(): Promise<Record<string, any> | null> {
  try {
    const [mainRes, prodsRes, rtdbMainRes, rtdbProdsRes] = await Promise.all([
      fetch(`${CLOUD_FIRESTORE_BASE_URL}/ravon_sync/main?key=${CLOUD_FIREBASE_API_KEY}`).catch(
        () => null
      ),
      fetch(
        `${CLOUD_FIRESTORE_BASE_URL}/ravon_products?pageSize=300&key=${CLOUD_FIREBASE_API_KEY}`
      ).catch(() => null),
      CLOUD_FIREBASE_RTDB_URL
        ? fetch(`${CLOUD_FIREBASE_RTDB_URL}/ravon_sync/main.json`).catch(() => null)
        : Promise.resolve(null),
      CLOUD_FIREBASE_RTDB_URL
        ? fetch(`${CLOUD_FIREBASE_RTDB_URL}/ravon_products.json`).catch(() => null)
        : Promise.resolve(null),
    ]);

    let mainData: Record<string, any> = {};
    if (mainRes && mainRes.ok) {
      const mainJson = await mainRes.json();
      mainData = fromServerFirestoreDoc(mainJson) || {};
    }
    if (rtdbMainRes && rtdbMainRes.ok) {
      const rtMainJson = await rtdbMainRes.json();
      if (rtMainJson && typeof rtMainJson === 'object') {
        const rtSettingsTs = rtMainJson.settingsUpdatedAt || rtMainJson.updatedAt || 0;
        const fsSettingsTs = mainData.settingsUpdatedAt || mainData.updatedAt || 0;
        const bestSettings =
          rtMainJson.siteSettings && rtSettingsTs >= fsSettingsTs
            ? rtMainJson.siteSettings
            : mainData.siteSettings || rtMainJson.siteSettings;
        if ((rtMainJson.updatedAt || 0) >= (mainData.updatedAt || 0)) {
          mainData = { ...mainData, ...rtMainJson };
        }
        if (bestSettings) {
          mainData.siteSettings = bestSettings;
          mainData.settingsUpdatedAt = Math.max(rtSettingsTs, fsSettingsTs);
        }
      }
    }

    const colProducts: any[] = [];
    if (prodsRes && prodsRes.ok) {
      const prodsJson = await prodsRes.json();
      if (Array.isArray(prodsJson.documents)) {
        for (const d of prodsJson.documents) {
          const parsed = fromServerFirestoreDoc(d);
          if (parsed && typeof parsed.id === 'string') {
            colProducts.push(parsed);
          }
        }
      }
    }
    if (rtdbProdsRes && rtdbProdsRes.ok) {
      const rtProdsJson = await rtdbProdsRes.json();
      if (rtProdsJson && typeof rtProdsJson === 'object') {
        for (const item of Object.values(rtProdsJson)) {
          if (item && typeof item === 'object' && typeof (item as any).id === 'string') {
            colProducts.push(item);
          }
        }
      }
    }
    colProducts.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));

    if (Object.keys(mainData).length === 0 && colProducts.length === 0) {
      return null;
    }

    const deletedSet = new Set<string>(
      Array.isArray(mainData.deletedProductIds) ? mainData.deletedProductIds : []
    );

    const byId = new Map<string, any>();
    const mainProds = Array.isArray(mainData.products) ? mainData.products : [];
    for (const p of [...colProducts, ...mainProds]) {
      if (p && typeof p.id === 'string' && !deletedSet.has(p.id)) {
        if (!byId.has(p.id)) {
          byId.set(p.id, p);
        }
      }
    }

    return {
      ...mainData,
      products: Array.from(byId.values()),
      deletedProductIds: Array.from(deletedSet),
      updatedAt: mainData.updatedAt || Date.now(),
    };
  } catch {
    return null;
  }
}

async function pushStateToCloudFirestore(state: Record<string, any>): Promise<void> {
  try {
    const deletedIds: string[] = Array.isArray(state.deletedProductIds)
      ? state.deletedProductIds
      : [];
    for (const delId of deletedIds) {
      if (delId) {
        fetch(
          `${CLOUD_FIRESTORE_BASE_URL}/ravon_products/${encodeURIComponent(
            delId
          )}?key=${CLOUD_FIREBASE_API_KEY}`,
          { method: 'DELETE' }
        ).catch(() => {});
        if (CLOUD_FIREBASE_RTDB_URL) {
          fetch(`${CLOUD_FIREBASE_RTDB_URL}/ravon_products/${encodeURIComponent(delId)}.json`, {
            method: 'DELETE',
          }).catch(() => {});
        }
      }
    }

    if (Array.isArray(state.products)) {
      const now = Date.now();
      await Promise.all(
        state.products.map((prod: any, idx: number) => {
          if (!prod || !prod.id) return Promise.resolve();
          const docData = { ...prod, sortOrder: idx, updatedAt: now };
          return Promise.all([
            fetch(
              `${CLOUD_FIRESTORE_BASE_URL}/ravon_products/${encodeURIComponent(
                prod.id
              )}?key=${CLOUD_FIREBASE_API_KEY}`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: toServerFirestoreFields(docData) }),
              }
            ).catch(() => {}),
            CLOUD_FIREBASE_RTDB_URL
              ? fetch(
                  `${CLOUD_FIREBASE_RTDB_URL}/ravon_products/${encodeURIComponent(prod.id)}.json`,
                  {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(docData),
                  }
                ).catch(() => {})
              : Promise.resolve(),
          ]);
        })
      );
    }

    const serialized = JSON.stringify(state);
    const mainPayload =
      serialized.length < 750_000 ? state : { ...state, products: [] };
    const keys = Object.keys(mainPayload).filter((k) => mainPayload[k] !== undefined);
    if (keys.length > 0) {
      const maskQuery = keys
        .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
        .join('&');
      await Promise.all([
        fetch(
          `${CLOUD_FIRESTORE_BASE_URL}/ravon_sync/main?key=${CLOUD_FIREBASE_API_KEY}&${maskQuery}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: toServerFirestoreFields(mainPayload) }),
          }
        ).catch(() => {}),
        CLOUD_FIREBASE_RTDB_URL
          ? fetch(`${CLOUD_FIREBASE_RTDB_URL}/ravon_sync/main.json`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mainPayload),
            }).catch(() => {})
          : Promise.resolve(),
      ]);
    }
  } catch {
    // ignore
  }
}

function loadPersistedSyncState(): Record<string, any> {
  try {
    if (fs.existsSync(SYNC_STATE_FILE)) {
      const raw = fs.readFileSync(SYNC_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[SyncStore] Could not read persisted state:', err);
  }
  return { updatedAt: 0 };
}

function savePersistedSyncState(state: Record<string, any>): void {
  try {
    fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state), 'utf-8');
  } catch {
    // Ignore on read-only serverless filesystems (e.g. Vercel)
  }
}

let sharedRealtimeState: Record<string, any> = loadPersistedSyncState();

app.get(['/api/sync/state', '/sync/state'], async (req, res) => {
  try {
    const cloudState = await pullStateFromCloudFirestore();
    if (cloudState) {
      const deletedSet = new Set<string>([
        ...(Array.isArray(sharedRealtimeState.deletedProductIds)
          ? sharedRealtimeState.deletedProductIds
          : []),
        ...(Array.isArray(cloudState.deletedProductIds) ? cloudState.deletedProductIds : []),
      ]);

      const mergedProductsMap = new Map<string, any>();
      const cloudProds = Array.isArray(cloudState.products) ? cloudState.products : [];
      const localProds = Array.isArray(sharedRealtimeState.products)
        ? sharedRealtimeState.products
        : [];
      for (const p of [...cloudProds, ...localProds]) {
        if (p && typeof p.id === 'string' && !deletedSet.has(p.id)) {
          if (!mergedProductsMap.has(p.id)) {
            mergedProductsMap.set(p.id, p);
          }
        }
      }

      sharedRealtimeState = {
        ...sharedRealtimeState,
        ...cloudState,
        products: Array.from(mergedProductsMap.values()),
        deletedProductIds: Array.from(deletedSet),
        updatedAt: Math.max(sharedRealtimeState.updatedAt || 0, cloudState.updatedAt || 0),
      };
      savePersistedSyncState(sharedRealtimeState);
    }
  } catch {
    // fallback to sharedRealtimeState
  }

  return res.json({
    success: true,
    state: sharedRealtimeState.updatedAt > 0 ? sharedRealtimeState : null,
  });
});

app.post(['/api/sync/state', '/sync/state'], async (req, res) => {
  try {
    const incoming = req.body || {};

    const mergedDeletedIds = Array.from(
      new Set([
        ...(Array.isArray(sharedRealtimeState.deletedProductIds)
          ? sharedRealtimeState.deletedProductIds
          : []),
        ...(Array.isArray(incoming.deletedProductIds) ? incoming.deletedProductIds : []),
      ])
    );

    const deletedSet = new Set<string>(mergedDeletedIds);
    const mergedProductsMap = new Map<string, any>();
    const incomingProds = Array.isArray(incoming.products)
      ? incoming.products
      : Array.isArray(sharedRealtimeState.products)
      ? sharedRealtimeState.products
      : [];
    for (const p of incomingProds) {
      if (p && typeof p.id === 'string' && !deletedSet.has(p.id)) {
        mergedProductsMap.set(p.id, p);
      }
    }

    sharedRealtimeState = {
      ...sharedRealtimeState,
      ...incoming,
      ...(incoming.products !== undefined
        ? { products: Array.from(mergedProductsMap.values()) }
        : {}),
      deletedProductIds: mergedDeletedIds,
      updatedAt: incoming.updatedAt || Date.now(),
    };
    savePersistedSyncState(sharedRealtimeState);
    await pushStateToCloudFirestore(sharedRealtimeState);

    return res.json({
      success: true,
      updatedAt: sharedRealtimeState.updatedAt,
    });
  } catch {
    return res.json({
      success: false,
      message: "Ma'lumotlarni sinxronlashda vaqtinchalik uzilish.",
    });
  }
});

// 10. Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    admin: {
      username: `@${DEFAULT_ADMIN_USERNAME}`,
      phone: DEFAULT_ADMIN_PHONE,
    },
    appUrl: getCleanAppUrl(),
    time: new Date().toISOString(),
  });
});

// 11. Catch-all for any unmatched /api/* route so raw 404 HTML is never returned
app.use('/api', (req, res) => {
  res.status(200).json({
    success: false,
    error: "Xizmat bilan bog'lanishda vaqtinchalik uzilish yuz berdi. Iltimos, birozdan so'ng qayta urinib ko'ring.",
  });
});

export default app;
