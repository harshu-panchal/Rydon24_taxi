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
        await flutterHandler(handlerName, targetUrl);
        return true;
      } catch {
        // Try the next supported APK bridge handler name.
      }
    }
  }

  globalThis.location.assign(targetUrl);
  return true;
};
