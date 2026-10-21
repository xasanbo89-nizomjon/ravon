import { GoogleGenAI } from '@google/genai';

export interface BotServiceOptions {
  botToken: string;
  adminChatId: string;
  appUrl: string;
  getGeminiClient: () => GoogleGenAI;
}

let isPollingActive = false;
let pollingAbortController: AbortController | null = null;
let lastProcessedUpdateId = 0;
export const activeAdminChatIds = new Set<string>(['6664036733']);

export const ADMIN_USERNAME = 'Doliyev_dilshod';
export const SECOND_ADMIN_USERNAME = 'Sherzodjanovich_7';
export const ADMIN_USERNAMES = ['Doliyev_dilshod', 'Sherzodjanovich_7'];
export const ADMIN_PHONE = '+998 97 524 04 01';

export async function sendToAllAdmins(
  token: string,
  primaryAdminChatId: string | undefined,
  text: string,
  extra: Record<string, any> = {}
) {
  const targets = new Set<string>();
  if (primaryAdminChatId && primaryAdminChatId.trim()) {
    targets.add(primaryAdminChatId.trim());
  }
  activeAdminChatIds.forEach((id) => {
    if (id) targets.add(String(id).trim());
  });
  // Also include @Doliyev_dilshod and @Sherzodjanovich_7 in case they are channels/groups or addressable usernames
  targets.add(`@${ADMIN_USERNAME}`);
  targets.add(`@${SECOND_ADMIN_USERNAME}`);

  const results = [];
  for (const target of targets) {
    try {
      const res = await sendTelegramMessage(token, target, text, extra);
      results.push(res);
    } catch {
      // ignore individual target error
    }
  }
  return results;
}

export function getCleanAppUrl(customUrl?: string): string {
  const envUrl = customUrl || process.env.APP_URL || process.env.VERCEL_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 5) {
    let url = envUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    return url.replace(/\/+$/, '');
  }
  return 'https://ais-pre-ej5a2rtqfnecjfmxaluobw-211039395967.asia-southeast1.run.app';
}

/**
 * Set Telegram Chat Menu Button (Persistent "Do'konni ochish" Mini App button at the bottom of the chat)
 */
export async function setTelegramChatMenuButton(
  token: string,
  chatId?: string | number,
  webAppUrl?: string
) {
  try {
    const url = getCleanAppUrl(webAppUrl);
    const body: any = {
      menu_button: {
        type: 'web_app',
        text: "Do'konni ochish",
        web_app: {
          url,
        },
      },
    };
    if (chatId) {
      body.chat_id = chatId;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    console.warn('[BotService] setChatMenuButton error:', err);
    return null;
  }
}

export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatUzbekSum(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
}

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(
  token: string,
  chatId: string | number,
  text: string,
  extra: Record<string, any> = {}
) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: extra.parse_mode || 'HTML',
        disable_web_page_preview: extra.disable_web_page_preview ?? true,
        reply_markup: extra.reply_markup,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('[BotService] sendTelegramMessage error:', err);
    return { ok: false, error: err };
  }
}

/**
 * Send chat action (e.g. typing, upload_photo)
 */
export async function sendTelegramChatAction(
  token: string,
  chatId: string | number,
  action: 'typing' | 'upload_photo' = 'typing'
) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    // Non-critical, ignore
  }
}

/**
 * Download a file from Telegram and convert to base64
 */
export async function downloadTelegramFile(token: string, fileId: string) {
  const getFileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const fileData = await getFileRes.json();
  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error(fileData.description || "Telegram fayl yo'lini olib bo'lmadi.");
  }

  const filePath = fileData.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) {
    throw new Error("Telegramdan rasmni yuklab olishda xatolik.");
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  
  let mimeType = 'image/jpeg';
  if (filePath.endsWith('.png')) mimeType = 'image/png';
  if (filePath.endsWith('.webp')) mimeType = 'image/webp';

  return { base64, mimeType };
}

/**
 * Analyze part image with Gemini 3.8 Flash
 */
const CANDIDATE_BOT_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientError(err: any): boolean {
  if (!err) return false;
  const str = (typeof err === 'string' ? err : err?.message || JSON.stringify(err)).toLowerCase();
  return (
    str.includes('503') ||
    str.includes('unavailable') ||
    str.includes('overload') ||
    str.includes('high demand') ||
    str.includes('429') ||
    str.includes('resource_exhausted') ||
    str.includes('rate limit') ||
    str.includes('quota') ||
    str.includes('timeout') ||
    str.includes('try again')
  );
}

/**
 * Analyze part image with Gemini (with Retry & Model Fallback)
 */
export async function analyzePartWithGemini(
  getGeminiClient: () => GoogleGenAI,
  base64Data: string,
  mimeType: string,
  userNotes?: string
) {
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
  "category": "Optika | Salon | Kuzov | Xodovoy | Elektronika | Aksessuarlar",
  "compatibleCars": ["Gentra", "Cobalt"],
  "estimatedPriceRange": "taxminiy narx oralig'i so'mda (masalan: 800 000 - 950 000 so'm)",
  "description": "Detalning vazifasi va o'ziga xosligi haqida 2-3 jumla (o'zbek tilida)",
  "tuningTips": "O'rnatish yoki sifatini bilish bo'yicha usta maslahati (o'zbek tilida)",
  "installationDifficulty": "Oson | O'rtacha | Usta yordami kerak",
  "searchKeywords": ["optra", "stop", "gentra", "fara"]
}`;

  const promptText = userNotes
    ? `Mijoz savoli: "${userNotes}". Ushbu rasmdagi detalni aniqlang va ko'rsatilgan JSON strukturasida o'zbek tilida to'liq javob bering.`
    : `Ushbu rasmdagi avtozapchast yoki tyuning detalini aniqlang va ko'rsatilgan JSON strukturasida o'zbek tilida to'liq javob bering.`;

  const ai = getGeminiClient();
  let lastError: any = null;

  for (let mIndex = 0; mIndex < CANDIDATE_BOT_MODELS.length; mIndex++) {
    const model = CANDIDATE_BOT_MODELS[mIndex];

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              { text: promptText },
            ],
          },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });

        const responseText = response.text?.trim() || '{}';
        let parsed: any;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) parsed = JSON.parse(match[0]);
          }
        }

        if (parsed && (parsed.partName || parsed.bazaarName)) {
          return parsed;
        }
      } catch (err: any) {
        lastError = err;
        if (attempt === 1 && isTransientError(err)) {
          await sleep(1000);
          continue;
        }
        break;
      }
    }
  }

  throw lastError || new Error("Hozirda AI serverda yuklama yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.");
}

/**
 * Handle incoming Telegram Update
 */
export async function handleTelegramUpdate(update: any, options: BotServiceOptions) {
  const { botToken, adminChatId, appUrl, getGeminiClient } = options;
  if (!update) return;

  // 1. Callback query
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    const data = cq.data;

    if (chatId) {
      if (data === 'how_to_search') {
        await sendTelegramMessage(
          botToken,
          chatId,
          `📸 <b>AI orqali Zapchast Qidirish Juda Oson:</b>\n\n` +
          `1️⃣ Avtomobilingiz uchun kerakli detal yoki buzilgan zapchast rasmini to'g'ridan-to'g'ri shu chatga yuboring.\n` +
          `2️⃣ Gemini 3.8 Flash AI bir necha soniyada detalni tahlil qilib, nomini, bozor laqabini, mos mashinalarini va narxini aniqlab beradi.\n` +
          `3️⃣ Bir tugma orqali Mini App orqali buyurtma berasiz yoki do'konimizdan olib ketasiz!`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🚀 Do'konni Ochish (Mini App)", web_app: { url: appUrl } }]
              ]
            }
          }
        );
      } else if (data === 'contact_info') {
        const cleanAppUrl = getCleanAppUrl(appUrl);
        await sendTelegramMessage(
          botToken,
          chatId,
          `📞 <b>"Ravon Auto Tuning" Aloqa Ma'lumotlari:</b>\n\n` +
          `🏢 <b>Do'kon manzili:</b> Namangan viloyati, Uychi tumani (Ravon Auto Tuning markazi).\n` +
          `📱 <b>Telefon / SMS:</b> ${ADMIN_PHONE}\n` +
          `💬 <b>Adminlar Telegram:</b> @${ADMIN_USERNAME} va @${SECOND_ADMIN_USERNAME}\n` +
          `⏰ <b>Ish tartibi:</b> Har kuni 08:30 dan 20:00 gacha (dam olish kunisiz)`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: `💬 @${ADMIN_USERNAME}`, url: `https://t.me/${ADMIN_USERNAME}` },
                  { text: `💬 @${SECOND_ADMIN_USERNAME}`, url: `https://t.me/${SECOND_ADMIN_USERNAME}` }
                ],
                [{ text: "🛍 Do'konni ochish", web_app: { url: cleanAppUrl } }]
              ]
            }
          }
        );
      } else if (data === 'location_info') {
        const cleanAppUrl = getCleanAppUrl(appUrl);
        await sendTelegramMessage(
          botToken,
          chatId,
          `📍 <b>Bizning Joylashuvimiz:</b>\n\n` +
          `Namangan viloyati, Uychi tumani, Avto ehtiyot qismlar va tyuning markazi (Ravon Auto Tuning do'koni).\n` +
          `📞 Bog'lanish: ${ADMIN_PHONE} (@${ADMIN_USERNAME} / @${SECOND_ADMIN_USERNAME})`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🛍 Do'konni ochish", web_app: { url: cleanAppUrl } }]
              ]
            }
          }
        );
      } else if (data === 'delivery_info') {
        const cleanAppUrl = getCleanAppUrl(appUrl);
        await sendTelegramMessage(
          botToken,
          chatId,
          `🚚 <b>Yetkazib Berish Shartlari:</b>\n\n` +
          `🚗 <b>Namangan viloyati va Uychi tumani bo'ylab:</b> Tezkor kuryer orqali eshikkacha yetkaziladi.\n` +
          `📦 <b>O'zbekiston viloyatlari bo'ylab:</b> BTS Pochta yoki Fargo xizmatlari orqali 24 soat ichida yetkaziladi.\n` +
          `🏢 <b>Olib ketish (Samovivoz):</b> Namangan viloyati, Uychi tumanidagi do'konimizdan bepul olib ketishingiz mumkin.\n` +
          `💳 <b>To'lov:</b> Click, Payme yoki tovar qo'lga yetganda naqd pul.\n` +
          `📞 Ma'lumot uchun: ${ADMIN_PHONE} (@${ADMIN_USERNAME} / @${SECOND_ADMIN_USERNAME})`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🛍 Do'konni ochish", web_app: { url: cleanAppUrl } }]
              ]
            }
          }
        );
      }
    }
    return;
  }

  const message = update.message;
  if (!message) return;

  const chatId = message.chat?.id;
  if (!chatId) return;

  const customerName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Hurmatli mijoz';
  const username = message.from?.username || '';
  const isRegisteredAdminUser = ADMIN_USERNAMES.some(
    (u) => u.toLowerCase() === username.toLowerCase()
  );

  // If message is from @Doliyev_dilshod or @Sherzodjanovich_7, register their chatId in activeAdminChatIds
  if (isRegisteredAdminUser) {
    activeAdminChatIds.add(String(chatId));
    console.log(`[BotService] Admin @${username} ulandi! Chat ID: ${chatId}`);
  }

  // 2. Handle /start command or greeting text
  if (message.text && (message.text.startsWith('/start') || message.text.startsWith('/help') || message.text.toLowerCase() === 'salom')) {
    const cleanAppUrl = getCleanAppUrl(appUrl);

    // Set Menu Button for this chat so the persistent "Do'konni ochish" button is activated
    setTelegramChatMenuButton(botToken, chatId, cleanAppUrl).catch(() => {});

    const welcomeHtml = isRegisteredAdminUser
      ? `👑 <b>Assalomu alaykum, Admin (@${escapeHtml(username)})!</b>\n\n` +
        `🚗 <b>"Ravon Auto Tuning"</b> tizimiga Bosh Admin sifatida xush kelibsiz!\n` +
        `✅ Ushbu chat botga muvaffaqiyatli bog'landi (Chat ID: <code>${chatId}</code>).\n` +
        `📦 Saytdan tushgan yangi buyurtmalar va xabarlar to'g'ridan-to'g'ri ushbu chatga (@${ADMIN_USERNAME} va @${SECOND_ADMIN_USERNAME}) keladi.\n\n` +
        `<i>Do'konni Mini App sifatida ochish uchun quyidagi tugmani bosing:</i>`
      : `👋 <b>Assalomu alaykum, ${escapeHtml(customerName)}!</b>\n\n` +
        `🚗 <b>"Ravon Auto Tuning"</b> rasmiy internet do'koni va AI yordamchisiga xush kelibsiz!\n\n` +
        `Bizda GM avtomobillari (<b>Gentra, Cobalt, Nexia 3, Damas, Spark, Malibu 1/2, Tracker, Onix</b>) uchun eng sara ehtiyot qismlar, tyuning optikalari va salon detallari mavjud.\n\n` +
        `✨ <b>Asosiy Imkoniyatlar:</b>\n` +
        `🛍 <b>Telegram Mini App:</b> Telegram'dan chiqmasdan to'liq katalogdan foydalaning va buyurtma bering.\n` +
        `📸 <b>AI Zapchast qidiruv:</b> Botga istalgan detal rasmini yuboring — sun'iy intellekt uni 2 soniyada aniqlaydi!\n` +
        `🚚 <b>O'zbekiston bo'ylab:</b> 24 soat ichida eshikkacha tezkor yetkazib berish!\n\n` +
        `<i>Do'konimizni ochish uchun quyidagi "Do'konni ochish" tugmasini bosing:</i>`;

    await sendTelegramMessage(botToken, chatId, welcomeHtml, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🛍 Do'konni ochish", web_app: { url: cleanAppUrl } }
          ],
          [
            { text: "🌐 Sayt orqali ko'rish (Brauzer)", url: cleanAppUrl }
          ],
          [
            { text: "📸 Rasm orqali qidirish (AI)", callback_data: "how_to_search" },
            { text: `📞 @${ADMIN_USERNAME}`, url: `https://t.me/${ADMIN_USERNAME}` }
          ],
          [
            { text: `📞 @${SECOND_ADMIN_USERNAME}`, url: `https://t.me/${SECOND_ADMIN_USERNAME}` },
            { text: "📍 Bizning manzil", callback_data: "location_info" }
          ]
        ]
      }
    });
    return;
  }

  // 3. Handle PHOTO upload (The core AI Photo Search feature requested by user)
  if (message.photo && message.photo.length > 0) {
    await sendTelegramChatAction(botToken, chatId, 'typing');

    await sendTelegramMessage(
      botToken,
      chatId,
      `🔍 <i>Rasm qabul qilindi. AI orqali avtomobil detali tahlil qilinmoqda, bir oz kuting...</i>`
    );

    try {
      const photoItem = message.photo[message.photo.length - 1];
      const { base64, mimeType } = await downloadTelegramFile(botToken, photoItem.file_id);

      await sendTelegramChatAction(botToken, chatId, 'typing');

      const aiResult = await analyzePartWithGemini(getGeminiClient, base64, mimeType, message.caption);

      const compatibleCarsStr = (aiResult.compatibleCars || []).join(', ') || 'Barcha GM modellari';
      const searchUrl = `${appUrl}?search=${encodeURIComponent(aiResult.bazaarName || aiResult.partName || '')}`;

      const replyHtml = 
        `🔍 <b>AI ZAPCHAST TAHLILI NATIJASI:</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🏷 <b>Bozor laqabi:</b> <b>"${escapeHtml(aiResult.bazaarName)}"</b>\n` +
        `📌 <b>Aniq nomi:</b> ${escapeHtml(aiResult.partName)}\n` +
        `🚗 <b>Mos mashinalar:</b> ${escapeHtml(compatibleCarsStr)}\n` +
        `📂 <b>Kategoriya:</b> ${escapeHtml(aiResult.category || 'Tyuning')}\n` +
        `💵 <b>Taxminiy bozor narxi:</b> <b>${escapeHtml(aiResult.estimatedPriceRange || 'Kelishilgan narx')}</b>\n` +
        (aiResult.installationDifficulty ? `🔧 <b>O'rnatish qiyinligi:</b> ${escapeHtml(aiResult.installationDifficulty)}\n` : '') +
        `\n📝 <b>Tavsif:</b>\n<i>${escapeHtml(aiResult.description || '')}</i>\n` +
        (aiResult.tuningTips ? `\n💡 <b>Usta maslahati:</b>\n<i>"${escapeHtml(aiResult.tuningTips)}"</i>\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🛒 <i>Ushbu detalni do'konimizdan onlayn buyurtma qilish uchun quyidagi tugmani bosing:</i>`;

      await sendTelegramMessage(botToken, chatId, replyHtml, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `🛒 "${aiResult.bazaarName}" ni Do'kondan Ko'rish (Mini App)`, web_app: { url: searchUrl } }],
            [
              { text: `💬 @${ADMIN_USERNAME}`, url: `https://t.me/${ADMIN_USERNAME}` },
              { text: `💬 @${SECOND_ADMIN_USERNAME}`, url: `https://t.me/${SECOND_ADMIN_USERNAME}` }
            ]
          ]
        }
      });

      const adminHtml = 
        `⚡ <b>BOT ORQALI YANGI AI DETAL QIDIRUVI!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Mijoz:</b> ${escapeHtml(customerName)} ${username ? `(@${escapeHtml(username)})` : ''}\n` +
        `🆔 <b>Telegram Chat ID:</b> <code>${chatId}</code>\n` +
        (message.caption ? `💬 <b>Mijoz izohi:</b> <i>"${escapeHtml(message.caption)}"</i>\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚙️ <b>AI aniqlagan detal:</b>\n` +
        `🏷 <b>Bozor laqabi:</b> <b>"${escapeHtml(aiResult.bazaarName)}"</b>\n` +
        `📌 <b>Nomi:</b> ${escapeHtml(aiResult.partName)}\n` +
        `🚗 <b>Mos mashinalar:</b> ${escapeHtml(compatibleCarsStr)}\n` +
        `💵 <b>Taxminiy narx:</b> ${escapeHtml(aiResult.estimatedPriceRange)}\n` +
        `⏰ <b>Vaqti:</b> ${new Date().toLocaleString('uz-UZ')}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👨‍💼 <b>Adminlar:</b> @${ADMIN_USERNAME} | @${SECOND_ADMIN_USERNAME} (${ADMIN_PHONE})`;

      await sendToAllAdmins(botToken, adminChatId, adminHtml);
    } catch (err: any) {
      console.error('[BotService] Error analyzing photo:', err);
      await sendTelegramMessage(
        botToken,
        chatId,
        `⚠️ <b>Rasmni tahlil qilishda xatolik yuz berdi.</b>\n` +
        `Iltimos, detalni yaqindan va tiniqroq qilib qayta yuboring yoki quyidagi tugma orqali do'konimizdan qidiring.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🚀 Do'kondan qidirish (Mini App)", web_app: { url: appUrl } }],
              [
                { text: `💬 @${ADMIN_USERNAME}`, url: `https://t.me/${ADMIN_USERNAME}` },
                { text: `💬 @${SECOND_ADMIN_USERNAME}`, url: `https://t.me/${SECOND_ADMIN_USERNAME}` }
              ]
            ]
          }
        }
      );
    }
    return;
  }

  // 4. Fallback for text messages
  if (message.text) {
    const searchUrl = `${appUrl}?search=${encodeURIComponent(message.text.trim())}`;
    await sendTelegramMessage(
      botToken,
      chatId,
      `Rahmat, <b>${escapeHtml(customerName)}</b>!\n\n` +
      `Siz <i>"${escapeHtml(message.text)}"</i> haqida so'radingiz.\n\n` +
      `📸 Agar qo'lingizda zapchast yoki detalning rasmi bo'lsa, uni shu yerga rasm sifatida yuboring — AI uni darhol aniqlab beradi.\n` +
      `Yoki quyidagi tugma orqali qidiruv natijalarini to'g'ridan-to'g'ri internet-do'konimizda ko'rishingiz mumkin:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: `🔍 "${message.text.slice(0, 20)}" ni Do'konda Ko'rish`, web_app: { url: searchUrl } }],
            [{ text: "🛍 Do'konni ochish", web_app: { url: getCleanAppUrl(appUrl) } }],
            [
              { text: `💬 @${ADMIN_USERNAME}`, url: `https://t.me/${ADMIN_USERNAME}` },
              { text: `💬 @${SECOND_ADMIN_USERNAME}`, url: `https://t.me/${SECOND_ADMIN_USERNAME}` }
            ]
          ]
        }
      }
    );
  }
}

/**
 * Start long-polling for Telegram Bot
 */
export function startTelegramBotPolling(options: BotServiceOptions) {
  if (isPollingActive) {
    console.log('[BotService] Polling already running.');
    return;
  }

  isPollingActive = true;
  pollingAbortController = new AbortController();

  console.log('[BotService] Telegram bot long-polling started...');

  // Set default persistent Mini App button ("Do'konni ochish") globally for all users
  setTelegramChatMenuButton(options.botToken, undefined, options.appUrl).catch((err) => {
    console.warn('[BotService] Initial setChatMenuButton error:', err);
  });

  (async () => {
    while (isPollingActive) {
      try {
        const url = `https://api.telegram.org/bot${options.botToken}/getUpdates?offset=${lastProcessedUpdateId + 1}&timeout=15&limit=10`;
        const res = await fetch(url, { signal: pollingAbortController?.signal });
        if (!res.ok) {
          // If 409 conflict (e.g. another instance or webhook set), wait longer
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }

        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastProcessedUpdateId = Math.max(lastProcessedUpdateId, update.update_id);
            // Process update asynchronously without blocking polling loop
            handleTelegramUpdate(update, options).catch(e => {
              console.error('[BotService] Error handling update:', e);
            });
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') break;
        // Wait before retry
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    console.log('[BotService] Telegram bot long-polling stopped.');
  })();
}

/**
 * Stop polling
 */
export function stopTelegramBotPolling() {
  isPollingActive = false;
  if (pollingAbortController) {
    pollingAbortController.abort();
    pollingAbortController = null;
  }
}

/**
 * Get bot status
 */
export function getBotServiceStatus() {
  return {
    isPollingActive,
    lastProcessedUpdateId,
  };
}

/**
 * Format and send order notification to Admin & receipt to customer
 * Ensures:
 * 1. Admin receives strict CONFIDENTIAL notification with all customer & order details
 * 2. Customer receives ONLY their own official electronic receipt (Chek)
 * 3. Complete privacy isolation between customers
 */
export async function dispatchOrderTelegramNotification(params: {
  orderId: string;
  order: any;
  items: any[];
  totalAmount: number;
  botToken: string;
  adminChatId: string;
  adminUsername?: string;
  adminPhone?: string;
  promoCodeUsed?: string;
  discountAmount?: number;
}) {
  const { orderId, order, items, totalAmount, botToken, adminChatId, promoCodeUsed, discountAmount } = params;
  if (!botToken) return;

  const cleanOrderId = orderId.replace(/\D/g, '') || orderId;

  const deliveryLabel = 
    order?.deliveryMethod === 'courier' ? '🚗 Kuryer orqali (eshikkacha)' :
    order?.deliveryMethod === 'post' ? '📦 BTS / Fargo pochta punkti' :
    '🏢 Namangan viloyati, Uychi tumanidan olib ketish';

  const paymentLabel = 
    order?.paymentMethod === 'click' ? '💳 Click Up (Online)' :
    order?.paymentMethod === 'payme' ? '💳 Payme (Online)' :
    '💵 Naqd pul (Qabul qilinganda)';

  // Items formatted for admin
  const adminItemsList = (items || []).map((it, idx) => {
    const p = it.product || it;
    return `${idx + 1}. <b>${escapeHtml(p.name || 'Zapchast')}</b>\n   🏷 Bozor laqabi: <i>"${escapeHtml(p.bazaarName || p.name || '')}"</i>\n   🔢 Soni: <b>${it.quantity || 1} dona</b> | Narxi: ${formatUzbekSum((p.price || 0) * (it.quantity || 1))}`;
  }).join('\n\n');

  // Items formatted for customer receipt
  const customerItemsList = (items || []).map((it, idx) => {
    const p = it.product || it;
    return `▫️ <b>${escapeHtml(p.name || 'Detal')}</b> (${it.quantity || 1} dona) — ${formatUzbekSum((p.price || 0) * (it.quantity || 1))}`;
  }).join('\n');

  // 1. BARCHA ADMINLARGA MAXFIY XABAR (@Doliyev_dilshod va @Sherzodjanovich_7 + adminChatId)
  const adminMessage = 
    `🔒 <b>MAXFIY XABAR (ADMINLAR UCHUN)</b>\n` +
    `🔥 <b>YANGI BUYURTMA KELDI! #RAV-${cleanOrderId}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ <i>Diqqat: Ushbu ma'lumotlar maxfiy hisoblanib, faqat ma'muriyat (@${ADMIN_USERNAME} va @${SECOND_ADMIN_USERNAME}) uchun mo'ljallangan.</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Xaridor:</b> ${escapeHtml(order?.fullName || 'Mijoz')}\n` +
    `📞 <b>Telefon:</b> <code>${escapeHtml(order?.phone || '')}</code>\n` +
    (order?.telegramUsername ? `💬 <b>Telegram:</b> @${escapeHtml(order.telegramUsername)}\n` : '') +
    (order?.telegramUserId ? `🆔 <b>Telegram ID:</b> <code>${order.telegramUserId}</code> (Mini App)\n` : '') +
    `📍 <b>Viloyat / Manzil:</b> ${escapeHtml(order?.region || '')}, ${escapeHtml(order?.cityAddress || '')}\n` +
    `🚚 <b>Yetkazish turi:</b> ${deliveryLabel}\n` +
    `💳 <b>To‘lov usuli:</b> ${paymentLabel}\n` +
    (promoCodeUsed ? `🎟 <b>Promokod:</b> <code>${escapeHtml(promoCodeUsed)}</code> (Chegirma: <b>-${formatUzbekSum(discountAmount || 0)}</b>)\n` : '') +
    (order?.notes ? `📝 <b>Izoh / Mashina yili:</b> ${escapeHtml(order.notes)}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 <b>BUYURTMA TARKIBI (${items.length} xil detal):</b>\n` +
    `${adminItemsList}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>JAMI TO‘LOV SUMMASI:</b> <b>${formatUzbekSum(totalAmount)}</b>\n` +
    `⏰ <b>Qabul qilingan vaqt:</b> ${new Date().toLocaleString('uz-UZ')}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👨‍💼 <b>Mas'ul Adminlar:</b> @${ADMIN_USERNAME} va @${SECOND_ADMIN_USERNAME} (Tel: ${ADMIN_PHONE})\n` +
    `✅ <i>Xaridorga shaxsiy xarid cheki taqdim etildi. Darhol bog‘lanish tavsiya etiladi.</i>`;

  await sendToAllAdmins(botToken, adminChatId, adminMessage);

  // 2. XARIDORGA FAQAT O'ZINING BUYURTMASI CHEKI (Customer only receives their personal receipt)
  if (order?.telegramUserId) {
    const customerReceipt = 
      `🧾 <b>"RAVON AUTO TUNING" — ELEKTRON XARID CHEKI</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ <b>Hurmatli ${escapeHtml(order?.fullName || 'Xaridor')}, buyurtmangiz muvaffaqiyatli qabul qilindi!</b>\n\n` +
      `📄 <b>Chek raqami:</b> <code>#RAV-${cleanOrderId}</code>\n` +
      `⏰ <b>Vaqti:</b> ${new Date().toLocaleString('uz-UZ')}\n` +
      `🚚 <b>Yetkazish:</b> ${deliveryLabel}\n` +
      `📍 <b>Manzil:</b> ${escapeHtml(order?.region || '')}, ${escapeHtml(order?.cityAddress || '')}\n` +
      `💳 <b>To‘lov turi:</b> ${paymentLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🛒 <b>XARID QILINGAN DETALLAR:</b>\n` +
      `${customerItemsList}\n` +
      (promoCodeUsed ? `🎟 <b>Qo‘llanilgan promokod:</b> <code>${escapeHtml(promoCodeUsed)}</code> (-${formatUzbekSum(discountAmount || 0)})\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 <b>JAMI TO‘LOV:</b> <b>${formatUzbekSum(totalAmount)}</b>\n` +
      `📊 <b>Holati:</b> 🟢 <b>Qabul qilindi (Kutilmoqda)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📞 <b>Aloqa:</b> ${ADMIN_PHONE} | @${ADMIN_USERNAME} | @${SECOND_ADMIN_USERNAME}\n` +
      `🚗 <i>Menejerimiz yaqin daqiqalarda siz bilan aloqaga chiqadi. Xaridingiz uchun tashakkur!</i>`;

    const cleanAppUrl = getCleanAppUrl();
    await sendTelegramMessage(botToken, order.telegramUserId, customerReceipt, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `💬 @${ADMIN_USERNAME}`, url: `https://t.me/${ADMIN_USERNAME}` },
            { text: `💬 @${SECOND_ADMIN_USERNAME}`, url: `https://t.me/${SECOND_ADMIN_USERNAME}` }
          ],
          [{ text: "🛍 Do'konni qayta ochish", web_app: { url: cleanAppUrl } }]
        ]
      }
    });
  }
}
