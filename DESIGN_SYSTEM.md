# Design System

**Brand:** Forest Green = primary (actions, success) · Sky Blue = secondary (info, AI, maps, analytics) · Sunrise Orange = accent (XP, rewards). Type: Geist Sans/Mono (bundled, no network). 8-pt rhythm. Light + dark via CSS variables (`globals.css`), set before paint to avoid flash.

## Verified contrast (WCAG ratios, computed)

All body/label text pairs ≥ 4.5:1 in both themes (e.g. light text #14201A on #FAFAF7; on-primary #FFF on #1B6B43; muted #4A5A50 on surface-2; dark on-primary #062314 on #4CBA82; accent text #FFA654 on #151D18). Form control borders use `--border-strong` (≥ 3:1). Decorative borders are lighter by design.

## Components (`web/src/components/ui`)
Button/ButtonLink (loading state, 44 px targets), Input/Textarea/Select/Checkbox/ChipGroup (visible labels, `aria-invalid`, described errors), Card, Badge, ProgressBar (transform-based), Avatar, Skeleton/LoadingBlock, EmptyState, ErrorState, Tabs (roving tabindex + arrows), Dialog (focus trap, Esc, focus restore, scroll lock), Toast (aria-live), Tooltip, Table, Stat, PageHeader. Charts: none yet (stats shown as numbers; no fabricated charts).

## Motion language (`lib/motion.ts`)
One strong ease-out `cubic-bezier(.23,1,.32,1)`; press 140 ms, UI 200 ms, page reveal ≤ 280 ms; only transform/opacity; nothing enters from scale(0); stagger ≤ 8 items; page transition scoped to `<main>` so sticky/fixed chrome never moves; global reduced-motion support.

## Layout
Mobile-first, min 320 px (e2e asserts no horizontal overflow on key pages). Portals: sidebar ≥ md, bottom nav below md. Skip-to-content link, visible `:focus-visible` rings everywhere.

## Not yet done
Full screen-reader walkthrough, high-contrast mode testing, Lighthouse a11y score, chart components.
