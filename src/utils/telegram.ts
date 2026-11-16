import { CartItem, OrderForm, AiAnalysisResult } from '../types';
import { formatUzbekSum } from './formatters';
import { safeFetchJson, cleanFriendlyErrorMessage } from './apiClient';

export const STORE_WEBAPP_URL = 'https://ravon-alpha.vercel.app/';
export const ACTIVE_TELEGRAM_BOT_USERNAME = 'ravonavto_bot';
export const ACTIVE_TELEGRAM_BOT_URL = 'https://t.me/ravonavto_bot';
export const ACTIVE_TELEGRAM_BOT_TOKEN = '9275377452:AAFe5jKxocDThflP-icoMWITCNeJyuSKWbw';

export function normalizeTelegramBotToken(rawToken?: string): string {
  const trimmed = (rawToken || '').trim();
  if (!trimmed || trimmed.includes('8606681013')) {
    return ACTIVE_TELEGRAM_BOT_TOKEN;
  }
  return trimmed;
}

function base64DataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } | null {
  try {
    const match = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    const mimeType = match ? match[1] : 'image/jpeg';
    const rawBase64 = match ? match[2] : dataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    const byteCharacters = atob(rawBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return {
      blob: new Blob([byteArray], { type: mimeType }),
      mimeType,
    };
  } catch {
    return null;
  }
}

export async function sendTelegramPhoto(
  token: string,
  chatId: string,
  photoDataUrlOrUrl: string,
  caption: string,
  parseMode = 'HTML'
): Promise<{ success: boolean; error?: string }> {
  const effectiveToken = normalizeTelegramBotToken(token);
  if (!effectiveToken || !chatId || !photoDataUrlOrUrl) {
    return { success: false, error: 'Telegram Bot Token, Chat ID yoki rasm kiritilmagan.' };
  }

  const defaultReplyMarkup = {
    inline_keyboard: [
      [{ text: "🛍 Do'konni ochish (Mini App)", web_app: { url: STORE_WEBAPP_URL } }],
      [{ text: "🌐 Sayt orqali ko'rish (Brauzer)", url: STORE_WEBAPP_URL }],
    ],
  };

  const safeCaption = caption.length > 1020 ? caption.slice(0, 1015) + '...' : caption;

  try {
    // 1. Try internal backend proxy first (/api/telegram/send-photo)
    const res = await safeFetchJson<{ success: boolean; error?: string }>(
      '/api/telegram/send-photo',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: effectiveToken,
          chatId: chatId.trim(),
          photo: photoDataUrlOrUrl,
          caption: safeCaption,
          parseMode,
          reply_markup: defaultReplyMarkup,
        }),
      }
    );

    if (res.ok && res.data?.success) {
      return { success: true };
    }

    // 2. Direct fallback to Telegram Bot API `sendPhoto`
    const parsedBlob = photoDataUrlOrUrl.startsWith('data:')
      ? base64DataUrlToBlob(photoDataUrlOrUrl)
      : null;

    if (parsedBlob) {
      const formData = new FormData();
      formData.append('chat_id', chatId.trim());
      formData.append('photo', parsedBlob.blob, 'payment-receipt.jpg');
      formData.append('caption', safeCaption);
      formData.append('parse_mode', parseMode);
      formData.append('reply_markup', JSON.stringify(defaultReplyMarkup));

      const directResp = await fetch(`https://api.telegram.org/bot${effectiveToken}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });
      const directData = await directResp.json();
      if (directResp.ok && directData?.ok) {
        return { success: true };
      }
      return {
        success: false,
        error: cleanFriendlyErrorMessage(
          directData?.description || res.error || 'Telegram sendPhoto xatosi'
        ),
      };
    } else {
      const directRes = await safeFetchJson<{ ok: boolean; description?: string }>(
        `https://api.telegram.org/bot${effectiveToken}/sendPhoto`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId.trim(),
            photo: photoDataUrlOrUrl,
            caption: safeCaption,
            parse_mode: parseMode,
            reply_markup: defaultReplyMarkup,
          }),
        }
      );
      if (directRes.ok && directRes.data?.ok) {
        return { success: true };
      }
      return {
        success: false,
        error: cleanFriendlyErrorMessage(
          directRes.data?.description || res.error || 'Telegram sendPhoto xatosi'
        ),
      };
    }
  } catch (err: any) {
    console.warn('Telegram sendPhoto error:', err);
    return { success: false, error: cleanFriendlyErrorMessage(err?.message) };
  }
}

export async function sendTelegramNotification(
  token: string,
  chatId: string,
  text: string,
  parseMode = 'HTML'
): Promise<{ success: boolean; error?: string }> {
  const effectiveToken = normalizeTelegramBotToken(token);
  if (!effectiveToken || !chatId) {
    return { success: false, error: 'Telegram Bot Token yoki Chat ID kiritilmagan.' };
  }

  const defaultReplyMarkup = {
    inline_keyboard: [
      [{ text: "🛍 Do'konni ochish (Mini App)", web_app: { url: STORE_WEBAPP_URL } }],
      [{ text: "🌐 Sayt orqali ko'rish (Brauzer)", url: STORE_WEBAPP_URL }],
    ],
  };

  // Ensure Telegram Chat Menu Button points strictly to https://ravon-alpha.vercel.app/
  fetch(`https://api.telegram.org/bot${effectiveToken}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: "Do'konni ochish",
        web_app: { url: STORE_WEBAPP_URL },
      },
    }),
  }).catch(() => {});

  try {
    // 1. Try internal backend proxy first
    const res = await safeFetchJson<{ success: boolean; error?: string }>('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: effectiveToken,
        chatId: chatId.trim(),
        text,
        parseMode,
        reply_markup: defaultReplyMarkup,
      }),
    });

    if (res.ok && res.data?.success) {
      return { success: true };
    }

    // 2. Direct fallback to Telegram API in case backend fails (e.g. 404 on Vercel)
    const directRes = await safeFetchJson<{ ok: boolean; description?: string }>(
      `https://api.telegram.org/bot${effectiveToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text,
          parse_mode: parseMode,
          reply_markup: defaultReplyMarkup,
        }),
      }
    );

    if (directRes.ok && directRes.data?.ok) {
      return { success: true };
    } else {
      return {
        success: false,
        error: cleanFriendlyErrorMessage(
          directRes.data?.description || res.error || 'Telegram bilan bog‘lanishda xatolik'
        ),
      };
    }
  } catch (err: any) {
    console.warn('Telegram notification error:', err);
    return { success: false, error: cleanFriendlyErrorMessage(err?.message) };
  }
}

export function formatOrderPhotoCaption(
  orderId: string,
  orderData: OrderForm,
  items: CartItem[],
  totalAmount: number
): string {
  const cleanId = orderId.replace(/\D/g, '') || orderId;
  const deliveryLabel =
    orderData.deliveryMethod === 'courier'
      ? '🚗 Kuryer orqali'
      : orderData.deliveryMethod === 'post'
      ? '📦 BTS / Fargo pochta'
      : '🏢 Uychi tumanidan olib ketish';

  const paymentLabel =
    orderData.paymentMethod === 'click'
      ? '💳 Click Up (Online)'
      : orderData.paymentMethod === 'payme'
      ? '💳 Payme (Online)'
      : '💵 Naqd pul';

  const itemsList = items
    .map(
      (it, idx) =>
        `${idx + 1}. <b>${escapeHtml(it.product.bazaarName || it.product.name)}</b> × ${
          it.quantity
        } dona = ${formatUzbekSum(it.product.price * it.quantity)}`
    )
    .join('\n');

  const caption = `🧾 <b>ONLAYN TO‘LOV CHEKI BILAN YANGI BUYURTMA! #RAV-${cleanId}</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Xaridor:</b> ${escapeHtml(orderData.fullName)}
📞 <b>Telefon:</b> <code>${escapeHtml(orderData.phone)}</code>
${orderData.telegramUsername ? `💬 <b>Telegram:</b> @${escapeHtml(orderData.telegramUsername)}\n` : ''}📍 <b>Manzil:</b> ${escapeHtml(orderData.region)}, ${escapeHtml(orderData.cityAddress)}
🚚 <b>Yetkazish:</b> ${deliveryLabel}
💳 <b>To‘lov:</b> ${paymentLabel} (📸 Chek skrinshoti ilova qilingan)
${orderData.notes ? `📝 <b>Izoh:</b> ${escapeHtml(orderData.notes)}\n` : ''}━━━━━━━━━━━━━━━━━━━━
📦 <b>Detallar (${items.length} xil):</b>
${itemsList}
━━━━━━━━━━━━━━━━━━━━
💰 <b>JAMI SUMMA:</b> <b>${formatUzbekSum(totalAmount)}</b>
📊 <b>Holati:</b> 🟡 <b>To‘lov cheki tekshirilmoqda</b>
📞 <b>Admin:</b> +998 (95) 463-37-36`;

  return caption.length > 1020 ? caption.slice(0, 1015) + '...' : caption;
}

export function formatOrderTelegramMessage(
  orderId: string,
  orderData: OrderForm,
  items: CartItem[],
  totalAmount: number
): string {
  const cleanId = orderId.replace(/\D/g, '') || orderId;
  const deliveryLabel =
    orderData.deliveryMethod === 'courier'
      ? '🚗 Kuryer orqali (eshikkacha)'
      : orderData.deliveryMethod === 'post'
      ? '📦 BTS / Fargo pochta punkti'
      : '🏢 Namangan viloyati, Uychi tumanidan olib ketish';

  const paymentLabel =
    orderData.paymentMethod === 'click'
      ? '💳 Click Up (Online)'
      : orderData.paymentMethod === 'payme'
      ? '💳 Payme (Online)'
      : '💵 Naqd pul (Qabul qilinganda)';

  const itemsList = items
    .map((it, idx) => {
      return `${idx + 1}. <b>${escapeHtml(it.product.name)}</b>\n   🏷 Bozor laqabi: <i>"${escapeHtml(
        it.product.bazaarName
      )}"</i>\n   🔢 Soni: <b>${it.quantity} dona</b> | Narxi: ${formatUzbekSum(
        it.product.price * it.quantity
      )}`;
    })
    .join('\n\n');

  const receiptLine =
    orderData.paymentMethod !== 'cash'
      ? `🧾 <b>To‘lov cheki:</b> ${
          orderData.receiptImage
            ? '✅ Yuklangan (To‘lov cheki tekshirilmoqda)'
            : '⚠️ Yuklanmagan'
        }\n`
      : '';

  return `🔒 <b>MAXFIY XABAR (FAQAT ADMIN UCHUN)</b>
🔥 <b>YANGI BUYURTMA KELDI! #RAV-${cleanId}</b>
━━━━━━━━━━━━━━━━━━━━
⚠️ <i>Diqqat: Ushbu ma'lumotlar maxfiy bo'lib, faqat ma'muriyat uchun mo'ljallangan. Boshqa mijozlarga oshkor etilmaydi.</i>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Xaridor:</b> ${escapeHtml(orderData.fullName)}
📞 <b>Telefon:</b> <code>${escapeHtml(orderData.phone)}</code>
${orderData.telegramUsername ? `💬 <b>Telegram:</b> @${escapeHtml(orderData.telegramUsername)}\n` : ''}${orderData.telegramUserId ? `🆔 <b>Telegram ID:</b> <code>${orderData.telegramUserId}</code> (Mini App)\n` : ''}📍 <b>Viloyat / Manzil:</b> ${escapeHtml(orderData.region)}, ${escapeHtml(orderData.cityAddress)}
🚚 <b>Yetkazish turi:</b> ${deliveryLabel}
💳 <b>To‘lov usuli:</b> ${paymentLabel}
${receiptLine}${orderData.notes ? `📝 <b>Izoh / Mashina yili:</b> ${escapeHtml(orderData.notes)}\n` : ''}━━━━━━━━━━━━━━━━━━━━
📦 <b>BUYURTMA TARKIBI (${items.length} xil detal):</b>
${itemsList}

━━━━━━━━━━━━━━━━━━━━
💰 <b>JAMI TO‘LOV SUMMASI:</b> <b>${formatUzbekSum(totalAmount)}</b>
⏰ <b>Qabul qilingan vaqt:</b> ${new Date().toLocaleString('uz-UZ')}
━━━━━━━━━━━━━━━━━━━━
📞 <b>Admin aloqa:</b> +998 (95) 463-37-36 (@Doliyev_dilshod / @Sherzodjanovich_7)
✅ <i>Xaridorga shaxsiy chek berildi. Mijoz bilan darhol bog‘lanish tavsiya etiladi.</i>`;
}

export function formatCustomerReceiptText(
  orderId: string,
  orderData: OrderForm,
  items: CartItem[],
  totalAmount: number
): string {
  const cleanId = orderId.replace(/\D/g, '') || orderId;
  const itemsText = items
    .map(
      (it, i) =>
        `${i + 1}. ${it.product.name} x ${it.quantity} dona = ${formatUzbekSum(
          it.product.price * it.quantity
        )}`
    )
    .join('\n');

  const statusText =
    orderData.paymentMethod !== 'cash'
      ? 'To‘lov cheki tekshirilmoqda'
      : 'Qabul qilindi';

  return `========================================
   RAVON AUTO TUNING - ELEKTRON CHEK
========================================
Chek raqami: #RAV-${cleanId}
Sana: ${new Date().toLocaleString('uz-UZ')}
Xaridor: ${orderData.fullName}
Telefon: ${orderData.phone}
Manzil: ${orderData.region}, ${orderData.cityAddress}
Yetkazish turi: ${
    orderData.deliveryMethod === 'courier'
      ? 'Kuryer'
      : orderData.deliveryMethod === 'post'
      ? 'Pochta'
      : "Do'kondan olib ketish"
  }
To'lov usuli: ${orderData.paymentMethod.toUpperCase()}
----------------------------------------
MAHSULOTLAR:
${itemsText}
----------------------------------------
JAMI SUMMA: ${formatUzbekSum(totalAmount)}
HOLATI: ${statusText}
----------------------------------------
Manzil: Namangan viloyati, Uychi tumani (Ravon Auto Tuning)
Tel: +998 (95) 463-37-36 | Telegram Bot: @ravonavto_bot
Ushbu chek faqat sizning shaxsiy xaridingiz uchun rasmiy hisoblanadi.
========================================`;
}

export function formatAiInquiryTelegramMessage(
  customerName: string,
  customerPhone: string,
  aiResult: AiAnalysisResult,
  userNotes?: string
): string {
  const cars = (aiResult.compatibleCars || []).join(', ');

  return `🔍 <b>YANGI QIDIRUV SO‘ROVI (AI orqali):</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Mijoz:</b> ${escapeHtml(customerName)}
📞 <b>Telefon raqami:</b> <code>${escapeHtml(customerPhone)}</code>
${userNotes ? `💬 <b>Mijoz savoli / izohi:</b> <i>"${escapeHtml(userNotes)}"</i>\n` : ''}
━━━━━━━━━━━━━━━━━━━━
⚙️ <b>AI aniqlagan detal:</b>
🏷 <b>Bozor laqabi:</b> <b>"${escapeHtml(aiResult.bazaarName)}"</b>
📌 <b>Aniq nomi:</b> ${escapeHtml(aiResult.partName)}
🚗 <b>Mos mashinalar:</b> ${escapeHtml(cars || 'Barcha GM')}
📂 <b>Kategoriya:</b> ${escapeHtml(aiResult.category)}
💡 <b>Usta maslahati:</b> ${escapeHtml(aiResult.tuningTips || aiResult.description)}
━━━━━━━━━━━━━━━━━━━━
⏰ <b>Vaqti:</b> ${new Date().toLocaleString('uz-UZ')}
⚡ <i>Mijoz ushbu detal do‘konda bor-yo‘qligini va aniq narxini kutmoqda (+998 95 463-37-36).</i>`;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
