# Design system

Built from the only brand asset we have: the Logisco logo (`public/brand/logisco-logo.png`). Keep the look clean, professional and calm; colour is used for meaning, not decoration.

## 1. Brand colours (taken from the logo)

| Token | Hex | From the logo | Use |
|---|---|---|---|
| `brand-red` | `#BE0000` | LOGISCO wordmark | Primary buttons, active menu item, header accent, logo |
| `brand-green` | `#288A2F` | Leaf | Partner apps’ accent; success |
| `brand-amber` | `#F8BC44` | Location pin, globe | Highlights, warnings, focus rings on dark backgrounds. Never as text on white |
| `ink` | `#151515` | Tagline text | Body text |

### Scales

| Token | 50 | 100 | 500 (base) | 600 | 700 | 900 |
|---|---|---|---|---|---|---|
| red | `#FDECEC` | `#FAD1D1` | `#BE0000` | `#A30000` | `#870000` | `#4D0000` |
| green | `#EAF5EB` | `#CBE7CD` | `#288A2F` | `#217427` | `#1A5E20` | `#0E3612` |
| amber | `#FEF6E6` | `#FDE7B8` | `#F8BC44` | `#E0A21F` | `#B07A0C` | `#5C3F05` |
| gray | `#F7F7F8` | `#EDEDEF` | `#8A8A93` | `#5F5F68` | `#3F3F46` | `#18181B` |

## 2. Each app gets its own accent (same logo everywhere)

| App | Accent | Sidebar / header |
|---|---|---|
| Customer Portal | red | White sidebar, red active item |
| Partner Portal | green | White sidebar, green active item |
| Partner App (mobile) | green | Green top bar, white body |
| Logisco ERP | red on charcoal | Charcoal sidebar `#1F2937`, red active item |
| Launcher | red | White, four app cards each showing its accent |

Implement as a CSS variable `--accent` set on each app’s root element, so components use `var(--accent)` and stay shared.

## 3. Status colours

Red is the brand colour, so **errors must never rely on colour alone**: always pair with an icon and text.

| Meaning | Colour | Example |
|---|---|---|
| Success / delivered / on time | green 600 `#217427` on green 50 | Delivered, Verified, Gold |
| Warning / at risk / amber SLA | amber 700 `#B07A0C` on amber 50 | SLA amber, Expiring soon |
| Danger / breached / failed | `#B42318` on `#FEF3F2` + alert icon | Breached, Undelivered, Rejected |
| Info / in progress | `#1D4ED8` on `#EFF6FF` | In Transit, Under review |
| Neutral / draft | gray 700 on gray 100 | Draft, Booked |

### Shipment status chips (customer status list)

| Status | Style |
|---|---|
| Booked | Neutral |
| Picked Up, At Origin Hub, In Transit, At Destination Hub | Info |
| Out for Delivery | Info (bold) |
| Delivered | Success |
| Delivered with Exception | Warning |
| Undelivered (NDR), Return to Origin | Danger |
| Cancelled | Neutral, strikethrough label |

### Partner tier badges

Platinum `#5F5F68` on `#EDEDEF` with a diamond icon · Gold `#B07A0C` on `#FEF6E6` · Silver `#3F3F46` on `#F7F7F8` · Bronze `#8A4B1F` on `#FBEFE6` · Probation danger style.

## 4. Typography

| Use | Font | Weights |
|---|---|---|
| Headings, KPI numbers, app names | **Montserrat** (matches the logo’s tagline) | 600, 700 |
| Body, tables, forms | **Inter** | 400, 500, 600 |
| Hindi (all text when Hindi is on) | **Noto Sans Devanagari** | 400, 500, 600 |

```css
/* index.html <head> */
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Inter:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap" rel="stylesheet">

:root {
  --font-heading: "Montserrat", "Noto Sans Devanagari", system-ui, sans-serif;
  --font-body: "Inter", "Noto Sans Devanagari", system-ui, sans-serif;
}
```

Sizes (web): page title 24/32, section 18/26, card title 16/24, body 14/20, table 13/18, caption 12/16. Mobile (Partner App): body 16/24 minimum, buttons 16 semibold. Use tabular numbers (`font-variant-numeric: tabular-nums`) for money, weights and timers.

Money format: Indian grouping with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` → ₹1,80,000.00. Dates: `23-Nov-2026`, times 24-hour.

## 5. Layout

| Item | Web apps | Partner App |
|---|---|---|
| Target width | 1280 px and up; usable at 1024 | Phone frame 360 × 760 in the browser; real phone full-screen |
| Header | 56 px | 56 px top bar with duty, sync, SOS |
| Sidebar | 240 px (collapsible to 64) | Bottom tabs, 64 px |
| Spacing scale | 4, 8, 12, 16, 24, 32, 48 | Same |
| Radius | 8 px (cards 12 px) | 12 px; buttons 12 px |
| Touch targets | — | 48 px minimum |
| Shadows | One subtle level for cards and dropdowns | Same |

## 6. Components (shadcn/ui + a few of our own)

Shared from `src/shared/ui/`: Button (primary uses `--accent`), Input, Select, Combobox, DatePicker, Table (sortable, paginated), Tabs, Card, KpiTile, StatusChip, TierBadge, SlaTimer (green → amber → red, ticks every second), Stepper (multi-step forms), Drawer, Dialog, Toast, EmptyState, Skeleton, FileUpload (simulated), PhotoCapture (simulated), Scanner (simulated), MapView (Leaflet), PhoneFrame, DemoToolbar, AiAssistantPanel, LanguageToggle.

## 7. Behaviour that makes it feel real

- Every data load shows a 300–800 ms skeleton (`simulateLatency()` helper).
- Every action ends in a toast (“Booking confirmed — LGS-DEL-000781”).
- Every list has an empty state with a next action.
- Confirm dialogs for destructive or money actions (cancel, RTO, release payout, settle claim).
- Simulated integrations show a short “Verifying with GST…” spinner, then the result.
- A small “Simulated” tag appears on AI outputs and fake integrations only when the demo toolbar’s “Show simulation labels” switch is on.

## 8. Accessibility

White on brand red `#BE0000` and on green `#217427` passes WCAG AA for normal text. Amber is only a background or icon colour, with dark text. All icons that carry meaning have labels; all form fields have visible labels; focus rings are visible (2 px `--accent`).
