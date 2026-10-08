import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Explicitly ensure robust multi-device local persistence
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(err => {
    console.warn('Firebase setPersistence warning:', err);
  });
}

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'consent select_account'
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

const loadGsiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      return resolve();
    }
    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

export const directGoogleSignIn = async (forceConsent: boolean = true): Promise<{ user: any; accessToken: string }> => {
  await loadGsiScript();
  const clientId = firebaseConfig.oAuthClientId || '602934972978-d6sgquoeuhmadn09gdmc9u4r2j013a8c.apps.googleusercontent.com';

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (response: any) => {
          if (response.error) {
            return reject(new Error(response.error_description || response.error));
          }
          if (!response.access_token) {
            return reject(new Error('Не вдалося отримати Access Token від Google'));
          }

          const accessToken = response.access_token;
          cachedAccessToken = accessToken;
          localStorage.setItem('oauth_access_token', accessToken);

          try {
            const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            const profile = await profileRes.json();
            const userObj = {
              uid: profile.sub || 'google-user',
              email: profile.email || 'mariia.melnyk011@gmail.com',
              displayName: profile.name || 'Марія Мельник',
              photoURL: profile.picture || null,
            };
            localStorage.setItem('google_user_profile', JSON.stringify(userObj));
            resolve({ user: userObj, accessToken });
          } catch {
            const fallbackUser = {
              uid: 'google-user',
              email: 'mariia.melnyk011@gmail.com',
              displayName: 'Марія Мельник',
              photoURL: null,
            };
            localStorage.setItem('google_user_profile', JSON.stringify(fallbackUser));
            resolve({ user: fallbackUser, accessToken });
          }
        },
        error_callback: (err: any) => {
          reject(new Error(err.message || 'Помилка авторизації Google OAuth'));
        }
      });

      tokenClient.requestAccessToken({ prompt: forceConsent ? 'consent select_account' : 'consent' });
    } catch (err) {
      reject(err);
    }
  });
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check if saved direct Google token exists in localStorage
  const savedToken = localStorage.getItem('oauth_access_token');
  const savedProfileStr = localStorage.getItem('google_user_profile');
  if (savedToken && savedProfileStr) {
    try {
      const userObj = JSON.parse(savedProfileStr);
      cachedAccessToken = savedToken;
      if (onAuthSuccess) onAuthSuccess(userObj, savedToken);
    } catch {
      // ignore
    }
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const savedToken = localStorage.getItem('oauth_access_token');
      if (savedToken) {
        cachedAccessToken = savedToken;
      }
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure && !savedProfileStr) onAuthFailure();
      }
    } else {
      const savedToken = localStorage.getItem('oauth_access_token');
      const savedProfileStr = localStorage.getItem('google_user_profile');
      if (savedToken && savedProfileStr) {
        try {
          const userObj = JSON.parse(savedProfileStr);
          cachedAccessToken = savedToken;
          if (onAuthSuccess) onAuthSuccess(userObj, savedToken);
          return;
        } catch {
          // ignore
        }
      }
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('oauth_access_token', cachedAccessToken);
    const userObj = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL
    };
    localStorage.setItem('google_user_profile', JSON.stringify(userObj));
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.warn('Firebase Sign-In failed or unauthorized domain, falling back to direct Google OAuth...', error);
    if (
      error.code === 'auth/unauthorized-domain' ||
      error.code === 'auth/operation-not-allowed' ||
      error.message?.includes('unauthorized-domain') ||
      error.message?.includes('popup')
    ) {
      return await directGoogleSignIn();
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const emailSignIn = async (email: string, pass: string): Promise<User> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  return userCredential.user;
};

export const emailSignUp = async (email: string, pass: string, displayName?: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName && userCredential.user) {
    await updateProfile(userCredential.user, { displayName });
  }
  return userCredential.user;
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
  cachedAccessToken = null;
  localStorage.removeItem('oauth_access_token');
  localStorage.removeItem('google_user_profile');
};
