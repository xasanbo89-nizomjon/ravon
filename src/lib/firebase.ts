import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
} from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const env =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : ({} as Record<string, string | undefined>);

export const userFirebaseConfig = {
  apiKey: (env.VITE_FIREBASE_API_KEY || 'AIzaSyDBatup_aGRai9H5om1bFl4M8FobQBg2Hs').trim(),
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN || 'ravon-f50ba.firebaseapp.com').trim(),
  databaseURL: (
    env.VITE_FIREBASE_DATABASE_URL || 'https://ravon-f50ba-default-rtdb.firebaseio.com'
  )
    .trim()
    .replace(/\/+$/, ''),
  projectId: (env.VITE_FIREBASE_PROJECT_ID || 'ravon-f50ba').trim(),
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET || 'ravon-f50ba.firebasestorage.app').trim(),
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID || '697368572732').trim(),
  appId: (env.VITE_FIREBASE_APP_ID || '1:697368572732:web:c879554aef8afc3dd62439').trim(),
  measurementId: (env.VITE_FIREBASE_MEASUREMENT_ID || 'G-W3JWGXJGER').trim(),
};

// 1. Primary App for Cloud Firestore (uses matched projectId + firestoreDatabaseId)
const app = initializeApp(firebaseAppletConfig);

let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    firebaseAppletConfig.firestoreDatabaseId
  );
} catch {
  firestoreDb = getFirestore(app, firebaseAppletConfig.firestoreDatabaseId);
}

// 2. User's Firebase Realtime Database App (ravon-f50ba-default-rtdb)
const rtdbApp = initializeApp(userFirebaseConfig, 'ravon-rtdb-app');
let realtimeDb: Database | null = null;
try {
  realtimeDb = getDatabase(rtdbApp, userFirebaseConfig.databaseURL);
} catch {
  realtimeDb = null;
}

export const db = firestoreDb;
export const rtdb = realtimeDb;
export const auth = getAuth(app);

export const FIREBASE_RTDB_URL = userFirebaseConfig.databaseURL;
export const FIREBASE_PROJECT_ID = firebaseAppletConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseAppletConfig.firestoreDatabaseId;
export const FIREBASE_API_KEY = firebaseAppletConfig.apiKey;
export const FIRESTORE_REST_BASE_URL = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
  FIREBASE_PROJECT_ID
)}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents`;

export let isFirestoreQuotaExceeded = false;

export function markFirestoreQuotaExceeded() {
  isFirestoreQuotaExceeded = true;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const lower = errMsg.toLowerCase();
  if (
    lower.includes('quota') ||
    lower.includes('resource-exhausted') ||
    lower.includes('resource_exhausted') ||
    lower.includes('429') ||
    lower.includes('offline')
  ) {
    isFirestoreQuotaExceeded = true;
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Notice:', JSON.stringify(errInfo));
}


