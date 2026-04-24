const DRIVER_NOTIFICATION_HIDDEN_KEY = 'driverNotificationHiddenIds';
const DRIVER_NOTIFICATION_READ_KEY = 'driverNotificationReadIds';

const readIdSet = (storageKey) => {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((value) => String(value || '')) : []);
  } catch {
    return new Set();
  }
};

const writeIdSet = (storageKey, values) => {
  localStorage.setItem(storageKey, JSON.stringify(Array.from(values)));
};

export const getHiddenDriverNotificationIds = () => readIdSet(DRIVER_NOTIFICATION_HIDDEN_KEY);

export const hideDriverNotification = (id) => {
  const next = getHiddenDriverNotificationIds();
  next.add(String(id || ''));
  writeIdSet(DRIVER_NOTIFICATION_HIDDEN_KEY, next);
  return next;
};

export const hideAllDriverNotifications = (ids = []) => {
  const next = getHiddenDriverNotificationIds();
  ids.forEach((id) => next.add(String(id || '')));
  writeIdSet(DRIVER_NOTIFICATION_HIDDEN_KEY, next);
  return next;
};

export const getReadDriverNotificationIds = () => readIdSet(DRIVER_NOTIFICATION_READ_KEY);

export const markDriverNotificationsAsRead = (ids = []) => {
  const next = getReadDriverNotificationIds();
  ids.forEach((id) => next.add(String(id || '')));
  writeIdSet(DRIVER_NOTIFICATION_READ_KEY, next);
  return next;
};

export const getVisibleDriverNotifications = (notifications = []) => {
  const hiddenIds = getHiddenDriverNotificationIds();
  return notifications.filter((notification) => !hiddenIds.has(String(notification?.id || notification?._id || '')));
};

export const getUnreadDriverNotificationCount = (notifications = []) => {
  const hiddenIds = getHiddenDriverNotificationIds();
  const readIds = getReadDriverNotificationIds();

  return notifications.reduce((count, notification) => {
    const id = String(notification?.id || notification?._id || '');
    if (!id || hiddenIds.has(id) || readIds.has(id)) {
      return count;
    }
    return count + 1;
  }, 0);
};
