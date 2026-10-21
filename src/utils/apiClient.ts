/**
 * Safe API Client & Fetch Helper
 * Prevents raw JSON / HTML / 404 technical errors from ever appearing on screen.
 * Always returns friendly, customer-understandable Uzbek messages.
 */

export interface SafeApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  isHtml?: boolean;
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeApiResponse<T>> {
  try {
    let resolvedInput = input;
    const customBase = (
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
        ? String(import.meta.env.VITE_API_URL)
        : ''
    )
      .trim()
      .replace(/\/+$/, '');

    if (typeof input === 'string' && input.startsWith('/api/') && customBase) {
      resolvedInput = `${customBase}${input}`;
    }

    const response = await fetch(resolvedInput, init);
    const contentType = response.headers.get('content-type') || '';
    const isJsonHeader = contentType.toLowerCase().includes('application/json');

    // Always read as text first to safely inspect content before parsing JSON
    const rawText = await response.text();
    const trimmed = rawText.trim();

    let parsedData: any = null;
    let isParsableJson = false;

    if (
      isJsonHeader ||
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        parsedData = JSON.parse(rawText);
        isParsableJson = true;
      } catch {
        parsedData = null;
        isParsableJson = false;
      }
    }

    // Check for HTTP errors (4xx, 5xx) - hide raw 404/status numbers from customers
    if (!response.ok) {
      const rawServerMsg = parsedData?.error || parsedData?.message || parsedData?.details;
      let friendlyMsg = cleanFriendlyErrorMessage(rawServerMsg);

      if (!rawServerMsg || typeof rawServerMsg !== 'string') {
        if (response.status === 503 || response.status === 502 || response.status === 504 || response.status === 429) {
          friendlyMsg = "Xizmatda vaqtinchalik navbat yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.";
        } else {
          friendlyMsg = "Xizmat bilan bog'lanishda vaqtinchalik uzilish yuz berdi. Iltimos, birozdan so'ng qayta urinib ko'ring.";
        }
      }

      return {
        ok: false,
        status: response.status,
        data: parsedData,
        error: friendlyMsg,
        isHtml: !isParsableJson && (trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE') || trimmed.includes('<html')),
      };
    }

    // Response status is 200-299, but content wasn't valid JSON
    if (!isParsableJson) {
      const isHtml = trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE') || trimmed.includes('<html');
      return {
        ok: false,
        status: response.status,
        data: null,
        error: "Xizmat bilan bog'lanishda vaqtinchalik uzilish yuz berdi. Iltimos, birozdan so'ng qayta urinib ko'ring.",
        isHtml,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: parsedData as T,
      isHtml: false,
    };
  } catch (networkErr: any) {
    console.warn('safeFetchJson network exception:', networkErr);
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Internet aloqasini tekshiring va birozdan so'ng qayta urinib ko'ring.",
      isHtml: false,
    };
  }
}

/**
 * Completely hides 404, HTTP status codes, raw HTML, stack traces, and raw JSON strings,
 * returning a clean, customer-friendly message in Uzbek.
 */
export function cleanFriendlyErrorMessage(msg: any): string {
  const defaultFriendly = "Xizmat bilan bog'lanishda vaqtinchalik uzilish yuz berdi. Iltimos, birozdan so'ng qayta urinib ko'ring.";

  if (!msg || typeof msg !== 'string') {
    return defaultFriendly;
  }

  const clean = msg.trim();
  const lower = clean.toLowerCase();

  // Hide any raw JSON objects/arrays or JSON syntax errors
  if (
    clean.startsWith('{') ||
    clean.startsWith('[') ||
    clean.includes('{"') ||
    clean.includes('<!DOCTYPE') ||
    clean.includes('<html') ||
    lower.includes('unexpected token') ||
    lower.includes('is not valid json') ||
    lower.includes('the page could not be found') ||
    lower.includes('cannot post') ||
    lower.includes('cannot get') ||
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('status:') ||
    lower.includes('so\'ralgan api') ||
    lower.includes('so\'ralgan xizmat') ||
    lower.includes('html sahifa') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror')
  ) {
    return defaultFriendly;
  }

  return clean;
}
