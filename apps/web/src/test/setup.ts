import "@testing-library/jest-dom/vitest";

if (
  typeof Element !== "undefined" &&
  !("scrollIntoView" in Element.prototype)
) {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value() {
      return undefined;
    },
  });
}

if (
  typeof Element !== "undefined" &&
  !("hasPointerCapture" in Element.prototype)
) {
  Object.defineProperty(Element.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
}

if (
  typeof Element !== "undefined" &&
  !("setPointerCapture" in Element.prototype)
) {
  Object.defineProperty(Element.prototype, "setPointerCapture", {
    configurable: true,
    value() {
      return undefined;
    },
  });
}

if (
  typeof Element !== "undefined" &&
  !("releasePointerCapture" in Element.prototype)
) {
  Object.defineProperty(Element.prototype, "releasePointerCapture", {
    configurable: true,
    value() {
      return undefined;
    },
  });
}

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverPolyfill {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: ResizeObserverPolyfill,
  });
}
