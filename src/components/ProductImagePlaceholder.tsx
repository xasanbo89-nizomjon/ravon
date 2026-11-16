import React from 'react';
import { Camera, Car, Sparkles } from 'lucide-react';

/**
 * Legacy default fallback URL that was previously assigned to CSV-imported items without a photo.
 */
export const LEGACY_CSV_PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=600&q=70';

/**
 * All generic stock / sports-car Unsplash URLs that must NEVER be displayed or treated as real product photos.
 */
const BANNED_STOCK_CAR_IMAGES = new Set<string>([
  LEGACY_CSV_PLACEHOLDER_IMAGE,
  'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1635784063388-1ff609e12d72?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80',
]);

/**
 * Determines whether a product has an admin-uploaded/assigned real image ("Asl rasm")
 * vs. being empty or using the automatic minimalist SVG placeholder ("Avto-rasm").
 */
export function hasRealProductImage(image?: string | null): boolean {
  if (!image || typeof image !== 'string') return false;
  const trimmed = image.trim();
  if (!trimmed) return false;
  if (trimmed === 'placeholder' || trimmed === '[Yuklangan rasm (Base64)]') return false;
  if (BANNED_STOCK_CAR_IMAGES.has(trimmed)) return false;
  if (trimmed.includes('images.unsplash.com/photo-')) return false;
  if (trimmed.startsWith('data:image/svg+xml')) return false;
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  );
}

type PartVisualType =
  | 'headlight'
  | 'suspension'
  | 'brakes'
  | 'engine'
  | 'filterOil'
  | 'electrical'
  | 'audio'
  | 'interior'
  | 'body'
  | 'emblemAccessory';

interface PartVisualConfig {
  type: PartVisualType;
  badgeLabel: string;
}

/**
 * Detects the accurate part category & technical icon type from the product's name and category.
 * Never assigns random sports car photos — maps every part to its dedicated technical vector icon.
 */
function detectPartVisualConfig(product?: {
  name?: string;
  bazaarName?: string;
  category?: string;
}): PartVisualConfig {
  const haystack = `${product?.name || ''} ${product?.bazaarName || ''} ${product?.category || ''}`.toUpperCase();

  // 1. Small accessories, fasteners, emblems, stickers, remotes -> Clean Emblem/Accessory Icon
  if (
    /EMBLEMA|ЭМБЛЕМА|NAKLEYKA|NAKALEYKA|НАКЛЕЙКА|KLIPS|КЛИПС|PISTON|ПИСТОН|BOLT|БОЛТ|GAYKA|ГАЙКА|SHAYBA|ШАЙБА|SAMOREZ|САМОРЕЗ|SHPILKA|ШПИЛЬКА|XOMUT|ХОМУТ|ZAGLUSHKA|ЗАГЛУШКА|BRELO|БРЕЛОК/.test(
      haystack
    )
  ) {
    return { type: 'emblemAccessory', badgeLabel: 'AKSESSUAR VA DETAL' };
  }

  // 2. Audio & Multimedia (Sabofer, Magnitola, Kalonka, Monitor)
  if (
    /SABOFER|SABVUFER|САБВУФЕР|KALONKA|КОЛОНКА|MAGNITOLA|МАГНИТОЛА|USILITEL|УСИЛИТЕЛЬ|ESTRADA|ЭСТРАДА|DINAMIK|ДИНАМИК|AUDIO|АУДИО/.test(
      haystack
    )
  ) {
    return { type: 'audio', badgeLabel: 'AVTO AUDIO VA MEDIA' };
  }

  // 3. Brake system (Tormoz diski, Kolodka, Support, Baraban)
  if (
    /TORMOZ|ТОРМОЗ|KOLODKA|КОЛОДКА|SUPPORT|СУППОРТ|BARABAN|БАРАБАН|DISK.*TORMOZ|ТОРМОЗ.*ДИСК/.test(
      haystack
    )
  ) {
    return { type: 'brakes', badgeLabel: 'TORMOZ TIZIMI' };
  }

  // 4. Suspension / Xodovoy (Amortizator, Prujina, Sharovoy, Richag, Podshipnik, Stupitsa, Granata)
  if (
    /AMORTIZATOR|АМОРТИЗАТОР|PRUJINA|ПРУЖИНА|RESOR|РЕССОР|SHAROVOY|ШАРОВОЙ|RICHAG|РЫЧАГ|PODSHIPNIK|ПОДШИПНИК|STABILIZATOR|СТАБИЛИЗАТОР|GRANATA|ГРАНАТА|STUPITSA|СТУПИЦА|VTULKA|ВТУЛКА|XODOVOY|ХОДОВОЙ|TYAGA|ТЯГА|NAKONECHNIK|НАКОНЕЧНИК|OPORA|ОПОРА/.test(
      haystack
    )
  ) {
    return { type: 'suspension', badgeLabel: 'XODOVOY VA PODVESKA' };
  }

  // 5. Lighting & Optics (Fara, Fonar, Tumanka, LED, Lampa, Optika)
  if (
    /FARA|ФАРА|FONAR|ФОНАР|TUMANKA|ТУМАНКА|OPTIKA|ОПТИКА|LAMPA|ЛАМПА|LED|BI-LED|KSENON|GABARIT|ГАБАРИТ|STOP|СТОП/.test(
      haystack
    )
  ) {
    return { type: 'headlight', badgeLabel: 'OPTIKA VA YORITISH' };
  }

  // 6. Oils, Filters & Fluids (Filtr, Moy, Maslo, Antifriz)
  if (
    /FILTR|ФИЛЬТР|MOY|MASLO|МАСЛО|ANTIFRIZ|АНТИФРИЗ|SUYUQLIK|ЖИДКОСТ|GERMETIK|ГЕРМЕТИК|SMASKA|СМАЗКА/.test(
      haystack
    )
  ) {
    return { type: 'filterOil', badgeLabel: 'FILTR VA MOYLAR' };
  }

  // 7. Engine & Cooling (Motor, Dvigatel, Radiator, Pechka, Porshen, Klapan, Pompa, Termostat, Glushitel)
  if (
    /RADIATR|RADIATOR|РАДИАТОР|PECHKA|ПЕЧКА|MOTOR|МОТОР|DVIGATEL|ДВИГАТЕЛ|PORSHEN|ПОРШЕН|KLAPAN|КЛАПАН|TERMOSTAT|ТЕРМОСТАТ|SHLANG|ШЛАНГ|TRUBKA|ТРУБКА|POMPA|ПОМПА|GLUSHITEL|ГЛУШИТЕЛ|KOLLEKTOR|КОЛЛЕКТОР|PROKLADKA|ПРОКЛАДКА|SALNIK|САЛЬНИК|REMEN|РЕМЕНЬ|ROLIK|РОЛИК|FORSUNKA|ФОРСУНКА|ZASLONKA|ЗАСЛОНКА/.test(
      haystack
    )
  ) {
    return { type: 'engine', badgeLabel: 'DVIGATEL VA SOVUTISH' };
  }

  // 8. Electrical & Sensors (Svecha, Akkumulyator, Generator, Starter, Datchik, Rele, Provod, Katushka, Pult)
  if (
    /SVECHA|СВЕЧА|AKKUMULYATOR|АККУМУЛЯТОР|GENERATOR|ГЕНЕРАТОР|STARTER|СТАРТЕР|DATCHIK|ДАТЧИК|RELE|РЕЛЕ|PROVOD|ПРОВОД|KATUSHK|КАТУШК|BENZONASOS|БЕНЗОНАСОС|ELEKTR|ЭЛЕКТР|PULT|ПУЛЬТ|KNOPKA|КНОПКА/.test(
      haystack
    )
  ) {
    return { type: 'electrical', badgeLabel: 'AVTO ELEKTRIKA' };
  }

  // 9. Interior & Comfort (Rul, Bar, Chexol, Polik, Salon, Monitor, Holder, Deflektor)
  if (
    /RUL|РУЛ|BAR|БАР|CHEXOL|CHEHOL|ЧЕХОЛ|POLIK|ПОЛИК|SALON|САЛОН|MONITOR|МОНИТОР|HOLDER|DEFLEKTOR|ДЕФЛЕКТОР|PEDAL|ПЕДАЛ|TABLO|ТАБЛО/.test(
      haystack
    )
  ) {
    return { type: 'interior', badgeLabel: 'SALON VA TYUNING' };
  }

  // 10. Body & Exterior (Bamper, Oblisovka, Reshotka, Kapot, Krilo, Eshik, Oyna, Zerkalo, Spoler, Diffuzor, Zamok)
  if (
    /BAMPER|БАМПЕР|OBLISOVKA|OBLITSOVKA|ОБЛИЦОВКА|RESHOTKA|РЕШЕТКА|KAPOT|КАПОТ|KRILO|КРЫЛО|ESHIK|ДВЕР|OYNA|ZERKALO|ЗЕРКАЛО|SPOLER|SPOYLER|СПОЙЛЕР|DIFFUZOR|ДИФФУЗОР|POROG|ПОРОГ|ARKA|АРКА|ZAMOK|ЗАМОК|RUCHKA|РУЧКА|MOLDING|МОЛДИНГ|BRIZGOVIK|БРЫЗГОВИК|PODKRILNIK|ПОДКРЫЛ|KUZOV|КУЗОВ/.test(
      haystack
    )
  ) {
    return { type: 'body', badgeLabel: 'KUZOV QISMLARI' };
  }

  const rawCat = (product?.category || '').trim().toUpperCase();
  return {
    type: 'emblemAccessory',
    badgeLabel: rawCat && rawCat !== 'EHTIYOT QISMLAR' ? rawCat.slice(0, 24) : 'GM EHTIYOT QISM',
  };
}

/**
 * Returns the category-specific vector icon SVG markup centered at (300, 178).
 */
function renderCategorySvgIcon(type: PartVisualType): string {
  switch (type) {
    case 'headlight':
      // Automotive Headlight Lens & Light Rays
      return `
        <g transform="translate(300, 178)">
          <circle cx="0" cy="0" r="46" fill="#1a070a" stroke="#ef4444" stroke-width="2" stroke-opacity="0.7"/>
          <path d="M-24 -18 C-10 -26, 8 -26, 14 -14 L14 14 C8 26, -10 26, -24 18 C-32 10, -32 -10, -24 -18 Z" fill="#2a0a10" stroke="#f87171" stroke-width="2.5"/>
          <circle cx="-7" cy="0" r="11" fill="#ef4444" fill-opacity="0.25" stroke="#fca5a5" stroke-width="2"/>
          <circle cx="-7" cy="0" r="4.5" fill="#ffffff"/>
          <line x1="20" y1="-12" x2="35" y2="-18" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="22" y1="0" x2="38" y2="0" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="20" y1="12" x2="35" y2="18" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
        </g>`;

    case 'suspension':
      // Coil-Over Shock Absorber & Spring
      return `
        <g transform="translate(300, 178)">
          <circle cx="0" cy="0" r="46" fill="#1a070a" stroke="#ef4444" stroke-width="2" stroke-opacity="0.7"/>
          <circle cx="0" cy="-28" r="5" fill="none" stroke="#fca5a5" stroke-width="2.5"/>
          <rect x="-5" y="-23" width="10" height="10" rx="2" fill="#ef4444"/>
          <line x1="0" y1="-13" x2="0" y2="22" stroke="#e4e4e7" stroke-width="4"/>
          <path d="M-14 -12 L14 -6 L-14 0 L14 6 L-14 12 L14 18" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="-8" y="18" width="16" height="8" rx="2" fill="#27272a" stroke="#fca5a5" stroke-width="2"/>
          <circle cx="0" cy="30" r="4.5" fill="none" stroke="#fca5a5" stroke-width="2.5"/>
        </g>`;

    case 'brakes':
      // Ventilated Brake Disc Rotor & Red Caliper
      return `
        <g transform="translate(300, 178)">
          <circle cx="0" cy="0" r="46" fill="#1a070a" stroke="#ef4444" stroke-width="2" stroke-opacity="0.7"/>
          <circle cx="-2" cy="0" r="28" fill="#18181b" stroke="#d4d4d8" stroke-width="3"/>
          <circle cx="-2" cy="0" r="12" fill="#09090b" stroke="#71717a" stroke-width="2"/>
          <circle cx="-2" cy="0" r="4" fill="#ef4444"/>
          <circle cx="-2" cy="-20" r="2" fill="#71717a"/>
          <circle cx="-20" cy="0" r="2" fill="#71717a"/>
          <circle cx="-2" cy="20" r="2" fill="#71717a"/>
          <circle cx="-15" cy="-14" r="2" fill="#71717a"/>
          <circle cx="-15" cy="14" r="2" fill="#71717a"/>
          <path d="M12 -22 C26 -14, 30 0, 24 18 L12 12 C16 2, 14 -8, 6 -14 Z" fill="#dc2626" stroke="#fecaca" stroke-width="2" stroke-linejoin="round"/>
        </g>`;

    case 'engine':
      // Engine Piston & Precision Gear
      return `
        <g transform="translate(300, 178)">
          <circle cx="0" cy="0" r="46" fill="#1a070a" stroke="#ef4444" stroke-width="2" stroke-opacity="0.7"/>
          <rect x="-16" y="-26" width="32" height="22" rx="4" fill="#27272a" stroke="#fca5a5" stroke-width="2.2"/>
          <line x1="-16" y1="-19" x2="16" y2="-19" stroke="#ef4444" stroke-width="2"/>
          <line x1="-16" y1="-14" x2="16" y2="-14" stroke="#ef4444" stroke-width="2"/>
          <circle cx="0" cy="-9" r="3.5" fill="#fbbf24"/>
          <path d="M-5 -4 L-8 16 L8 16 L5 -4 Z" fill="#3f3f46" stroke="#d4d4d8" stroke-width="1.8"/>
          <circle cx="0" cy="22" r="9" fill="#18181b" stroke="#ef4444" stroke-width="2.5"/>
          <circle cx="0" cy="22" r="3.5" fill="#fca5a5"/>
        </g>`;

    case 'filterOil':
      // Oil Canister & Golden Droplet
      return `
        <g transform="translate(300, 178)">
          <circle cx="0" cy="0" r="46" fill="#1a070a" stroke="#ef4444" stroke-width="2" stroke-opacity="0.7"/>
          <path d="M0 -26 C0 -26, 20 -4, 20 10 C20 22, 11 30, 0 30 C-11 30, -20 22, -20 10 C-20 -4, 0 -26, 0 -26 Z" fill="#2a0a10" stroke="#f59e0b" stroke-width="2.5"/>
          <path d="M-7 8 C-7 16, -2 20, 4 21" fill="none" stroke="#fde68a" stroke-width="2.2" stroke-linecap="round"/>
          <circle cx="0" cy="8" r="4" fill="#ef4444"/>
        </g>`;

    case 'electrical':
      // Automotive Battery & High-Voltage Spark
      return `
        <g transform="translate(300, 178)">
          <circle cx="0" cy="0" r="46" fill="#1a070a" stroke="#ef4444" stroke-width="2" stroke-opacity="0.7"/>
          <rect x="-24" y="-14" width="48" height="34" rx="5" fill="#18181b" stroke="#f87171" stroke-width="2.2"/>
          <rect x="-16" y="-21" width="8" height="7" rx="1.5" fill="#ef4444"/>
          <rect x="8" y="-21" width="8" height="7" rx="1.5" fill="#a1a1aa"/>
          <path d="M3 -8 L-7 4 H2 L-3 15 L9 1 H0 Z" fill="#fbbf24"/>
        </g>`;

    case 'audio':
      // Subwoofer Speaker Cone
      return `
        <g transform="translate(300, 178)">
          <circle cx="0" cy="0" r="46" fill="#1a070a" stroke="#ef4444" stroke-width="2" stroke-opacity="0.7"/>
          <circle cx="0" cy="0" r="28" fill="#18181b" stroke="#ef4444" stroke-width="2.5"/>
          <circle cx="0" cy="0" r="19" fill="#09090b" stroke="#71717a" stroke-width="1.5" stroke-dasharray="4 3"/>
          <circle cx="0" cy="0" r="9" fill="#dc2626" stroke="#fecaca" stroke-width="1.8"/>
          <circle cx="0" cy="-24" r="1.8" fill="#a1a1aa"/>
          <circle cx="0" cy="24" r="1.8" fill="#a1a1aa"/>
          <circle cx="-24" cy="0" r="1.8" fill="#a1a1aa"/>
          <circle cx="24" cy="0" r="1.8" fill="#a1a1aa"/>
        </g>`;

    case 'interior':
      // Sport Steering Wheel
      return `
        <g transform="translate(300, 178)">
          <circle cx="0" cy="0" r="46" fill="#1a070a" stroke="#ef4444" stroke-width="2" stroke-opacity="0.7"/>
          <circle cx="0" cy="0" r="26" fill="none" stroke="#e4e4e7" stroke-width="4.5"/>
          <path d="M-10 -24 A26 26 0 0 1 10 -24" fill="none" stroke="#ef4444" stroke-width="5"/>
          <circle cx="0" cy="0" r="8" fill="#dc2626" stroke="#fecaca" stroke-width="2"/>
          <line x1="-24" y1="2" x2="-8" y2="0" stroke="#a1a1aa" stroke-width="4"/>
          <line x1="24" y1="2" x2="8" y2="0" stroke="#a1a1aa" stroke-width="4"/>
          <line x1="0" y1="8" x2="0" y2="24" stroke="#a1a1aa" stroke-width="4"/>
        </g>`;

    case 'body':
      // Front Grille & Bumper Shield
      return `
        <g transform="translate(300, 178)">
          <circle cx="0" cy="0" r="46" fill="#1a070a" stroke="#ef4444" stroke-width="2" stroke-opacity="0.7"/>
          <path d="M-26 -14 L26 -14 L20 14 L-20 14 Z" fill="#18181b" stroke="#f87171" stroke-width="2.2" stroke-linejoin="round"/>
          <line x1="-18" y1="-5" x2="18" y2="-5" stroke="#ef4444" stroke-width="2"/>
          <line x1="-15" y1="4" x2="15" y2="4" stroke="#71717a" stroke-width="2"/>
          <rect x="-8" y="-8" width="16" height="6" rx="2" fill="#fbbf24"/>
        </g>`;

    case 'emblemAccessory':
    default:
      // Ravon Auto Tuning Shield & Precision Emblem
      return `
        <g transform="translate(300, 178)">
          <circle cx="0" cy="0" r="46" fill="#1a070a" stroke="#ef4444" stroke-width="2" stroke-opacity="0.7"/>
          <path d="M0 -27 L23 -17 L23 3 C23 17, 12 25, 0 30 C-12 25, -23 17, -23 3 L-23 -17 Z" fill="#26080d" stroke="#ef4444" stroke-width="2.4" stroke-linejoin="round"/>
          <path d="M-11 2 L11 2 M0 -9 L0 13" stroke="#fbbf24" stroke-width="4.5" stroke-linecap="round"/>
          <circle cx="0" cy="2" r="16" fill="none" stroke="#fca5a5" stroke-width="1.2" stroke-opacity="0.5"/>
        </g>`;
  }
}

function escapeSvgText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates a sleek, minimalist Ravon Auto Tuning SVG Data URI card:
 * - Black & crimson gradient background with racing frame
 * - Official "RAVON AUTO TUNING" header badge
 * - Center category-specific technical vector icon (Headlight, Shock Absorber, Brake Disc, Engine, Emblem, etc.)
 * - Cleanly formatted product name and category badge
 * Zero external sports car photos, 100% consistent across all 4,449 products.
 */
export function getRavonSvgFallbackDataUri(product?: {
  name?: string;
  bazaarName?: string;
  category?: string;
  sku?: string;
  brand?: string;
}): string {
  const rawName = (product?.name || product?.bazaarName || 'GM Original Avtozapchast').trim();
  const visual = detectPartVisualConfig(product);
  const catText = escapeSvgText(visual.badgeLabel);

  const maxLineLen = 32;
  let line1Raw = rawName;
  let line2Raw = '';
  if (rawName.length > maxLineLen) {
    const splitIdx = rawName.lastIndexOf(' ', maxLineLen);
    if (splitIdx > 10) {
      line1Raw = rawName.slice(0, splitIdx).trim();
      line2Raw = rawName.slice(splitIdx + 1).trim();
    } else {
      line1Raw = rawName.slice(0, maxLineLen).trim();
      line2Raw = rawName.slice(maxLineLen).trim();
    }
    if (line2Raw.length > maxLineLen) {
      line2Raw = line2Raw.slice(0, maxLineLen - 2).trim() + '...';
    }
  }

  const line1 = escapeSvgText(line1Raw);
  const line2 = escapeSvgText(line2Raw);
  const iconSvg = renderCategorySvgIcon(visual.type);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#140508"/>
      <stop offset="50%" stop-color="#0b0d13"/>
      <stop offset="100%" stop-color="#1c060a"/>
    </linearGradient>
    <linearGradient id="redBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7f1d1d" stop-opacity="0.15"/>
      <stop offset="50%" stop-color="#ef4444" stop-opacity="1"/>
      <stop offset="100%" stop-color="#7f1d1d" stop-opacity="0.15"/>
    </linearGradient>
    <radialGradient id="centerGlow" cx="50%" cy="42%" r="45%">
      <stop offset="0%" stop-color="#dc2626" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="450" fill="url(#bg)"/>
  <circle cx="300" cy="185" r="200" fill="url(#centerGlow)"/>
  <rect x="0" y="0" width="600" height="5" fill="url(#redBar)"/>
  <rect x="18" y="18" width="564" height="414" rx="22" fill="none" stroke="#dc2626" stroke-opacity="0.28" stroke-width="1.5"/>
  <rect x="155" y="38" width="290" height="34" rx="10" fill="#23070b" stroke="#dc2626" stroke-opacity="0.6" stroke-width="1.2"/>
  <text x="300" y="60" text-anchor="middle" fill="#fca5a5" font-family="Arial, sans-serif" font-weight="800" font-size="13" letter-spacing="2.5">RAVON AUTO TUNING</text>
  <rect x="190" y="84" width="220" height="26" rx="8" fill="#141418" stroke="#f59e0b" stroke-opacity="0.45" stroke-width="1"/>
  <text x="300" y="101" text-anchor="middle" fill="#fbbf24" font-family="Arial, sans-serif" font-weight="700" font-size="11" letter-spacing="1.5">${catText}</text>
  ${iconSvg}
  <text x="300" y="${line2 ? '270' : '282'}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="800" font-size="21">${line1}</text>
  ${line2 ? `<text x="300" y="300" text-anchor="middle" fill="#d4d4d8" font-family="Arial, sans-serif" font-weight="700" font-size="18">${line2}</text>` : ''}
  <rect x="165" y="366" width="270" height="36" rx="10" fill="#32080d" stroke="#ef4444" stroke-opacity="0.55" stroke-width="1.2"/>
  <text x="300" y="389" text-anchor="middle" fill="#fecaca" font-family="Arial, sans-serif" font-weight="800" font-size="12" letter-spacing="2">GM ORIGINAL • KAFOLAT</text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * Smart Product Image Selector (`getSmartProductImage(product)`):
 * 1. If the admin uploaded/linked a real product photo (`hasRealProductImage(product.image)`), returns that real photo.
 * 2. Otherwise, NEVER returns random sports car photos (no Porsche/Lamborghini/etc.) — returns the
 *    Ravon Auto Tuning Minimalist SVG Card featuring the brand logo and the product's category/part vector icon.
 */
export function getSmartProductImage(
  product?: {
    name?: string;
    bazaarName?: string;
    category?: string;
    sku?: string;
    brand?: string;
    image?: string | null;
  } | null
): string {
  if (!product) return getRavonSvgFallbackDataUri();

  if (hasRealProductImage(product.image)) {
    return product.image!.trim();
  }

  return getRavonSvgFallbackDataUri(product);
}

/**
 * Universal `onError` handler for all product `<img>` tags across the Storefront & Admin Panel.
 * Replaces any failed image URL immediately with the branded SVG Data URI card.
 */
export function handleProductImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  product?: { name?: string; bazaarName?: string; category?: string; sku?: string; brand?: string }
): void {
  const img = e.currentTarget;
  const fallbackUri = getRavonSvgFallbackDataUri(product);
  if (img.src !== fallbackUri) {
    img.onerror = null;
    img.src = fallbackUri;
  }
}

interface ProductImagePlaceholderProps {
  name: string;
  category?: string;
  sku?: string;
  brand?: string;
  variant?: 'card' | 'modal' | 'thumb';
  className?: string;
}

/**
 * Branded "Ravon Auto Tuning" Black & Red Card component.
 */
export const ProductImagePlaceholder: React.FC<ProductImagePlaceholderProps> = ({
  name,
  category = 'Ehtiyot qism',
  sku,
  brand,
  variant = 'card',
  className = '',
}) => {
  if (variant === 'thumb') {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#140709] via-[#0b0d13] to-[#1a080b] border border-red-900/50 flex flex-col items-center justify-center text-center p-1 select-none ${className}`}
      >
        <div className="w-4 h-4 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-0.5">
          <Camera className="w-2.5 h-2.5" />
        </div>
        <span className="font-racing text-[7px] font-bold uppercase tracking-wider text-red-400 leading-tight line-clamp-1">
          GM Original
        </span>
      </div>
    );
  }

  const isModal = variant === 'modal';

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#16070a] via-[#0b0c12] to-[#1d080c] flex flex-col items-center justify-between p-3 sm:p-5 text-center select-none ${className}`}
    >
      <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-red-600/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-red-700/15 blur-2xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'radial-gradient(circle at 2px 2px, rgba(239,68,68,0.35) 1px, transparent 0)',
          backgroundSize: '14px 14px',
        }}
      />
      <div className="pointer-events-none absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-80" />

      <div className="relative z-10 w-full flex items-center justify-center gap-1.5 pt-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-950/80 border border-red-700/50 text-[9px] sm:text-[10px] font-racing font-bold uppercase tracking-widest text-red-300 shadow-sm">
          <Car className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-500 shrink-0" />
          <span>RAVON AUTO TUNING</span>
        </span>
      </div>

      <div className="relative z-10 my-auto px-1 sm:px-2 flex flex-col items-center justify-center space-y-1.5 max-w-full">
        <div className="flex flex-wrap items-center justify-center gap-1">
          {category && (
            <span className="px-2 py-0.5 rounded bg-zinc-900/90 border border-zinc-700/80 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-400 truncate max-w-[140px] sm:max-w-[200px]">
              {category}
            </span>
          )}
          {sku && (
            <span className="px-1.5 py-0.5 rounded bg-black/80 border border-zinc-800 text-[9px] sm:text-[10px] font-mono text-zinc-300 truncate max-w-[120px]">
              {sku}
            </span>
          )}
        </div>

        <h4
          className={`font-racing font-bold text-white leading-snug line-clamp-2 sm:line-clamp-3 break-words ${
            isModal ? 'text-sm sm:text-lg max-w-md' : 'text-[11px] sm:text-sm max-w-[220px]'
          }`}
        >
          {name}
        </h4>

        {brand && isModal && (
          <span className="text-[10px] sm:text-xs text-zinc-400 font-medium">{brand}</span>
        )}
      </div>

      <div className="relative z-10 w-full flex items-center justify-center pb-5 sm:pb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-red-600/25 via-red-900/40 to-red-600/25 border border-red-500/50 text-red-200 shadow-lg shadow-red-950/60">
          <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400 shrink-0" />
          <span className="font-racing text-[9px] sm:text-[11px] font-bold uppercase tracking-wider">
            GM ORIGINAL • KAFOLAT
          </span>
          <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0 hidden sm:inline" />
        </div>
      </div>
    </div>
  );
};
