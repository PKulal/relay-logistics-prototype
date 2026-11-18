import { createPortal } from 'react-dom'

/**
 * Content that exists only on paper (quotes, labels, LR). Rendered straight into
 * <body> so the print stylesheet can hide everything else with `display: none`
 * (see index.css), whatever the app layout looks like.
 */
export function PrintArea({ children }: { children: React.ReactNode }) {
  return createPortal(<div className="print-root hidden bg-white text-ink print:block">{children}</div>, document.body)
}
