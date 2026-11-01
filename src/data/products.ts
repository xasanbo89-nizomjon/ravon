import { Product } from '../types';

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
    image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=600&q=80',
    expectedTerm: 'Optra stop',
  },
  {
    title: 'Amerikanka fara',
    subtitle: 'Gentra old LED optika',
    image: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=600&q=80',
    expectedTerm: 'Amerikanka fara',
  },
  {
    title: 'Malibu 2 rul',
    subtitle: 'Multifunksional charm rul',
    image: 'https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?auto=format&fit=crop&w=600&q=80',
    expectedTerm: 'Malibu 2 rul',
  },
  {
    title: 'Mers deflektor',
    subtitle: '64 RGB turbina salon vent',
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
    expectedTerm: 'Mers deflektor',
  },
  {
    title: 'Zimmer LED',
    subtitle: '120W sovutgichli lampalar',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80',
    expectedTerm: 'Zimmer LED',
  },
];
