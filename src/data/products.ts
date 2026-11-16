import { Product } from '../types';
import { getRavonSvgFallbackDataUri } from '../components/ProductImagePlaceholder';

/**
 * Legacy static demo product IDs that must NEVER be reloaded if present in old caches.
 */
export const STATIC_DEMO_PRODUCT_IDS = new Set<string>([
  'ravon-optra-stop',
  'ravon-amerikanka-fara',
  'ravon-malibu2-rul',
  'ravon-amg-rul',
  'ravon-mers-deflektor',
  'ravon-malibu-bar',
  'ravon-gentra-oblisovka',
  'ravon-zimmer-led',
  'ravon-sport-chexol',
  'ravon-7d-polik',
  'ravon-ss20-amortizator',
  'ravon-hiq-kolodka',
  'ravon-spark-spoyler',
  'ravon-startstop-knopka',
]);

/**
 * Static products are intentionally empty so deleted/cleared products (Zimmer LED, etc.)
 * never reappear on page refresh or in a new tab when localStorage is empty.
 */
export const PRODUCTS: Product[] = [];

// Presets for users who want to try the AI search instantly without preparing a photo
export const SAMPLE_AI_PRESETS = [
  {
    title: 'Optra Stop fara',
    subtitle: 'Gentra orqa chirogʻi',
    image: getRavonSvgFallbackDataUri({ name: 'Optra Stop fara', category: 'Optika va Yoritish' }),
    expectedTerm: 'Optra stop',
  },
  {
    title: 'Amerikanka fara',
    subtitle: 'Gentra old LED optika',
    image: getRavonSvgFallbackDataUri({ name: 'Amerikanka fara', category: 'Optika va Yoritish' }),
    expectedTerm: 'Amerikanka fara',
  },
  {
    title: 'Malibu 2 rul',
    subtitle: 'Multifunksional charm rul',
    image: getRavonSvgFallbackDataUri({ name: 'Malibu 2 rul', category: 'Salon va Tyuning' }),
    expectedTerm: 'Malibu 2 rul',
  },
  {
    title: 'Mers deflektor',
    subtitle: '64 RGB turbina salon vent',
    image: getRavonSvgFallbackDataUri({ name: 'Mers deflektor', category: 'Salon va Tyuning' }),
    expectedTerm: 'Mers deflektor',
  },
  {
    title: 'Zimmer LED',
    subtitle: '120W sovutgichli lampalar',
    image: getRavonSvgFallbackDataUri({ name: 'Zimmer LED', category: 'Optika va Yoritish' }),
    expectedTerm: 'Zimmer LED',
  },
];
