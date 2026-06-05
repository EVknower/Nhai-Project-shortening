// Polyfill global.crypto for Hermes compatibility before any other module loads.
const polyfillCrypto = () => {
  const customCrypto = {};
  const existingCrypto = global.crypto || globalThis.crypto || {};
  
  try {
    Object.assign(customCrypto, existingCrypto);
  } catch (e) {
    // Ignore if not extensible
  }

  const nativeGetRandomValues = existingCrypto.getRandomValues;
  customCrypto.getRandomValues = function (array) {
    if (nativeGetRandomValues) {
      try {
        return nativeGetRandomValues.call(existingCrypto, array);
      } catch (e) {
        // Fallback if native throws
      }
    }
    
    // Fallback: Populate TypedArray with random values based on its element size
    if (array && array.BYTES_PER_ELEMENT) {
      const max = Math.pow(256, array.BYTES_PER_ELEMENT);
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * max);
      }
    } else {
      // Fallback for standard array or when BYTES_PER_ELEMENT is missing
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return array;
  };

  try {
    Object.defineProperty(global, 'crypto', {
      value: customCrypto,
      writable: true,
      configurable: true,
    });
  } catch (e) {
    global.crypto = customCrypto;
  }

  try {
    Object.defineProperty(globalThis, 'crypto', {
      value: customCrypto,
      writable: true,
      configurable: true,
    });
  } catch (e) {
    globalThis.crypto = customCrypto;
  }

  if (typeof self !== 'undefined') {
    try {
      Object.defineProperty(self, 'crypto', {
        value: customCrypto,
        writable: true,
        configurable: true,
      });
    } catch (e) {
      self.crypto = customCrypto;
    }
  }
};

polyfillCrypto();
