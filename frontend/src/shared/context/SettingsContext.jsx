import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axiosInstance';

const SettingsContext = createContext(null);
let activeFaviconObjectUrl = '';

const ensureHeadLink = (selector, relValue) => {
  let link = document.head.querySelector(selector);
  if (!link) {
    link = document.createElement('link');
    link.rel = relValue;
    document.head.appendChild(link);
  }
  return link;
};

const getFaviconType = (faviconUrl = '') => {
  if (!faviconUrl) return 'image/png';

  if (faviconUrl.startsWith('data:image/')) {
    return faviconUrl.split(';')[0].split(':')[1] || 'image/png';
  }

  const cleanUrl = faviconUrl.split('?')[0].toLowerCase();

  if (cleanUrl.endsWith('.svg')) return 'image/svg+xml';
  if (cleanUrl.endsWith('.png')) return 'image/png';
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg';
  if (cleanUrl.endsWith('.webp')) return 'image/webp';
  if (cleanUrl.endsWith('.gif')) return 'image/gif';
  if (cleanUrl.endsWith('.ico')) return 'image/x-icon';

  return 'image/png';
};

const dataUrlToBlob = (dataUrl = '') => {
  const [meta, content] = dataUrl.split(',');
  const mimeMatch = meta.match(/data:(.*?)(;base64)?$/i);
  const mime = mimeMatch?.[1] || 'image/png';
  const binary = window.atob(content || '');
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
};

const buildFaviconHref = (faviconUrl = '') => {
  if (!faviconUrl) {
    if (activeFaviconObjectUrl) {
      URL.revokeObjectURL(activeFaviconObjectUrl);
      activeFaviconObjectUrl = '';
    }
    return '';
  }

  if (faviconUrl.startsWith('data:')) {
    if (activeFaviconObjectUrl) {
      URL.revokeObjectURL(activeFaviconObjectUrl);
    }
    activeFaviconObjectUrl = URL.createObjectURL(dataUrlToBlob(faviconUrl));
    return activeFaviconObjectUrl;
  }

  if (activeFaviconObjectUrl) {
    URL.revokeObjectURL(activeFaviconObjectUrl);
    activeFaviconObjectUrl = '';
  }

  return `${faviconUrl}${faviconUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    general: {
      app_name: '',
      logo: '',
      favicon: '',
    },
    customization: {
      admin_theme_color: '',
      currency_symbol: '',
    },
    transportRide: {
      enable_bus_service: '0',
    },
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const [genRes, cusRes, transportRideRes] = await Promise.allSettled([
        api.get('/admin/general-settings/general'),
        api.get('/admin/general-settings/customize'),
        api.get('/admin/general-settings/transport-ride'),
      ]);

      setSettings({
        general: genRes.status === 'fulfilled' ? (genRes.value.data?.settings || {}) : {},
        customization: cusRes.status === 'fulfilled' ? (cusRes.value.data?.settings || {}) : {},
        transportRide:
          transportRideRes.status === 'fulfilled'
            ? (transportRideRes.value.data?.settings || {})
            : { enable_bus_service: '0' },
      });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const appName = settings.general?.app_name || 'App';
    document.title = appName;

    const favicon = settings.general?.favicon || settings.customization?.favicon;
    if (favicon) {
      const href = buildFaviconHref(favicon);
      const type = getFaviconType(favicon);

      const iconLink = ensureHeadLink("link[rel='icon']", 'icon');
      const shortcutIconLink = ensureHeadLink("link[rel='shortcut icon']", 'shortcut icon');
      const appleTouchIconLink = ensureHeadLink("link[rel='apple-touch-icon']", 'apple-touch-icon');

      [iconLink, shortcutIconLink, appleTouchIconLink].forEach((link) => {
        link.href = href;
        link.type = type;
        link.sizes = '64x64';
      });
    }

    return () => {
      if (activeFaviconObjectUrl) {
        URL.revokeObjectURL(activeFaviconObjectUrl);
        activeFaviconObjectUrl = '';
      }
    };
  }, [settings.general?.app_name, settings.general?.favicon, settings.customization?.favicon]);

  const refreshSettings = () => fetchSettings();

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
