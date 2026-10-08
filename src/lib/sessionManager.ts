// Concurrent Multi-Device Session Management Engine
// Enables seamless, simultaneous login from multiple phones, PCs, and tablets under the same account without kicking anyone out.

export interface UserSession {
  deviceId: string;
  deviceName: string;
  user: {
    uid: string;
    email: string;
    displayName: string;
    role: string;
    photoURL?: string | null;
  };
  loginTime: string;
  lastActive: string;
  token?: string | null;
}

export interface RemoteSessionInfo {
  deviceId: string;
  deviceName: string;
  user: {
    uid: string;
    email: string;
    displayName: string;
    role: string;
    photoURL?: string | null;
  };
  loginTime: string;
  lastActive: string;
  isCurrent?: boolean;
}

const SESSION_STORAGE_KEY = 'hr_multi_device_session';
const DEVICE_ID_KEY = 'hr_device_unique_id';

// Generates or retrieves a persistent, unique device identifier for this browser
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  try {
    let devId = localStorage.getItem(DEVICE_ID_KEY);
    if (!devId) {
      const randomPart = Math.random().toString(36).substring(2, 10);
      const timestamp = Date.now().toString(36);
      devId = `dev_${timestamp}_${randomPart}`;
      localStorage.setItem(DEVICE_ID_KEY, devId);
    }
    return devId;
  } catch {
    return `dev_${Date.now()}`;
  }
}

// Automatically detects a human-readable name for this device/browser
export function detectDeviceName(): string {
  if (typeof window === 'undefined' || !navigator) return 'Веб-пристрій';
  const ua = navigator.userAgent || '';
  
  let os = 'Пристрій';
  if (/iPad|iPhone|iPod/.test(ua)) os = 'iPhone/iPad';
  else if (/Android/.test(ua)) os = 'Android телефон';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'Mac';
  else if (/Windows/.test(ua)) os = 'Windows ПК';
  else if (/Linux/.test(ua)) os = 'Linux';

  let browser = 'Браузер';
  if (/Edg/.test(ua)) browser = 'Edge';
  else if (/Chrome/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Firefox/.test(ua)) browser = 'Firefox';

  return `${os} (${browser})`;
}

// Saves session to localStorage and dispatches a local event
export function saveActiveSession(session: UserSession): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    // Also save legacy compatibility keys so existing code works seamlessly
    localStorage.setItem('hr_local_auth', 'true');
    localStorage.setItem('hr_local_role', session.user.role || session.user.displayName || 'Марія Мельник (Власник)');
    if (session.user) {
      localStorage.setItem('google_user_profile', JSON.stringify(session.user));
    }
    if (session.token) {
      localStorage.setItem('oauth_access_token', session.token);
    }
  } catch (err) {
    console.warn('Failed to save session to localStorage:', err);
  }
}

// Retrieves currently active session from localStorage
export function loadActiveSession(): UserSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.user) {
        return parsed;
      }
    }

    // Fallback: check legacy keys and construct session if present
    const isLocalAuth = localStorage.getItem('hr_local_auth');
    const localRole = localStorage.getItem('hr_local_role') || 'Марія Мельник (Власник)';
    const profileStr = localStorage.getItem('google_user_profile');
    const token = localStorage.getItem('oauth_access_token');

    if (isLocalAuth === 'true' || profileStr) {
      let userObj = {
        uid: 'user-default',
        email: 'mariia.melnyk011@gmail.com',
        displayName: localRole,
        role: localRole,
        photoURL: null as string | null
      };

      if (profileStr) {
        try {
          const p = JSON.parse(profileStr);
          userObj = {
            uid: p.uid || userObj.uid,
            email: p.email || userObj.email,
            displayName: p.displayName || localRole,
            role: localRole,
            photoURL: p.photoURL || null
          };
        } catch {}
      }

      const recovered: UserSession = {
        deviceId: getOrCreateDeviceId(),
        deviceName: detectDeviceName(),
        user: userObj,
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        token: token || null
      };
      saveActiveSession(recovered);
      return recovered;
    }
  } catch (err) {
    console.warn('Failed to load active session:', err);
  }
  return null;
}

// Clears session on THIS device only (does not affect other devices)
export function clearActiveSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem('hr_local_auth');
    localStorage.removeItem('hr_local_role');
    localStorage.removeItem('oauth_access_token');
    localStorage.removeItem('google_user_profile');
  } catch (err) {
    console.warn('Failed to clear session:', err);
  }
}

// Sends a heartbeat ping to the server to register this device session
export async function sendSessionHeartbeat(session: UserSession): Promise<void> {
  try {
    session.lastActive = new Date().toISOString();
    saveActiveSession(session);

    await fetch('/api/sessions/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        user: session.user,
        lastActive: session.lastActive,
        loginTime: session.loginTime
      })
    });
  } catch (err) {
    // Non-blocking background failure
  }
}

// Fetches all connected device sessions from the server
export async function fetchAllActiveSessions(): Promise<RemoteSessionInfo[]> {
  try {
    const res = await fetch('/api/sessions');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.sessions)) {
        const currentDeviceId = getOrCreateDeviceId();
        return data.sessions.map((s: any) => ({
          ...s,
          isCurrent: s.deviceId === currentDeviceId
        }));
      }
    }
  } catch (err) {
    console.warn('Could not fetch active sessions from server:', err);
  }
  return [];
}
