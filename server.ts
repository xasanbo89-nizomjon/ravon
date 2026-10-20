import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { 
  startTelegramBotPolling, 
  handleTelegramUpdate, 
  dispatchOrderTelegramNotification, 
  getBotServiceStatus 
} from './server/botService.js';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Telegram Bot Constants
const DEFAULT_TELEGRAM_BOT_TOKEN = '8606681013:AAHtKlObBKbcOQWLP-rjnImGJqOAc3moljY';
const DEFAULT_TELEGRAM_ADMIN_CHAT_ID = '6664036733';
const DEFAULT_APP_URL = 'https://ais-dev-fev2qhkgdiw3pclxq3y2d6-160871491465.asia-southeast1.run.app';

// Active Gemini API key loaded strictly from environment variables (process.env.API_KEY or process.env.GEMINI_API_KEY)
let dynamicApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';

function getActiveApiKey(customKey?: string): string {
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
function getGeminiClient(customKey?: string) {
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

// AI Gemini status check endpoint
app.get('/api/gemini/status', (req, res) => {
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

// Endpoint to update active Gemini key from admin panel
app.post('/api/gemini/update-key', (req, res) => {
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

  // 1. High demand / 503 / 429 / overloaded
  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overload') ||
    lower.includes('high demand') ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('try again')
  ) {
    return "Hozirda AI serverda yuklama yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.";
  }

  // 2. Leaked or invalid key
  if (
    lower.includes('leaked') ||
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid')
  ) {
    return "Gemini API kaliti bekor qilingan (leaked / yaroqsiz). Iltimos, AI Studio panelidagi 'Settings > Secrets' bo'limida yangi GEMINI_API_KEY kiriting. Yangi kalit darhol kuchga kiradi.";
  }

  if (lower.includes('gemini_api_key topilmadi')) {
    return "GEMINI_API_KEY topilmadi. AI Studio 'Settings > Secrets' bo'limida yangi kalit kiriting.";
  }

  // 3. Raw JSON error object detection (never expose {"error":{"code":503...}} to client)
  if (raw.trim().startsWith('{') || raw.includes('{"error"') || raw.includes('"message":') || raw.includes('"status":')) {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const code = parsed?.error?.code;
        const status = String(parsed?.error?.status || '').toUpperCase();
        const msg = String(parsed?.error?.message || '').toLowerCase();
        if (
          code === 503 ||
          code === 429 ||
          status === 'UNAVAILABLE' ||
          status === 'RESOURCE_EXHAUSTED' ||
          msg.includes('overload') ||
          msg.includes('high demand') ||
          msg.includes('unavailable') ||
          msg.includes('try again')
        ) {
          return "Hozirda AI serverda yuklama yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.";
        }
      }
    } catch {
      // ignore JSON parse error
    }
    return "Hozirda AI serverda yuklama yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.";
  }

  // 4. Strip technical SDK tags if present
  const clean = raw.replace(/^\[GoogleGenAI:[^\]]+\]\s*/i, '').trim();
  if (clean.startsWith('{') && clean.endsWith('}')) {
    return "Hozirda AI serverda yuklama yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.";
  }

  return clean || "Hozirda AI serverda yuklama yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.";
}

// Robust multimodal content generator with Retry & Model Fallback
async function generateContentWithRetryAndFallback(
  ai: GoogleGenAI,
  payload: { contents: any; config?: any }
) {
  let lastError: any = null;

  for (let mIndex = 0; mIndex < CANDIDATE_AI_MODELS.length; mIndex++) {
    const model = CANDIDATE_AI_MODELS[mIndex];

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini API] Requesting model '${model}' (attempt ${attempt}/2)...`);
        const response = await ai.models.generateContent({
          model,
          contents: payload.contents,
          config: payload.config,
        });

        if (response && response.text) {
          console.log(`[Gemini API] Success with model '${model}'`);
          return { response, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        const rawMsg = String(err?.message || err);
        console.warn(`[Gemini API] Model '${model}' attempt ${attempt} failed:`, rawMsg);

        // If API key is leaked or permission denied, fail fast
        if (rawMsg.includes('leaked') || rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('PERMISSION_DENIED')) {
          throw err;
        }

        // If first attempt failed with transient error (503 / 429 / overloaded), wait 1000ms and retry
        if (attempt === 1 && isTransientAiError(err)) {
          console.log(`[Gemini API] Transient error (503/429/overload) detected. Waiting 1000ms before retry on '${model}'...`);
          await sleep(1000);
          continue;
        }

        // If second attempt failed or non-transient, break to next fallback model
        break;
      }
    }

    if (mIndex < CANDIDATE_AI_MODELS.length - 1) {
      console.log(`[Gemini API] Switching to next fallback model '${CANDIDATE_AI_MODELS[mIndex + 1]}'...`);
      await sleep(300);
    }
  }

  throw lastError || new Error("Hozirda AI serverda yuklama yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.");
}

// AI Gemini test ping endpoint (Admin panel test tugmasi uchun)
app.post('/api/gemini/test', async (req, res) => {
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

// AI Zapchast / Tuning detail analysis endpoint
app.post('/api/analyze-part', async (req, res) => {
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
      // Fetch image from URL and convert to base64
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
  "estimatedPriceRange": "taxminiy narx oralig'i so'mda (masalan: 800 000 - 950 000 so'm)",
  "description": "Detalning vazifasi va o'ziga xosligi haqida 2-3 jumla (o'zbek tilida)",
  "tuningTips": "O'rnatish yoki sifatini bilish bo'yicha usta maslahati (o'zbek tilida)",
  "searchKeywords": ["optra", "stop", "gentra", "fara"]
}`;

    const userText = prompt 
      ? `Foydalanuvchi qo'shimcha so'rovi: "${prompt}". Ushbu rasmdagi detalni aniqlab, ko'rsatilgan JSON strukturasida o'zbek tilida to'liq javob bering.`
      : `Ushbu rasmdagi avtozapchast yoki tyuning detalini aniqlab, ko'rsatilgan JSON strukturasida o'zbek tilida to'liq javob bering.`;

    const ai = getGeminiClient();
    const aiResult = await generateContentWithRetryAndFallback(ai, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          { text: userText },
        ],
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const responseText = aiResult.response.text?.trim() || '{}';
    let parsedResult: any;
    try {
      parsedResult = JSON.parse(responseText);
    } catch {
      // Clean possible markdown code fences
      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      try {
        parsedResult = JSON.parse(cleaned);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("AI tahlil natijasini o'qib bo'lmadi. Qaytadan urinib ko'ring.");
        }
      }
    }

    // Ensure reliable defaults if any field was omitted
    if (!parsedResult.partName) parsedResult.partName = "Avto ehtiyot qismi";
    if (!parsedResult.bazaarName) parsedResult.bazaarName = parsedResult.partName;
    if (!parsedResult.category) parsedResult.category = "Aksessuarlar";
    if (!Array.isArray(parsedResult.compatibleCars)) parsedResult.compatibleCars = ["Gentra", "Cobalt"];
    if (!parsedResult.estimatedPriceRange) parsedResult.estimatedPriceRange = "Kelishilgan narxda";
    if (!parsedResult.description) parsedResult.description = "Avtomobil uchun sifatli ehtiyot qism.";
    if (!Array.isArray(parsedResult.searchKeywords)) parsedResult.searchKeywords = [parsedResult.bazaarName.toLowerCase()];

    return res.json({
      success: true,
      data: parsedResult,
      modelUsed: aiResult.modelUsed,
    });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    const friendlyError = parseGeminiError(error);
    return res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

// Order checkout submission endpoint with direct Telegram dispatch
app.post('/api/orders', async (req, res) => {
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

  // Automatically dispatch order notification to Admin & receipt to customer
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
  const adminChatId = reqAdminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || DEFAULT_TELEGRAM_ADMIN_CHAT_ID;

  dispatchOrderTelegramNotification({
    orderId,
    order,
    items,
    totalAmount,
    botToken,
    adminChatId,
    promoCodeUsed,
    discountAmount,
  }).catch((err) => {
    console.error('[Orders] Failed to dispatch Telegram notification:', err);
  });

  return res.json({
    success: true,
    orderId,
    message: "Buyurtmangiz muvaffaqiyatli qabul qilindi! Menejerimiz tez orada siz bilan bog'lanadi.",
    createdAt: new Date().toISOString(),
  });
});

// Telegram Bot send message endpoint
app.post('/api/telegram/send', async (req, res) => {
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

// Telegram Webhook endpoint (if Webhook mode is used instead of polling)
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || DEFAULT_TELEGRAM_ADMIN_CHAT_ID;
    const appUrl = process.env.APP_URL || DEFAULT_APP_URL;

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

// Telegram Bot live status endpoint
app.get('/api/telegram/bot-status', async (req, res) => {
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
      pollingActive: pollingStatus.isPollingActive,
      lastUpdateId: pollingStatus.lastProcessedUpdateId,
      appUrl: process.env.APP_URL || DEFAULT_APP_URL,
    });
  } catch (err: any) {
    return res.json({
      success: false,
      error: err?.message,
      pollingActive: pollingStatus.isPollingActive,
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} (${isProd ? 'production' : 'development'})`);

    // Start background Telegram Bot service
    const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || DEFAULT_TELEGRAM_ADMIN_CHAT_ID;
    const appUrl = process.env.APP_URL || DEFAULT_APP_URL;

    if (botToken) {
      startTelegramBotPolling({
        botToken,
        adminChatId,
        appUrl,
        getGeminiClient,
      });
    }
  });
}

startServer();
