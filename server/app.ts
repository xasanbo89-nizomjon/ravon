import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { 
  handleTelegramUpdate, 
  dispatchOrderTelegramNotification, 
  getBotServiceStatus,
  getCleanAppUrl
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
export const DEFAULT_ADMIN_PHONE = '+998 97 524 04 01';

// Active Gemini API key loaded strictly from environment variables
let dynamicApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';

export function getActiveApiKey(customKey?: string): string {
  if (customKey && customKey.trim()) {
    return customKey.trim();
  }
  const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (envKey && envKey.trim().length > 5) {
    return envKey.trim();
  }
  return dynamicApiKey || '';
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
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    return "API_KEY topilmadi. Iltimos, .env faylida API_KEY yoki GEMINI_API_KEY o'zgaruvchisini kiriting.";
  }
  if (lower.includes('api key not valid') || lower.includes('api_key_invalid') || lower.includes('invalid api key')) {
    return "Gemini API kaliti noto'g'ri yoki bekor qilingan. Admin panelida yangi kalit kiriting.";
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
    model: 'gemini-3.1-flash-lite / gemini-3.8-flash',
    info: isConfigured 
      ? "Gemini API kaliti faol va muvaffaqiyatli ishlayapti."
      : "Gemini API kaliti topilmadi (.env faylida API_KEY sozlang).",
    maskedKey: isConfigured && apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : null,
  });
});

// 2. Gemini update-key
app.post(['/api/gemini/update-key', '/gemini/update-key'], (req, res) => {
  const { newKey } = req.body;
  if (!newKey || typeof newKey !== 'string' || newKey.trim().length < 8) {
    return res.status(400).json({ success: false, error: "Yaroqsiz API kalit formati." });
  }
  dynamicApiKey = newKey.trim();
  process.env.API_KEY = dynamicApiKey;
  process.env.GEMINI_API_KEY = dynamicApiKey;
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
    console.error('Gemini Test Error:', err);
    return res.status(500).json({
      success: false,
      error: parseGeminiError(err),
    });
  }
});

// 4. Analyze Part
app.post(['/api/analyze-part', '/analyze-part'], async (req, res) => {
  try {
    const { imageBase64, imageUrl, prompt } = req.body;

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
        const arrayBuf = await imageRes.arrayBuffer();
        base64Data = Buffer.from(arrayBuf).toString('base64');
        const contentType = imageRes.headers.get('content-type');
        if (contentType) mimeType = contentType;
      } catch (err) {
        console.error('Failed to fetch image from URL:', err);
        return res.status(400).json({
          error: "Rasm yuklab olinmadi. Iltimos, o'z qurilmangizdan rasm yuklang.",
        });
      }
    } else {
      return res.status(400).json({ error: 'Rasm yuborilmadi (imageBase64 yoki imageUrl kiritilishi shart)' });
    }

    const systemInstruction = `Siz O'zbekistondagi eng tajribali avtomobil ehtiyot qismlari va tyuning ustalari (Sergeli moshina bozori va Farhod bozori mutaxassisi)siz.
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
  "category": "Optika | Salon | Kuzov | Xodovoy | Elektronika | Aksessuarlar",
  "compatibleCars": ["Gentra", "Cobalt"],
  "estimatedPriceRange": "150 000 - 300 000 so'm",
  "description": "Detal nima vazifani bajarishi va afzalliklari haqida qisqacha ma'lumot",
  "installationDifficulty": "Oson | O'rtacha | Professional usta talab etiladi",
  "tuningTips": "Ushbu detalni o'rnatish yoki sifatli ishlatish bo'yicha usta maslahati"
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
    console.error('Analyze Part Error:', err);
    return res.status(500).json({
      success: false,
      error: parseGeminiError(err),
      details: err?.message,
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
      username: `@${DEFAULT_ADMIN_USERNAME}`,
      phone: DEFAULT_ADMIN_PHONE,
    },
    createdAt: new Date().toISOString(),
  });
});

// 6. Telegram send proxy
app.post(['/api/telegram/send', '/telegram/send'], async (req, res) => {
  try {
    const { token, chatId, text, parseMode } = req.body;
    if (!token || !chatId || !text) {
      return res.status(400).json({ success: false, error: 'Token, chatId va text kiritilishi shart' });
    }

    const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const tgRes = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode || 'HTML',
      }),
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      return res.status(400).json({ success: false, error: tgData.description || 'Telegram xabari yuborilmadi' });
    }

    return res.json({ success: true, result: tgData.result });
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

// 9. Health check
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

export default app;
