const withTimeout = (promise, timeoutMs = 1500) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      globalThis.setTimeout(() => reject(new Error('External checkout bridge timed out')), timeoutMs);
    }),
  ]);

const isAndroidWebView = () => {
  const userAgent = String(globalThis.navigator?.userAgent || '');
  return /; wv\)/i.test(userAgent) || /Version\/[\d.]+.*Chrome\/[\d.]+.*Mobile Safari/i.test(userAgent);
};

const recordCheckoutDiagnostic = (detail = {}) => {
  const payload = {
    ...detail,
    timestamp: new Date().toISOString(),
    userAgent: String(globalThis.navigator?.userAgent || ''),
  };

  try {
    globalThis.sessionStorage?.setItem('lastExternalCheckoutDiagnostic', JSON.stringify(payload));
  } catch {
    // Ignore storage failures in private browsing or restricted WebViews.
  }

  try {
    globalThis.dispatchEvent(new CustomEvent('external-checkout:diagnostic', { detail: payload }));
  } catch {
    // Ignore dispatch failures when CustomEvent support is unavailable.
  }

  console.info('[external-checkout]', payload);
};

const postToJavascriptChannel = (targetUrl) => {
  const channelNames = ['openExternalUrl', 'openExternalCheckout', 'ExternalNavigation', 'AppBridge'];

  for (const channelName of channelNames) {
    const channel = globalThis?.[channelName];

    if (typeof channel?.postMessage === 'function') {
      channel.postMessage(targetUrl);
      recordCheckoutDiagnostic({ status: 'channel-posted', channelName });
      return true;
    }
  }

  return false;
};

const callNativeInterface = (targetUrl) => {
  const bridgeNames = ['Android', 'NativeBridge', 'FlutterBridge', 'AppBridge'];
  const methodNames = ['openExternalUrl', 'openExternalCheckout', 'openUrl'];

  for (const bridgeName of bridgeNames) {
    const bridge = globalThis?.[bridgeName];
    if (!bridge) continue;

    for (const methodName of methodNames) {
      if (typeof bridge?.[methodName] === 'function') {
        bridge[methodName](targetUrl);
        recordCheckoutDiagnostic({ status: 'native-interface-called', bridgeName, methodName });
        return true;
      }
    }
  }

  if (typeof globalThis?.ReactNativeWebView?.postMessage === 'function') {
    globalThis.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'openExternalUrl',
      url: targetUrl,
    }));
    recordCheckoutDiagnostic({ status: 'react-native-posted' });
    return true;
  }

  return false;
};

const tryWindowOpen = (targetUrl) => {
  try {
    const popup = globalThis.open(targetUrl, '_blank', 'noopener,noreferrer');
    recordCheckoutDiagnostic({ status: 'window-open-attempted', opened: popup !== null });
    return true;
  } catch (error) {
    recordCheckoutDiagnostic({ status: 'window-open-failed', message: error?.message || String(error) });
    return false;
  }
};

const tryAnchorNavigation = (targetUrl) => {
  try {
    const anchor = globalThis.document?.createElement?.('a');
    if (!anchor || !globalThis.document?.body) {
      return false;
    }

    anchor.href = targetUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    globalThis.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    recordCheckoutDiagnostic({ status: 'anchor-open-attempted' });
    return true;
  } catch (error) {
    recordCheckoutDiagnostic({ status: 'anchor-open-failed', message: error?.message || String(error) });
    return false;
  }
};

export const openExternalCheckout = async (url) => {
  const targetUrl = String(url || '').trim();

  if (!targetUrl) {
    recordCheckoutDiagnostic({ status: 'missing-url' });
    return false;
  }

  const flutterBridge = globalThis?.flutter_inappwebview;
  const flutterHandler = flutterBridge?.callHandler;
  const hasFlutterInAppWebView = Boolean(globalThis?.flutter_inappwebview);
  const androidWebView = isAndroidWebView();

  recordCheckoutDiagnostic({
    status: 'starting',
    hasFlutterInAppWebView,
    androidWebView,
    targetHost: (() => {
      try {
        return new URL(targetUrl).host;
      } catch {
        return '';
      }
    })(),
  });

  if (typeof flutterHandler === 'function') {
    const handlerNames = ['openExternalUrl', 'openExternalCheckout', 'openUrl'];

    for (const handlerName of handlerNames) {
      try {
        const handled = await withTimeout(flutterHandler.call(flutterBridge, handlerName, targetUrl));
        recordCheckoutDiagnostic({ status: 'handler-response', handlerName, handled });
        if (handled === false) {
          continue;
        }
        return true;
      } catch (error) {
        recordCheckoutDiagnostic({ status: 'handler-failed', handlerName, message: error?.message || String(error) });
        // Try the next supported APK bridge handler name.
      }
    }
  }

  if (callNativeInterface(targetUrl)) {
    return true;
  }

  if (postToJavascriptChannel(targetUrl)) {
    return true;
  }

  if (hasFlutterInAppWebView || androidWebView) {
    if (tryWindowOpen(targetUrl) || tryAnchorNavigation(targetUrl)) {
      return true;
    }

    recordCheckoutDiagnostic({ status: 'blocked-webview-fallback' });
    throw new Error('PhonePe must open outside the app WebView. Update the APK external checkout bridge.');
  }

  recordCheckoutDiagnostic({ status: 'browser-redirect' });
  globalThis.location.assign(targetUrl);
  return true;
};
