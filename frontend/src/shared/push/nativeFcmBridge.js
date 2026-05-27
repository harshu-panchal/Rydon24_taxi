import { saveDriverFcmToken, getLocalDriverToken } from '../../modules/driver/services/registrationService';
import { userAuthService, getLocalUserToken } from '../../modules/user/services/authService';

const PENDING_NATIVE_FCM_KEY = 'pendingNativeFcmRegistration';
const LAST_NATIVE_FCM_KEY = 'lastNativeFcmRegistration';
const LAST_NATIVE_FCM_DEBUG_KEY = 'lastNativeFcmDebugState';
const DRIVER_PORTAL_ROLES = new Set([
  'driver',
  'owner',
  'pooling_driver',
  'bus_driver',
  'service_center',
  'service_center_staff',
]);

const decodeBase64Url = (value) => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  return normalized + '='.repeat(padding);
};

const getTokenPayload = (token) => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const payload = token.split('.')[1];

    if (!payload) {
      return null;
    }

    return JSON.parse(atob(decodeBase64Url(payload)));
  } catch {
    return null;
  }
};

const inferRole = (explicitRole) => {
  const normalizedRole = String(explicitRole || '').trim().toLowerCase();

  if (normalizedRole === 'user' || DRIVER_PORTAL_ROLES.has(normalizedRole)) {
    return normalizedRole;
  }

  const pathname = String(window.location.pathname || '').toLowerCase();
  if (pathname.includes('/taxi/owner')) {
    return 'owner';
  }
  if (pathname.includes('/taxi/driver')) {
    return 'driver';
  }
  if (pathname.includes('/taxi/user')) {
    return 'user';
  }

  const storedCandidates = [
    sessionStorage.getItem('driverToken'),
    sessionStorage.getItem('token'),
    localStorage.getItem('driverToken'),
    localStorage.getItem('userToken'),
    localStorage.getItem('token'),
  ].filter(Boolean);

  const tokenRole = storedCandidates
    .map((token) => getTokenPayload(token)?.role)
    .find((role) => role === 'user' || DRIVER_PORTAL_ROLES.has(String(role || '').toLowerCase()));

  return String(tokenRole || '').toLowerCase();
};

const hasRoleSession = (role) => {
  if (DRIVER_PORTAL_ROLES.has(String(role || '').toLowerCase())) {
    return Boolean(getLocalDriverToken());
  }

  if (role === 'user') {
    return Boolean(getLocalUserToken());
  }

  return false;
};

const persistLastRegistration = (payload) => {
  localStorage.setItem(LAST_NATIVE_FCM_KEY, JSON.stringify({
    ...payload,
    updatedAt: new Date().toISOString(),
  }));
};

const savePendingRegistration = (payload) => {
  localStorage.setItem(PENDING_NATIVE_FCM_KEY, JSON.stringify({
    ...payload,
    updatedAt: new Date().toISOString(),
  }));
};

const readPendingRegistration = () => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_NATIVE_FCM_KEY) || 'null');
  } catch {
    return null;
  }
};

const clearPendingRegistration = () => {
  localStorage.removeItem(PENDING_NATIVE_FCM_KEY);
};

const persistDebugState = (payload) => {
  try {
    localStorage.setItem(LAST_NATIVE_FCM_DEBUG_KEY, JSON.stringify({
      ...payload,
      updatedAt: new Date().toISOString(),
    }));
  } catch {}
};

const submitFcmToken = async ({ token, role, platform = 'mobile' }) => {
  const normalizedRole = inferRole(role);
  const normalizedPlatform = String(platform || 'mobile').trim().toLowerCase() || 'mobile';
  const normalizedToken = String(token || '').trim();

  if (!normalizedToken) {
    persistDebugState({ ok: false, reason: 'missing-token', role: normalizedRole, platform: normalizedPlatform });
    return { ok: false, reason: 'missing-token' };
  }

  if (!normalizedRole) {
    savePendingRegistration({ token: normalizedToken, role: '', platform: normalizedPlatform });
    persistDebugState({ ok: false, reason: 'missing-role', role: '', platform: normalizedPlatform });
    return { ok: false, reason: 'missing-role' };
  }

  if (!hasRoleSession(normalizedRole)) {
    savePendingRegistration({ token: normalizedToken, role: normalizedRole, platform: normalizedPlatform });
    persistDebugState({ ok: false, reason: 'missing-auth', role: normalizedRole, platform: normalizedPlatform });
    return { ok: false, reason: 'missing-auth' };
  }

  if (DRIVER_PORTAL_ROLES.has(normalizedRole)) {
    await saveDriverFcmToken(normalizedToken, normalizedPlatform);
  } else {
    await userAuthService.saveFcmToken(normalizedToken, normalizedPlatform);
  }

  clearPendingRegistration();
  persistLastRegistration({
    token: normalizedToken,
    role: normalizedRole,
    platform: normalizedPlatform,
  });
  persistDebugState({ ok: true, reason: 'saved', role: normalizedRole, platform: normalizedPlatform });

  return { ok: true, role: normalizedRole, platform: normalizedPlatform };
};

const flushPendingRegistration = async () => {
  const pending = readPendingRegistration();

  if (!pending?.token) {
    return { ok: false, reason: 'no-pending-token' };
  }

  try {
    return await submitFcmToken(pending);
  } catch (error) {
    console.warn('[native-fcm-bridge] pending registration failed', error?.message || error);
    return { ok: false, reason: 'submit-failed' };
  }
};

export const installNativeFcmBridge = () => {
  const drainQueuedCalls = async () => {
    const queuedCalls = Array.isArray(window.__pendingNativeFcmCalls)
      ? [...window.__pendingNativeFcmCalls]
      : [];

    window.__pendingNativeFcmCalls = [];

    for (const queuedCall of queuedCalls) {
      try {
        await submitFcmToken(queuedCall || {});
      } catch (error) {
        savePendingRegistration({
          token: queuedCall?.token,
          role: inferRole(queuedCall?.role),
          platform: queuedCall?.platform || 'mobile',
        });
      }
    }
  };

  window.__saveNativeFcmToken = async (token, role, platform = 'mobile') => {
    try {
      const result = await submitFcmToken({ token, role, platform });
      console.info('[native-fcm-bridge] token registration result', result);
      return result;
    } catch (error) {
      console.error('[native-fcm-bridge] token registration error', error);
      savePendingRegistration({ token, role: inferRole(role), platform });
      persistDebugState({
        ok: false,
        reason: error?.message || 'unknown-error',
        role: inferRole(role),
        platform: String(platform || 'mobile').trim().toLowerCase() || 'mobile',
      });
      return { ok: false, reason: error?.message || 'unknown-error' };
    }
  };

  window.__flushNativeFcmToken = async () => {
    const result = await flushPendingRegistration();
    console.info('[native-fcm-bridge] flush result', result);
    return result;
  };

  window.__getNativeFcmDebugState = () => {
    try {
      return JSON.parse(localStorage.getItem(LAST_NATIVE_FCM_DEBUG_KEY) || 'null');
    } catch {
      return null;
    }
  };

  const retryPending = () => {
    flushPendingRegistration().catch(() => {});
  };

  window.addEventListener('focus', retryPending);
  window.addEventListener('pageshow', retryPending);
  window.addEventListener('app:auth-ready', retryPending);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      retryPending();
    }
  });

  drainQueuedCalls().catch(() => {});
  window.setTimeout(retryPending, 1500);
  window.setInterval(retryPending, 15000);
};
