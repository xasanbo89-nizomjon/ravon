import * as XLSX from 'xlsx';
import { Product } from '../types';

/**
 * Bulk Excel (.xlsx / .xls) & CSV / TSV Import & Export Utilities for up to 7,000+ Auto Parts
 * - Reads binary .xlsx / .xls files cleanly via SheetJS (ArrayBuffer) with zero replacement characters ()
 * - Auto-detects UTF-8 vs Windows-1251 (Cyrillic) encoding for .csv / .txt files
 * - Interactive Column Mapping & Live Preview before committing to the database
 * - 100% exact Stock (parseInt, preserving 0 as Out of Stock) and Price parsing
 */

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=600&q=70';

export interface ExcelSheetRawData {
  sheetName: string;
  rows: string[][];
}

export interface ExcelColumnMapping {
  name: number;
  price: number;
  stock: number;
  sku: number;
  bazaarName: number;
  category: number;
  brand: number;
  carModels: number;
  originalPrice: number;
  badge: number;
  image: number;
  description: number;
}

function stripReplacementChars(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/\uFFFD+/g, '')
    .replace(/\u0000+/g, '')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function escapeCsvCell(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (
    str.includes(';') ||
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports the entire product catalog to a CSV file compatible with Microsoft Excel & Google Sheets.
 */
export function exportProductsToCsv(
  products: Product[],
  filenamePrefix = 'ravon-auto-katalog'
): void {
  const headers = [
    'Artikul (OEM)',
    'Rasmiy Nomi',
    'Bozordagi Laqabi',
    'Kategoriya',
    'Brend',
    'Avtomobil Modellari',
    'Narxi (som)',
    'Eski Narxi',
    'Ombordagi Soni (dona)',
    'Nishon (Badge)',
    'Rasm URL',
    'Tavsif',
  ];

  const rows = products.map((p) => {
    const stockCount =
      typeof p.stock === 'number' && !Number.isNaN(p.stock)
        ? Math.max(0, Math.floor(p.stock))
        : p.inStock === false
        ? 0
        : 10;
    const imageCell =
      p.image && p.image.startsWith('data:image/')
        ? '[Yuklangan rasm (Base64)]'
        : p.image || '';

    return [
      escapeCsvCell(p.sku || ''),
      escapeCsvCell(p.name || ''),
      escapeCsvCell(p.bazaarName || p.name || ''),
      escapeCsvCell(p.category || 'Optika'),
      escapeCsvCell(p.brand || 'GM Genuine (Original)'),
      escapeCsvCell((p.carModels || ['Gentra']).join(', ')),
      escapeCsvCell(p.price || 0),
      escapeCsvCell(p.originalPrice || ''),
      escapeCsvCell(stockCount),
      escapeCsvCell(p.badge || ''),
      escapeCsvCell(imageCell),
      escapeCsvCell((p.description || '').replace(/\r?\n/g, ' ')),
    ].join(';');
  });

  // Add UTF-8 BOM (\uFEFF) so Excel on Windows/Mac opens Cyrillic & Uzbek characters with 100% accuracy
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}-${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a sample Excel (.xlsx) template so the Admin can see the exact columns and bulk-fill 7,000 items.
 */
export function downloadSampleCsvTemplate(): void {
  const rows = [
    [
      'Artikul (OEM)',
      'Mahsulot nomi',
      'Bozordagi laqabi',
      'Kategoriya',
      'Brend',
      'Avtomobil modeli',
      'Narxi',
      'Eski narxi',
      'Ombordagi soni (Dona)',
      'Nishon (Badge)',
      'Rasm URL',
      'Tavsif',
    ],
    [
      '96550234',
      'Gentra / Lacetti Optra Stop Orqa Fara (Komplekt)',
      'Optra stop',
      'Optika',
      'Vland / Optra',
      'Gentra, Lacetti',
      850000,
      980000,
      25,
      'XIT TYUNING',
      'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=600&q=70',
      'Gentra va Lacetti uchun original ko‘rinishdagi LED Optra orqa stop fara.',
    ],
    [
      'GM-95951791',
      'Cobalt Old Amortizator Stoyka (Original juft)',
      'Cobalt stoyka',
      'Xodovoy',
      'GM Genuine (Original)',
      'Cobalt',
      620000,
      700000,
      40,
      'TOP XARID',
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=600&q=70',
      'Yumshoq yurishni ta’minlovchi original GM old amortizatorlari.',
    ],
    [
      'SP1159-HIQ',
      'Hi-Q Keramik Old Tormoz Kolodkalari (Koreya)',
      'Hi-Q kolodka',
      'Xodovoy',
      'Hi-Q (Koreya)',
      'Gentra, Cobalt, Nexia 3',
      165000,
      200000,
      0,
      'YANGILIK',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=70',
      'Chiyillamaydigan va oporniy diskni yemirmaydigan original Koreya kolodkasi.',
    ],
  ];

  try {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tovarlar');
    XLSX.writeFile(wb, `ravon-namuna-shablon-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch {
    // Fallback to CSV if needed
    exportProductsToCsv([], 'ravon-namuna-shablon');
  }
}

/**
 * Parses a single CSV/TSV line respecting double quotes.
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(stripReplacementChars(current));
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(stripReplacementChars(current));
  return result;
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  if (tabs >= semicolons && tabs >= commas && tabs > 0) return '\t';
  if (semicolons >= commas && semicolons > 0) return ';';
  return ',';
}

/**
 * 100% Exact Stock Quantity Parser (Requirement 2):
 * - Extracts exact integer (`parseInt`) regardless of text like `25`, `"25 dona"`, `"1 500 шт"`, `"1,200"`, `0`
 * - If value in Excel is `0`, negative (`-5`), empty, or `"yo'q"` / `"нет"`, returns strictly `0` (NEVER defaults to 10!)
 */
export function parseExactStockQuantity(rawCell: unknown): number {
  if (typeof rawCell === 'number') {
    if (!Number.isFinite(rawCell) || rawCell <= 0) return 0;
    return Math.floor(rawCell);
  }

  const str = stripReplacementChars(rawCell);
  if (!str) return 0;

  if (/^(-|—|yo'q|yoq|tugagan|нет|отсутствует|null|none|false|n\/a)$/i.test(str)) {
    return 0;
  }

  // Extract the first numeric expression (with optional sign, spaces, commas, or dots)
  const tokenMatch = str.match(/[+-]?\d[\d\s.,]*/);
  if (!tokenMatch) return 0;

  let token = tokenMatch[0].trim();

  // Check if explicitly negative
  if (token.startsWith('-')) {
    return 0;
  }

  // If formatted with thousand separators like "1,500" or "12,000" (comma followed by 3 digits at end)
  if (/^\+?\d{1,3}(,\d{3})+$/.test(token)) {
    const parsedThousand = parseInt(token.replace(/,/g, ''), 10);
    return Number.isFinite(parsedThousand) && parsedThousand > 0 ? parsedThousand : 0;
  }

  // Remove thousand-Grouping spaces (e.g. "1 500 шт" -> "1500")
  token = token.replace(/\s+/g, '');

  // Replace comma decimal separator with dot so parseInt stops at the decimal point ("25,00" -> "25.00" -> 25)
  token = token.replace(/,/g, '.');

  const parsed = parseInt(token, 10);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

/**
 * 100% Exact Price Parser:
 * - Handles numbers (`850000`), formatted strings (`"850 000 so'm"`, `"850,000"`), and decimal cents (`"850000.00"`, `"850 000,00"`)
 *   without ever multiplying by 100 when `.00` is present.
 */
export function parseExactPrice(rawCell: unknown, fallback = 0): number {
  if (typeof rawCell === 'number') {
    if (!Number.isFinite(rawCell) || rawCell < 0) return fallback;
    return Math.round(rawCell);
  }

  const str = stripReplacementChars(rawCell);
  if (!str) return fallback;

  const tokenMatch = str.match(/[+-]?\d[\d\s.,]*/);
  if (!tokenMatch) return fallback;

  let token = tokenMatch[0].trim();
  if (token.startsWith('-')) return 0;

  // Strip trailing 1 or 2 digit decimal cents (e.g. ".00", ",00", ".50")
  token = token.replace(/[.,]\d{1,2}$/, '');

  // Now strip all remaining non-digits (spaces, thousand commas/dots)
  const digitsOnly = token.replace(/[^\d]/g, '');
  if (!digitsOnly) return fallback;

  const parsed = parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Reads an uploaded `.xlsx`, `.xls`, `.csv`, `.tsv`, or `.txt` file using ArrayBuffer and SheetJS (`xlsx`).
 * Guarantees clean UTF-8 / Windows-1251 decoding and zero `` replacement characters.
 */
export async function readSpreadsheetFile(file: File): Promise<{
  fileName: string;
  sheets: ExcelSheetRawData[];
}> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const lowerName = file.name.toLowerCase();

  // Detect ZIP (.xlsx) magic bytes PK\x03\x04 or OLE2 (.xls) magic bytes \xD0\xCF\x11\xE0
  const isZipXlsx =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;
  const isOleXls =
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0;
  const isExcelExtension = /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(lowerName);

  if (isZipXlsx || isOleXls || isExcelExtension) {
    const workbook = XLSX.read(bytes, {
      type: 'array',
      codepage: 65001,
      raw: true,
      cellDates: false,
    });

    const sheets: ExcelSheetRawData[] = [];
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;
      // Extract raw matrix directly without cloning every cell of 4,443+ rows upfront
      const rawMatrix = XLSX.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        defval: '',
        raw: true,
      });

      const nonEmptyRows: string[][] = [];
      for (let r = 0; r < rawMatrix.length; r++) {
        const row = rawMatrix[r];
        if (!Array.isArray(row) || row.length === 0) continue;
        // Fast check if row has at least one non-empty cell
        let hasValue = false;
        for (let c = 0; c < row.length; c++) {
          const val = row[c];
          if (val !== '' && val !== null && val !== undefined) {
            hasValue = true;
            break;
          }
        }
        if (hasValue) {
          nonEmptyRows.push(row as string[]);
        }
      }

      if (nonEmptyRows.length > 0) {
        sheets.push({
          sheetName,
          rows: nonEmptyRows,
        });
      }
    }

    return {
      fileName: file.name,
      sheets,
    };
  }

  // Otherwise, decode as CSV / TSV text with automatic UTF-8 vs Windows-1251 (Cyrillic) detection
  let decodedText = '';
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    decodedText = utf8Decoder.decode(bytes);
  } catch {
    try {
      const win1251Decoder = new TextDecoder('windows-1251');
      decodedText = win1251Decoder.decode(bytes);
    } catch {
      const fallbackDecoder = new TextDecoder('utf-8');
      decodedText = fallbackDecoder.decode(bytes);
    }
  }

  const cleanText = decodedText.replace(/^\uFEFF/, '').replace(/\uFFFD+/g, '').trim();
  if (!cleanText) {
    return { fileName: file.name, sheets: [] };
  }

  const lines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { fileName: file.name, sheets: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const parsedRows: string[][] = [];

  for (const line of lines) {
    const cols = splitCsvLine(line, delimiter);
    if (cols.some((c) => c.length > 0)) {
      parsedRows.push(cols);
    }
  }

  return {
    fileName: file.name,
    sheets:
      parsedRows.length > 0
        ? [{ sheetName: 'Asosiy jadval', rows: parsedRows }]
        : [],
  };
}

/**
 * Automatically detects whether row 0 is a header row and suggests the initial column mapping.
 * Only inspects the first 12 rows so it runs in <1ms even on 10,000-row Billz catalogs.
 */
export function detectInitialColumnMapping(rows: string[][]): {
  hasHeader: boolean;
  headers: string[];
  mapping: ExcelColumnMapping;
  stockColumnDetected: boolean;
} {
  const emptyMapping: ExcelColumnMapping = {
    name: -1,
    price: -1,
    stock: -1,
    sku: -1,
    bazaarName: -1,
    category: -1,
    brand: -1,
    carModels: -1,
    originalPrice: -1,
    badge: -1,
    image: -1,
    description: -1,
  };

  if (!rows || rows.length === 0) {
    return {
      hasHeader: true,
      headers: [],
      mapping: emptyMapping,
      stockColumnDetected: false,
    };
  }

  // Compute max column count across the first 12 rows
  const inspectCount = Math.min(rows.length, 12);
  let maxCols = 0;
  for (let i = 0; i < inspectCount; i++) {
    if (rows[i] && rows[i].length > maxCols) {
      maxCols = rows[i].length;
    }
  }

  const firstRow: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    firstRow.push(stripReplacementChars(rows[0][c]));
  }
  const firstRowLower = firstRow.map((c) => c.toLowerCase());

  const headerPattern =
    /nomi|name|mahsulot|tovar|zapchast|narx|price|kategoriya|category|artikul|sku|kod|soni|dona|qoldiq|ostatok|stock|qty|model|brend|brand|наименование|название|товар|цена|стоимость|артикул|количество|остаток|кол-во|баркод|штрихкод/i;

  const hasHeaderKeyword = firstRowLower.some((col) => headerPattern.test(col));

  // Also check if row 0 has text where row 1 has numbers
  let row0LooksLikeHeader = hasHeaderKeyword;
  if (!row0LooksLikeHeader && rows.length > 1) {
    const row1 = rows[1].map((c) => stripReplacementChars(c));
    const row0HasPureNumber = firstRow.some((c) => /^\d+(\s*\d+)*$/.test(c));
    const row1HasPureNumber = row1.some((c) => /^\d+(\s*\d+)*$/.test(c));
    if (!row0HasPureNumber && row1HasPureNumber) {
      row0LooksLikeHeader = true;
    }
  }

  const headers = firstRow.map((col, idx) => {
    const letter = XLSX.utils.encode_col(idx);
    if (row0LooksLikeHeader && col) {
      return `${letter}: ${col}`;
    }
    return `Ustun ${letter}${col ? ` (${col.slice(0, 24)})` : ''}`;
  });

  const mapping: ExcelColumnMapping = { ...emptyMapping };

  if (row0LooksLikeHeader) {
    firstRowLower.forEach((h, idx) => {
      if (!h) return;
      if (
        mapping.stock === -1 &&
        /soni|dona|qoldiq|ostatok|остаток|кол-во|количество|кол\.|stock|qty|quantity|miqdor|omborda|ombor|шт|наличие|склад/.test(
          h
        )
      ) {
        mapping.stock = idx;
      } else if (
        mapping.originalPrice === -1 &&
        /eski\s*narx|original\s*price|old\s*price|старая\s*цена/.test(h)
      ) {
        mapping.originalPrice = idx;
      } else if (
        mapping.price === -1 &&
        /narx|narxi|price|summa|qiymat|sotish|цена|стоимость|прайс|сумма|розничная/.test(h)
      ) {
        mapping.price = idx;
      } else if (
        mapping.sku === -1 &&
        /artikul|oem|sku|katalog|kod|артикул|код|каталож|номер|штрихкод|баркод/.test(h) &&
        !/تلفن|telefon/.test(h)
      ) {
        mapping.sku = idx;
      } else if (mapping.bazaarName === -1 && /laqab|bozor|bazaar|slang/.test(h)) {
        mapping.bazaarName = idx;
      } else if (
        mapping.name === -1 &&
        /nomi|name|mahsulot|tovar|zapchast|detal|наименование|название|товар|запчаст|деталь|номенклатура/.test(
          h
        )
      ) {
        mapping.name = idx;
      } else if (
        mapping.category === -1 &&
        /kategoriya|category|tur|bo'lim|bolim|категория|группа|раздел/.test(h)
      ) {
        mapping.category = idx;
      } else if (
        mapping.brand === -1 &&
        /brend|brand|ishlab|firma|производитель|бренд|фирма|марка/.test(h)
      ) {
        mapping.brand = idx;
      } else if (
        mapping.carModels === -1 &&
        /model|mashina|avto|car|модель|авто|машина|применяемость/.test(h)
      ) {
        mapping.carModels = idx;
      } else if (mapping.badge === -1 && /nishon|badge|aksiya|бейджик|акция/.test(h)) {
        mapping.badge = idx;
      } else if (mapping.image === -1 && /rasm|image|photo|url|surat|фото|картинка/.test(h)) {
        mapping.image = idx;
      } else if (
        mapping.description === -1 &&
        /tavsif|description|izoh|malumot|описание|комментарий/.test(h)
      ) {
        mapping.description = idx;
      }
    });
  }

  // Smart content-based heuristic for unmapped Name & Price columns if header names were non-standard
  const sampleRows = rows.slice(row0LooksLikeHeader ? 1 : 0, 12);
  if (sampleRows.length > 0) {
    const colCount = firstRow.length;

    if (mapping.name === -1) {
      for (let c = 0; c < colCount; c++) {
        if (Object.values(mapping).includes(c)) continue;
        const nonNumericCount = sampleRows.filter((r) => {
          const val = stripReplacementChars(r[c]);
          return val.length >= 3 && !/^\d+([.,\s]\d+)*$/.test(val);
        }).length;
        if (nonNumericCount >= Math.ceil(sampleRows.length * 0.5)) {
          mapping.name = c;
          break;
        }
      }
      if (mapping.name === -1) {
        mapping.name = mapping.sku === 0 && colCount > 1 ? 1 : 0;
      }
    }

    if (mapping.price === -1) {
      for (let c = 0; c < colCount; c++) {
        if (Object.values(mapping).includes(c)) continue;
        const priceLikeCount = sampleRows.filter((r) => {
          const num = parseExactPrice(r[c], -1);
          return num >= 1000;
        }).length;
        if (priceLikeCount >= Math.ceil(sampleRows.length * 0.4)) {
          mapping.price = c;
          break;
        }
      }
      if (mapping.price === -1) {
        for (let c = 0; c < colCount; c++) {
          if (Object.values(mapping).includes(c)) continue;
          const numCount = sampleRows.filter((r) => /\d/.test(stripReplacementChars(r[c]))).length;
          if (numCount >= Math.ceil(sampleRows.length * 0.5)) {
            mapping.price = c;
            break;
          }
        }
      }
    }
  }

  const stockColumnDetected = mapping.stock >= 0;

  return {
    hasHeader: row0LooksLikeHeader,
    headers,
    mapping,
    stockColumnDetected,
  };
}

function parseSingleMappedRow(
  cols: any[],
  rowIndex: number,
  startRow: number,
  now: number,
  mapping: ExcelColumnMapping,
  fallbackStock: number
): Product | null {
  if (!cols || cols.length === 0) return null;

  const rawName = stripReplacementChars(mapping.name >= 0 ? cols[mapping.name] : cols[0]);
  if (!rawName) return null;

  // Skip repeated header rows inside the sheet
  if (
    rowIndex > startRow &&
    /^(mahsulot\s*nomi|rasmiy\s*nomi|наименование|название\s*товара|товар)$/i.test(rawName)
  ) {
    return null;
  }

  const rawSku = mapping.sku >= 0 ? stripReplacementChars(cols[mapping.sku]) : '';
  const rawBazaar =
    mapping.bazaarName >= 0 && stripReplacementChars(cols[mapping.bazaarName])
      ? stripReplacementChars(cols[mapping.bazaarName])
      : rawName;
  const rawCategory =
    mapping.category >= 0 && stripReplacementChars(cols[mapping.category])
      ? stripReplacementChars(cols[mapping.category])
      : 'Ehtiyot qismlar';
  const rawBrand =
    mapping.brand >= 0 && stripReplacementChars(cols[mapping.brand])
      ? stripReplacementChars(cols[mapping.brand])
      : 'GM Genuine (Original)';
  const rawCarsStr =
    mapping.carModels >= 0 && stripReplacementChars(cols[mapping.carModels])
      ? stripReplacementChars(cols[mapping.carModels])
      : 'Gentra, Cobalt';
  const carModels = rawCarsStr
    .split(/[,/|]+/)
    .map((m) => m.trim())
    .filter(Boolean);
  if (carModels.length === 0) carModels.push('Gentra');

  const price = mapping.price >= 0 ? parseExactPrice(cols[mapping.price], 0) : 0;
  const originalPrice =
    mapping.originalPrice >= 0 ? parseExactPrice(cols[mapping.originalPrice], 0) : 0;

  // CRITICAL STOCK RULE:
  // If Stock column is mapped (mapping.stock >= 0), parse exact integer where 0 or negative stays 0!
  // Only if Stock column does NOT exist in Excel (mapping.stock === -1), use fallbackStock.
  const stock =
    mapping.stock >= 0 ? parseExactStockQuantity(cols[mapping.stock]) : fallbackStock;
  const inStock = stock > 0;

  const badge =
    mapping.badge >= 0 && stripReplacementChars(cols[mapping.badge])
      ? stripReplacementChars(cols[mapping.badge])
      : '';
  const rawImg = mapping.image >= 0 ? stripReplacementChars(cols[mapping.image]) : '';
  const image =
    rawImg &&
    rawImg !== DEFAULT_FALLBACK_IMAGE &&
    (rawImg.startsWith('http://') ||
      rawImg.startsWith('https://') ||
      rawImg.startsWith('data:image/'))
      ? rawImg
      : '';
  const description =
    mapping.description >= 0 && stripReplacementChars(cols[mapping.description])
      ? stripReplacementChars(cols[mapping.description])
      : `${rawName} (${carModels.join(', ')}) uchun sifatli ehtiyot qism va tyuning detali.`;

  const specs: { label: string; value: string }[] = [
    ...(rawSku ? [{ label: 'Artikul / OEM kodi', value: rawSku }] : []),
    { label: 'Brend / Ishlab chiqaruvchi', value: rawBrand },
    { label: 'Ombordagi soni', value: `${stock} dona` },
    { label: 'Mos modellar', value: carModels.join(', ') },
    { label: 'Kategoriya', value: rawCategory },
  ];

  const cleanId = `prod_${now}_${rowIndex}`.replace(/[.#$[\]/\s]+/g, '_');
  const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
  const safeOriginalPrice =
    Number.isFinite(originalPrice) && originalPrice > safePrice ? originalPrice : 0;
  const safeStock = Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : 0;

  const rawItem: Product = {
    id: cleanId,
    name: rawName,
    bazaarName: rawBazaar,
    ...(rawSku ? { sku: rawSku } : {}),
    brand: rawBrand,
    category: rawCategory,
    carModels,
    price: safePrice,
    ...(safeOriginalPrice > safePrice ? { originalPrice: safeOriginalPrice } : {}),
    image: image || '',
    inStock: safeStock > 0 && inStock,
    stock: safeStock,
    rating: 5.0,
    reviewCount: 1,
    ...(badge ? { badge } : {}),
    description,
    specs,
    tags: [
      rawCategory.toLowerCase(),
      rawBrand.toLowerCase(),
      ...(rawSku ? [rawSku.toLowerCase()] : []),
      ...carModels.map((c) => c.toLowerCase()),
    ],
  };

  return JSON.parse(JSON.stringify(rawItem)) as Product;
}

/**
 * FAST PREVIEW ONLY (Requirement 3):
 * Computes ONLY the first 5 products for the Preview table so opening a 4,443+ row Billz Excel file
 * or changing column dropdowns never processes all 4,443 rows on the UI thread!
 */
export function buildPreviewProductsFromMappedRows(
  rows: string[][],
  mapping: ExcelColumnMapping,
  options: {
    hasHeader: boolean;
    defaultStockWhenColumnMissing: number;
  },
  previewLimit = 5
): {
  previewProducts: Product[];
  totalRowsCount: number;
} {
  const startRow = options.hasHeader ? 1 : 0;
  const now = Date.now();
  const previewProducts: Product[] = [];
  const fallbackStock = Math.max(0, Math.floor(Number(options.defaultStockWhenColumnMissing) || 0));

  for (let i = startRow; i < rows.length && previewProducts.length < previewLimit; i++) {
    const prod = parseSingleMappedRow(rows[i], i, startRow, now, mapping, fallbackStock);
    if (prod) {
      previewProducts.push(prod);
    }
  }

  const totalRowsCount = Math.max(0, rows.length - startRow);

  return {
    previewProducts,
    totalRowsCount,
  };
}

/**
 * NON-BLOCKING CHUNKED PROCESSOR (Requirement 3):
 * Processes all 4,443+ rows in 500-row batches with `await new Promise(r => setTimeout(r, 20))`
 * ONLY after the admin clicks "TASDIQLASH VA BAZAGA YUKLASH".
 */
export async function buildProductsFromMappedRowsChunked(
  rows: string[][],
  mapping: ExcelColumnMapping,
  options: {
    hasHeader: boolean;
    defaultStockWhenColumnMissing: number;
  },
  onProgress?: (processed: number, total: number) => void
): Promise<{
  products: Product[];
  discoveredCategories: string[];
  discoveredCarModels: string[];
  discoveredBrands: string[];
  inStockCount: number;
  outOfStockCount: number;
}> {
  const startRow = options.hasHeader ? 1 : 0;
  const now = Date.now();
  const parsedProducts: Product[] = [];
  const catSet = new Set<string>();
  const carSet = new Set<string>();
  const brandSet = new Set<string>();
  let inStockCount = 0;
  let outOfStockCount = 0;

  const fallbackStock = Math.max(0, Math.floor(Number(options.defaultStockWhenColumnMissing) || 0));
  const totalToProcess = Math.max(0, rows.length - startRow);
  const CHUNK_SIZE = 500;

  for (let i = startRow; i < rows.length; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, rows.length);
    for (let r = i; r < end; r++) {
      const prod = parseSingleMappedRow(rows[r], r, startRow, now, mapping, fallbackStock);
      if (!prod) continue;

      if (prod.inStock && (prod.stock ?? 0) > 0) {
        inStockCount++;
      } else {
        outOfStockCount++;
      }

      catSet.add(prod.category);
      if (prod.brand) brandSet.add(prod.brand);
      prod.carModels.forEach((c) => carSet.add(c));
      parsedProducts.push(prod);
    }

    if (onProgress) {
      onProgress(Math.min(end - startRow, totalToProcess), totalToProcess);
    }
    if (end < rows.length) {
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  return {
    products: parsedProducts,
    discoveredCategories: Array.from(catSet),
    discoveredCarModels: Array.from(carSet),
    discoveredBrands: Array.from(brandSet),
    inStockCount,
    outOfStockCount,
  };
}

/**
 * Synchronous helper for small CSVs/tests.
 */
export function buildProductsFromMappedRows(
  rows: string[][],
  mapping: ExcelColumnMapping,
  options: {
    hasHeader: boolean;
    defaultStockWhenColumnMissing: number;
  }
): {
  products: Product[];
  discoveredCategories: string[];
  discoveredCarModels: string[];
  discoveredBrands: string[];
  inStockCount: number;
  outOfStockCount: number;
} {
  const startRow = options.hasHeader ? 1 : 0;
  const now = Date.now();
  const parsedProducts: Product[] = [];
  const catSet = new Set<string>();
  const carSet = new Set<string>();
  const brandSet = new Set<string>();
  let inStockCount = 0;
  let outOfStockCount = 0;

  const fallbackStock = Math.max(0, Math.floor(Number(options.defaultStockWhenColumnMissing) || 0));

  for (let i = startRow; i < rows.length; i++) {
    const prod = parseSingleMappedRow(rows[i], i, startRow, now, mapping, fallbackStock);
    if (!prod) continue;

    if (prod.inStock && (prod.stock ?? 0) > 0) {
      inStockCount++;
    } else {
      outOfStockCount++;
    }

    catSet.add(prod.category);
    if (prod.brand) brandSet.add(prod.brand);
    prod.carModels.forEach((c) => carSet.add(c));
    parsedProducts.push(prod);
  }

  return {
    products: parsedProducts,
    discoveredCategories: Array.from(catSet),
    discoveredCarModels: Array.from(carSet),
    discoveredBrands: Array.from(brandSet),
    inStockCount,
    outOfStockCount,
  };
}

/**
 * Legacy helper for direct CSV text parsing (uses the new exact parser under the hood).
 */
export function parseProductsFromCsvText(rawText: string): {
  products: Product[];
  discoveredCategories: string[];
  discoveredCarModels: string[];
  discoveredBrands: string[];
} {
  const cleanedText = rawText.replace(/^\uFEFF/, '').replace(/\uFFFD+/g, '').trim();
  if (!cleanedText) {
    return {
      products: [],
      discoveredCategories: [],
      discoveredCarModels: [],
      discoveredBrands: [],
    };
  }

  const lines = cleanedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return {
      products: [],
      discoveredCategories: [],
      discoveredCarModels: [],
      discoveredBrands: [],
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const rows = lines.map((l) => splitCsvLine(l, delimiter));
  const detected = detectInitialColumnMapping(rows);
  const res = buildProductsFromMappedRows(rows, detected.mapping, {
    hasHeader: detected.hasHeader,
    defaultStockWhenColumnMissing: 10,
  });

  return {
    products: res.products,
    discoveredCategories: res.discoveredCategories,
    discoveredCarModels: res.discoveredCarModels,
    discoveredBrands: res.discoveredBrands,
  };
}
