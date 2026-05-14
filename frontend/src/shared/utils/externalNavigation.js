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

const isIosWebView = () => {
  const userAgent = String(globalThis.navigator?.userAgent || '');
  return /iPhone|iPad|iPod/i.test(userAgent) && /AppleWebKit/i.test(userAgent) && !/Safari/i.test(userAgent);
};

const buildCheckoutPayload = (targetUrl) => {
  const androidWebView = isAndroidWebView();
  const iosWebView = isIosWebView();

  return {
    type: 'openExternalUrl',
    action: 'phonepe_checkout',
    url: targetUrl,
    platform: androidWebView ? 'android' : iosWebView ? 'ios' : 'web',
    runtime: androidWebView ? 'android-webview' : iosWebView ? 'ios-webview' : 'browser',
    timestamp: Date.now(),
  };
};

const isHandledBridgeResponse = (value) => {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['ok', 'opened', 'handled', 'success', 'true'].includes(normalized);
  }

  if (value && typeof value === 'object') {
    if (value.handled === true) return true;
    if (value.success === true) return true;
    if (value.opened === true) return true;
    if (value.status && ['ok', 'opened', 'handled', 'success'].includes(String(value.status).trim().toLowerCase())) {
      return true;
    }
  }

  return false;
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

  console.info('[external-checkout]', JSON.stringify(payload));
};

const postToJavascriptChannel = (targetUrl, checkoutPayload) => {
  const channelNames = ['openExternalUrl', 'openExternalCheckout', 'ExternalNavigation', 'AppBridge'];

  for (const channelName of channelNames) {
    const channel = globalThis?.[channelName];

    if (typeof channel?.postMessage === 'function') {
      const attempts = [
        { value: JSON.stringify(checkoutPayload), mode: 'json-string' },
        { value: targetUrl, mode: 'plain-url' },
      ];

      for (const attempt of attempts) {
        try {
          channel.postMessage(attempt.value);
          recordCheckoutDiagnostic({ status: 'channel-posted', channelName, mode: attempt.mode });
          return true;
        } catch (error) {
          recordCheckoutDiagnostic({
            status: 'channel-post-failed',
            channelName,
            mode: attempt.mode,
            message: error?.message || String(error),
          });
        }
      }
    }
  }

  return false;
};

const callNativeInterface = (targetUrl, checkoutPayload) => {
  const bridgeNames = ['Android', 'NativeBridge', 'FlutterBridge', 'AppBridge'];
  const methodNames = ['openExternalUrl', 'openExternalCheckout', 'openUrl'];

  for (const bridgeName of bridgeNames) {
    const bridge = globalThis?.[bridgeName];
    if (!bridge) continue;

    for (const methodName of methodNames) {
      if (typeof bridge?.[methodName] === 'function') {
        const attempts = [
          { args: [JSON.stringify(checkoutPayload)], mode: 'json-string' },
          { args: [checkoutPayload], mode: 'object' },
          { args: [targetUrl], mode: 'plain-url' },
        ];

        for (const attempt of attempts) {
          try {
            bridge[methodName](...attempt.args);
            recordCheckoutDiagnostic({
              status: 'native-interface-called',
              bridgeName,
              methodName,
              mode: attempt.mode,
            });
            return true;
          } catch (error) {
            recordCheckoutDiagnostic({
              status: 'native-interface-failed',
              bridgeName,
              methodName,
              mode: attempt.mode,
              message: error?.message || String(error),
            });
          }
        }
      }
    }
  }

  if (typeof globalThis?.ReactNativeWebView?.postMessage === 'function') {
    globalThis.ReactNativeWebView.postMessage(JSON.stringify(checkoutPayload));
    recordCheckoutDiagnostic({ status: 'react-native-posted' });
    return true;
  }

  if (typeof globalThis?.webkit?.messageHandlers?.openExternalUrl?.postMessage === 'function') {
    globalThis.webkit.messageHandlers.openExternalUrl.postMessage(checkoutPayload);
    recordCheckoutDiagnostic({ status: 'webkit-posted', handlerName: 'openExternalUrl' });
    return true;
  }

  if (typeof globalThis?.webkit?.messageHandlers?.openExternalCheckout?.postMessage === 'function') {
    globalThis.webkit.messageHandlers.openExternalCheckout.postMessage(checkoutPayload);
    recordCheckoutDiagnostic({ status: 'webkit-posted', handlerName: 'openExternalCheckout' });
    return true;
  }

  return false;
};

const redirectInCurrentWindow = (targetUrl, status = 'browser-redirect') => {
  recordCheckoutDiagnostic({ status });
  globalThis.location.href = targetUrl;
  return true;
};

const failInWebView = (reason, extra = {}) => {
  recordCheckoutDiagnostic({
    status: reason,
    ...extra,
  });

  return false;
};

export const openExternalCheckout = async (url) => {
  const targetUrl = String(url || '').trim();
  const checkoutPayload = buildCheckoutPayload(targetUrl);

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
    platform: checkoutPayload.platform,
    runtime: checkoutPayload.runtime,
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
      const attempts = [
        { args: [handlerName, checkoutPayload], mode: 'object' },
        { args: [handlerName, JSON.stringify(checkoutPayload)], mode: 'json-string' },
        { args: [handlerName, targetUrl], mode: 'plain-url' },
      ];

      for (const attempt of attempts) {
        try {
          const handled = await withTimeout(flutterHandler.call(flutterBridge, ...attempt.args));
          recordCheckoutDiagnostic({ status: 'handler-response', handlerName, handled, mode: attempt.mode });
          if (isHandledBridgeResponse(handled)) {
            return true;
          }
        } catch (error) {
          recordCheckoutDiagnostic({
            status: 'handler-failed',
            handlerName,
            mode: attempt.mode,
            message: error?.message || String(error),
          });
          // Try the next supported APK bridge signature or handler name.
        }
      }
    }
  }

  if (callNativeInterface(targetUrl, checkoutPayload)) {
    return true;
  }

  if (postToJavascriptChannel(targetUrl, checkoutPayload)) {
    return true;
  }

  if (hasFlutterInAppWebView || androidWebView) {
    return failInWebView('webview-external-bridge-required', {
      message: 'External checkout bridge did not open PhonePe outside the WebView',
    });
  }

  return redirectInCurrentWindow(targetUrl);
};
