import { CartItem, OrderForm, AiAnalysisResult } from '../types';
import { formatUzbekSum } from './formatters';
import { safeFetchJson, cleanFriendlyErrorMessage } from './apiClient';

export const STORE_WEBAPP_URL = 'https://ravon-alpha.vercel.app/';

export async function sendTelegramNotification(
  token: string,
  chatId: string,
  text: string,
  parseMode = 'HTML'
): Promise<{ success: boolean; error?: string }> {
  if (!token || !chatId) {
    return { success: false, error: 'Telegram Bot Token yoki Chat ID kiritilmagan.' };
  }

  const defaultReplyMarkup = {
    inline_keyboard: [
      [{ text: "🛍 Do'konni ochish (Mini App)", web_app: { url: STORE_WEBAPP_URL } }]
    ]
  };

  try {
    // 1. Try internal backend proxy first
    const res = await safeFetchJson<{ success: boolean; error?: string }>('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token.trim(),
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
      `https://api.telegram.org/bot${token.trim()}/sendMessage`,
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

export function formatOrderTelegramMessage(
  orderId: string,
  orderData: OrderForm,
  items: CartItem[],
  totalAmount: number
): string {
  const cleanId = orderId.replace(/\D/g, '') || orderId;
  const deliveryLabel = 
    orderData.deliveryMethod === 'courier' ? '🚗 Kuryer orqali (eshikkacha)' :
    orderData.deliveryMethod === 'post' ? '📦 BTS / Fargo pochta punkti' :
    '🏢 Namangan viloyati, Uychi tumanidan olib ketish';

  const paymentLabel = 
    orderData.paymentMethod === 'click' ? '💳 Click Up (Online)' :
    orderData.paymentMethod === 'payme' ? '💳 Payme (Online)' :
    '💵 Naqd pul (Qabul qilinganda)';

  const itemsList = items.map((it, idx) => {
    return `${idx + 1}. <b>${escapeHtml(it.product.name)}</b>\n   🏷 Bozor laqabi: <i>"${escapeHtml(it.product.bazaarName)}"</i>\n   🔢 Soni: <b>${it.quantity} dona</b> | Narxi: ${formatUzbekSum(it.product.price * it.quantity)}`;
  }).join('\n\n');

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
${orderData.notes ? `📝 <b>Izoh / Mashina yili:</b> ${escapeHtml(orderData.notes)}\n` : ''}━━━━━━━━━━━━━━━━━━━━
📦 <b>BUYURTMA TARKIBI (${items.length} xil detal):</b>
${itemsList}

━━━━━━━━━━━━━━━━━━━━
💰 <b>JAMI TO‘LOV SUMMASI:</b> <b>${formatUzbekSum(totalAmount)}</b>
⏰ <b>Qabul qilingan vaqt:</b> ${new Date().toLocaleString('uz-UZ')}
━━━━━━━━━━━━━━━━━━━━
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
    .map((it, i) => `${i + 1}. ${it.product.name} x ${it.quantity} dona = ${formatUzbekSum(it.product.price * it.quantity)}`)
    .join('\n');

  return `========================================
   RAVON AUTO TUNING - ELEKTRON CHEK
========================================
Chek raqami: #RAV-${cleanId}
Sana: ${new Date().toLocaleString('uz-UZ')}
Xaridor: ${orderData.fullName}
Telefon: ${orderData.phone}
Manzil: ${orderData.region}, ${orderData.cityAddress}
Yetkazish turi: ${orderData.deliveryMethod === 'courier' ? 'Kuryer' : orderData.deliveryMethod === 'post' ? 'Pochta' : 'Do\'kondan olib ketish'}
To'lov usuli: ${orderData.paymentMethod.toUpperCase()}
----------------------------------------
MAHSULOTLAR:
${itemsText}
----------------------------------------
JAMI SUMMA: ${formatUzbekSum(totalAmount)}
HOLATI: Qabul qilindi
----------------------------------------
Manzil: Namangan viloyati, Uychi tumani (Ravon Auto Tuning)
Tel: +998 97 524 04 01 | Telegram: @Doliyev_dilshod
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
💵 <b>Taxminiy bozor narxi:</b> ${escapeHtml(aiResult.estimatedPriceRange || 'Kelishilgan narx')}
💡 <b>Usta maslahati:</b> ${escapeHtml(aiResult.tuningTips || aiResult.description)}
━━━━━━━━━━━━━━━━━━━━
⏰ <b>Vaqti:</b> ${new Date().toLocaleString('uz-UZ')}
⚡ <i>Mijoz ushbu detal do‘konda bor-yo‘qligini va aniq narxini kutmoqda (5 daqiqada javob bering).</i>`;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
