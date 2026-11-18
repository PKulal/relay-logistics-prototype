// Uses Vitest globals (expect) rather than `import … from 'vitest'`: on Windows a
// lowercase drive letter (c:\) can make an explicit import resolve to a second
// copy of Vitest and break every suite. React Testing Library registers its own
// afterEach cleanup when globals are on.
import * as matchers from '@testing-library/jest-dom/matchers'
import './shared/i18n'

expect.extend(matchers)
