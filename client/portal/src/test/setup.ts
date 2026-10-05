// Shared test setup: runs before every test file.
// - Registers Testing Library's jest-dom matchers (toBeInTheDocument, etc.)
// - Cleans up the DOM between tests so rendered components never leak
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom does not implement ResizeObserver; Radix UI components (e.g. Tooltip)
// require it. Stub with a no-op observer so component tests run unaffected.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver;
}

afterEach(() => {
  cleanup();
});
