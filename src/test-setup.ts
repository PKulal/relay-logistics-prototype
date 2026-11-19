// Uses Vitest globals (expect) rather than `import … from 'vitest'`: on Windows a
// lowercase drive letter (c:\) can make an explicit import resolve to a second
// copy of Vitest and break every suite. React Testing Library registers its own
// afterEach cleanup when globals are on.
import * as matchers from '@testing-library/jest-dom/matchers'
import '@shared/i18n'

expect.extend(matchers)

// jsdom has no ResizeObserver; Radix UI (checkbox, toggle group, …) needs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// jsdom has no element scrolling; the portal shell scrolls its content pane on navigation.
Element.prototype.scrollTo ??= function scrollTo() {}
Element.prototype.scrollIntoView ??= function scrollIntoView() {}
