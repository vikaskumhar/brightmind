import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User as FirebaseUser
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  updateDoc,
  type Timestamp,
  type Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
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
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export type AllGameId =
  | 'memory'
  | 'numbers'
  | 'words'
  | 'mental-rotation'
  | 'trail-making-ab'
  | 'corsi-span'
  | 'calcudoku-4x4'
  | 'rvip-vigilance'
  | 'anagrams-fluency';

export interface FirebaseUserProfile {
  uid: string;
  displayName: string;
  role: 'member';
  ageRange?: string;
  totalGames: number;
  streakDays: number;
  lastPlayedDate: string;
  textSize: 'large' | 'extra-large';
  highContrast: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  language: 'en' | 'hi';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CognitiveSessionRecord {
  id: string;
  userId: string;
  gameId: AllGameId;
  domain: string;
  score: number;
  accuracyPercent: number;
  avgReactionTimeMs: number;
  durationSeconds: number;
  playedAt?: Timestamp;
}

export interface SessionInput {
  gameId: AllGameId;
  domain: string;
  score: number;
  accuracyPercent: number;
  avgReactionTimeMs: number;
  durationSeconds: number;
}

export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  if (Capacitor.isNativePlatform()) {
    const nativeResult = await FirebaseAuthentication.signInWithGoogle();
    const idToken = nativeResult.credential?.idToken;
    if (!idToken) {
      throw new Error(
        'Mobile Google Sign-In did not return an ID token. Verify google-services.json and SHA-1 in Firebase Console.'
      );
    }
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    await ensureUserProfile(result.user);
    return result.user;
  }

  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch {
      // Ignore native sign-out error and still clear JS SDK session
    }
  }
  await signOut(auth);
}

function clampString(value: string, maxLen: number, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

export async function ensureUserProfile(user: FirebaseUser): Promise<void> {
  const userPath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/info`;
  const userRef = doc(db, 'users', user.uid);
  const privateRef = doc(db, 'users', user.uid, 'private', 'info');

  try {
    const snap = await getDoc(userRef);
    const safeName = clampString(user.displayName || 'Bright Mind Member', 80, 'Member');
    const safeEmail = clampString(user.email || 'unknown@example.com', 254, 'unknown@example.com');
    const safePhoto = user.photoURL ? user.photoURL.slice(0, 512) : undefined;

    if (!snap.exists()) {
      const batch = writeBatch(db);
      batch.set(userRef, {
        uid: user.uid,
        displayName: safeName,
        role: 'member',
        totalGames: 0,
        streakDays: 0,
        lastPlayedDate: '',
        textSize: 'large',
        highContrast: false,
        soundEnabled: true,
        reducedMotion: false,
        language: 'en',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      batch.set(privateRef, {
        uid: user.uid,
        email: safeEmail,
        ...(safePhoto ? { photoUrl: safePhoto } : {}),
        updatedAt: serverTimestamp()
      });
      await batch.commit();
    } else {
      const privateSnap = await getDoc(privateRef);
      if (!privateSnap.exists()) {
        const batch = writeBatch(db);
        batch.set(privateRef, {
          uid: user.uid,
          email: safeEmail,
          ...(safePhoto ? { photoUrl: safePhoto } : {}),
          updatedAt: serverTimestamp()
        });
        await batch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${userPath} | ${privatePath}`);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: FirebaseUserProfile | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      onData(snapshot.exists() ? (snapshot.data() as FirebaseUserProfile) : null);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeUserSessions(
  uid: string,
  onData: (sessions: CognitiveSessionRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/sessions`;
  const q = query(collection(db, 'users', uid, 'sessions'), orderBy('playedAt', 'desc'), limit(30));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CognitiveSessionRecord, 'id'>)
      }));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function recordCognitiveSession(
  uid: string,
  currentProfile: FirebaseUserProfile,
  session: SessionInput
): Promise<void> {
  const sessionsPath = `users/${uid}/sessions`;
  const userRef = doc(db, 'users', uid);
  const sessionRef = doc(collection(db, 'users', uid, 'sessions'));

  const today = getTodayIsoDate();
  const yesterday = getYesterdayIsoDate();
  let nextStreak = currentProfile.streakDays || 0;
  if (currentProfile.lastPlayedDate === today) {
    nextStreak = Math.max(1, nextStreak);
  } else if (currentProfile.lastPlayedDate === yesterday) {
    nextStreak = nextStreak + 1;
  } else {
    nextStreak = 1;
  }

  const sanitizedScore = Math.max(0, Math.min(10000, Math.round(session.score)));
  const sanitizedAccuracy = Math.max(0, Math.min(100, Math.round(session.accuracyPercent * 10) / 10));
  const sanitizedRt = Math.max(0, Math.min(600000, Math.round(session.avgReactionTimeMs)));
  const sanitizedDuration = Math.max(0, Math.min(7200, Math.round(session.durationSeconds)));
  const sanitizedDomain = clampString(session.domain, 80, 'Cognitive Practice');

  try {
    const batch = writeBatch(db);
    batch.set(sessionRef, {
      userId: uid,
      gameId: session.gameId,
      domain: sanitizedDomain,
      score: sanitizedScore,
      accuracyPercent: sanitizedAccuracy,
      avgReactionTimeMs: sanitizedRt,
      durationSeconds: sanitizedDuration,
      playedAt: serverTimestamp()
    });
    batch.update(userRef, {
      totalGames: increment(1),
      streakDays: nextStreak,
      lastPlayedDate: today,
      updatedAt: serverTimestamp()
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, sessionsPath);
  }
}

export async function updateUserPreferences(
  uid: string,
  patch: Partial<
    Pick<
      FirebaseUserProfile,
      'textSize' | 'highContrast' | 'soundEnabled' | 'reducedMotion' | 'language' | 'ageRange' | 'displayName'
    >
  >
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const cleanPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.textSize) cleanPatch.textSize = patch.textSize;
    if (typeof patch.highContrast === 'boolean') cleanPatch.highContrast = patch.highContrast;
    if (typeof patch.soundEnabled === 'boolean') cleanPatch.soundEnabled = patch.soundEnabled;
    if (typeof patch.reducedMotion === 'boolean') cleanPatch.reducedMotion = patch.reducedMotion;
    if (patch.language) cleanPatch.language = patch.language;
    if (typeof patch.ageRange === 'string') cleanPatch.ageRange = patch.ageRange.slice(0, 30);
    if (typeof patch.displayName === 'string' && patch.displayName.trim()) {
      cleanPatch.displayName = patch.displayName.trim().slice(0, 80);
    }
    await updateDoc(doc(db, 'users', uid), cleanPatch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
