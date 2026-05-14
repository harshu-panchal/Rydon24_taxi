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

export const openExternalCheckout = async (url) => {
  const targetUrl = String(url || '').trim();

  if (!targetUrl) {
    return false;
  }

  const flutterHandler = globalThis?.flutter_inappwebview?.callHandler;

  if (typeof flutterHandler === 'function') {
    const handlerNames = ['openExternalUrl', 'openExternalCheckout', 'openUrl'];

    for (const handlerName of handlerNames) {
      try {
        const handled = await withTimeout(flutterHandler(handlerName, targetUrl));
        if (handled === false) {
          continue;
        }
        return true;
      } catch {
        // Try the next supported APK bridge handler name.
      }
    }
  }

  if (globalThis?.flutter_inappwebview || isAndroidWebView()) {
    throw new Error('PhonePe must open outside the app WebView. Update the APK external checkout bridge.');
  }

  globalThis.location.assign(targetUrl);
  return true;
};
