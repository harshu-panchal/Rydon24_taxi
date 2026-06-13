const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

export const toHistorySafeState = (value) => {
  const seen = new WeakSet();

  const sanitize = (input) => {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === 'function' || typeof input === 'symbol') {
      return undefined;
    }

    if (typeof input === 'bigint') {
      return String(input);
    }

    if (input instanceof Date) {
      return input.toISOString();
    }

    if (Array.isArray(input)) {
      return input
        .map((item) => sanitize(item))
        .filter((item) => item !== undefined);
    }

    if (!isPlainObject(input)) {
      return input;
    }

    if (seen.has(input)) {
      return undefined;
    }

    seen.add(input);

    return Object.entries(input).reduce((accumulator, [key, item]) => {
      const sanitizedValue = sanitize(item);

      if (sanitizedValue !== undefined) {
        accumulator[key] = sanitizedValue;
      }

      return accumulator;
    }, {});
  };

  return sanitize(value);
};
