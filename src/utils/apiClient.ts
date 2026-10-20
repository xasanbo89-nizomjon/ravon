/**
 * Safe API Client & Fetch Helper
 * Prevents "Unexpected token 'T', 'The page could not be found'... is not valid JSON" errors
 * by checking response.ok, response content-type, safely reading text before parsing JSON,
 * and returning human-friendly Uzbek error messages.
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
    const response = await fetch(input, init);
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

    // Check for HTTP errors (4xx, 5xx)
    if (!response.ok) {
      let errorMsg = parsedData?.error || parsedData?.message || parsedData?.details;

      if (!errorMsg || typeof errorMsg !== 'string') {
        if (response.status === 404) {
          errorMsg = "Server bilan bog'lanishda xatolik: So'ralgan API xizmati topilmadi (404).";
        } else if (response.status === 503 || response.status === 502 || response.status === 504) {
          errorMsg = "Serverda vaqtinchalik yuklama yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.";
        } else {
          errorMsg = `Server bilan bog'lanishda xatolik yuz berdi (Status: ${response.status}).`;
        }
      }

      return {
        ok: false,
        status: response.status,
        data: parsedData,
        error: cleanFriendlyErrorMessage(errorMsg),
        isHtml: !isParsableJson && (trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE') || trimmed.includes('<html')),
      };
    }

    // Response status is 200-299, but content wasn't valid JSON
    if (!isParsableJson) {
      // Check if it's an HTML page (e.g. 200 rewrite fallback)
      const isHtml = trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE') || trimmed.includes('<html');
      return {
        ok: false,
        status: response.status,
        data: null,
        error: isHtml
          ? "Server bilan bog'lanishda xatolik: API o'rniga HTML sahifa qaytdi."
          : "Serverdan kutilmagan formatda javob qaytdi.",
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
    console.warn("safeFetchJson network exception:", networkErr);
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Internet aloqasi yoki server bilan bog'lanishda xatolik yuz berdi.",
      isHtml: false,
    };
  }
}

/**
 * Strips raw HTML, stack traces, and raw JSON parsing errors
 * returning a friendly message to the end user.
 */
export function cleanFriendlyErrorMessage(msg: any): string {
  if (!msg || typeof msg !== 'string') {
    return "Server bilan bog'lanishda xatolik yuz berdi.";
  }
  const clean = msg.trim();

  if (
    clean.includes('<!DOCTYPE') ||
    clean.includes('<html') ||
    clean.includes('Unexpected token') ||
    clean.includes('is not valid JSON') ||
    clean.includes('The page could not be found') ||
    clean.includes('Cannot POST') ||
    clean.includes('Cannot GET')
  ) {
    return "Server bilan bog'lanishda xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.";
  }

  return clean;
}
