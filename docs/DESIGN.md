# Forkbot Design System

## Brand

| | |
|---|---|
| **Name** | Forkbot |
| **Tagline** | Isolated memory for every PR |
| **Personality** | Precise, trustworthy, developer-first — no fluff |
| **Voice** | Direct and technical. Avoids marketing adjectives. |

---

## Logo

`apps/web/src/design-system/Logo.tsx`

The Forkbot mark is a git fork SVG with coloured nodes mapping to git's ANSI terminal branch colour cycle:

| Node / Path | Colour | Git meaning |
|---|---|---|
| Origin (top) | Crimson `#9F1239` | git red — first commit |
| Stem | Slate `#475569` | git grey — trunk |
| Branch 1 path | Amber `#f59e0b` | git yellow — feature branch |
| Branch 1 tip | Green `#22c55e` | git green — merged |
| Branch 2 path | Sky `#0ea5e9` | git blue — second branch |
| Branch 2 tip | Purple `#a855f7` | git magenta — unmerged |
| Main tip (bottom) | Sky `#0ea5e9` | git blue — main/HEAD |

### Usage

```tsx
import { Logo, LogoMark } from '@/design-system';

// Nav / favicon
<Logo variant="mark" size={32} />

// Hero / large display
<Logo variant="full" size={200} />

// Branch colour legend dots
<ForkColorLegend />
```

### Rules

- Never change the node/branch colours independently — they form the git colour mapping
- Minimum size: 20px for mark, 120px for full
- On dark backgrounds only (the design system is dark-first)

---

## Colour Palette

`apps/web/src/design-system/tokens.ts` → `branchColors` / `neutrals`

### Git Branch Palette

| Token | Hex | Tailwind | Use |
|---|---|---|---|
| `forkbot-crimson` | `#9F1239` | `text-forkbot-crimson` | Primary brand, CTAs, danger |
| `forkbot-amber` | `#f59e0b` | `text-forkbot-amber` | Warnings, feature branches |
| `forkbot-sky` | `#0ea5e9` | `text-forkbot-sky` | Info, links, focus rings, main branch |
| `forkbot-green` | `#22c55e` | `text-forkbot-green` | Success, merged, healthy |
| `forkbot-purple` | `#a855f7` | `text-forkbot-purple` | Secondary branches, code annotations |
| `forkbot-slate` | `#475569` | `text-forkbot-slate` | Graph stems, secondary muted UI |

### Neutral Scale (dark-first, zinc-derived)

| Token | Hex | Role |
|---|---|---|
| `zinc-950` | `#09090b` | Page background |
| `zinc-900` | `#18181b` | Cards / panels |
| `zinc-800` | `#27272a` | Elevated surface / inputs |
| `zinc-700` | `#3f3f46` | Borders |
| `zinc-500` | `#71717a` | Muted text |
| `zinc-400` | `#a1a1aa` | Subtle text |
| `zinc-200` | `#e4e4e7` | Body text |
| `zinc-50` | `#fafafa` | Headings, high-contrast |

### Semantic

| Intent | Value |
|---|---|
| Success | `forkbot-green` |
| Error | `#f87171` |
| Warning | `forkbot-amber` |
| Info | `forkbot-sky` |

---

## Typography

| Role | Font | Weight |
|---|---|---|
| Headings | Space Grotesk | 600–700 |
| Body | Inter | 400–500 |
| Code / mono | JetBrains Mono | 400–500 |

### Tailwind classes

```html
<!-- Headings -->
<h1 class="font-heading font-bold tracking-tight text-balance">

<!-- Body -->
<p class="font-body text-zinc-400">

<!-- Code -->
<code class="font-mono text-xs">
```

### Rules

- `text-wrap: balance` on all headings (Tailwind: `text-balance`)
- `text-wrap: pretty` on body paragraphs
- `font-synthesis: none` globally (prevents browser faking bold/italic)
- `font-feature-settings: "zero" 1` on mono (slashed zero)
- `font-variant-numeric: tabular-nums` on numeric data

---

## Spacing

4px grid. Use Tailwind default spacing scale (4px = `1`, 8px = `2`, etc.)

---

## Border Radius

`tokens.ts` → `radius`

| Token | Value | Use |
|---|---|---|
| `xs` | 4px | Small chips, kbd |
| `sm` | 8px | Inputs, small buttons |
| `md` | 12px | Buttons, badges |
| `lg` | 16px | Cards |
| `xl` | 20px | Large cards |
| `2xl` | 24px | Panels, modals |
| `3xl` | 32px | Hero sections |
| `full` | 9999px | Pill badges, avatars |

Inner radius = outer radius − padding (concentric radius rule).

---

## Shadows

Dark-first elevation. Shadows are heavy to read on dark backgrounds.

| Token | Use |
|---|---|
| `shadow-xs` | Subtle lift |
| `shadow-sm` | Cards at rest |
| `shadow-md` | Hovered cards |
| `shadow-lg` | Modals, dropdowns |
| `shadow-xl` | High-elevation overlays |

Animate shadows via `::after` pseudo-element, not `box-shadow` directly (`shadow-anim` utility class).

---

## Motion

`tokens.ts` → `motion`

| Token | Duration | Use |
|---|---|---|
| `fast` | 120ms | Hover / press |
| `base` | 200ms | State changes |
| `slow` | 280ms | Page transitions |

All durations under 300ms. Entrances use ease-out; exits use ease-in. Springs for interruptible drags.

Always check `prefers-reduced-motion` before animating:

```ts
// GSAP
gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => { ... });

// CSS
@media (prefers-reduced-motion: no-preference) { ... }
```

---

## Sound

`apps/web/src/design-system/sound.ts`

| Function | Use |
|---|---|
| `playClick()` | Destructive / significant button press |
| `playSuccess()` | Form submit, onboarding complete |
| `playNavigate()` | Sidebar navigation |
| `playError()` | Validation error |

Rules:
- Sound only on confirmations, not hover or decoration
- Respects `prefers-reduced-motion` (auto-mutes)
- User toggle stored in localStorage (`forkbot-sound`)
- Default: on

---

## Components

All in `apps/web/src/design-system/components/`

| Component | File | Props |
|---|---|---|
| `Button` | `Button.tsx` | `variant`, `size`, `loading`, `iconLeft`, `iconRight`, `sound` |
| `Badge` | `Badge.tsx` | `variant` (status), `size`, `dot` |
| `SeverityBadge` | `Badge.tsx` | `severity`, `size` |
| `Card` | `Card.tsx` | `hover`, `glow`, `onClick` |
| `Card.Header` | `Card.tsx` | `title`, `subtitle`, `action` |
| `Card.Body` | `Card.tsx` | `noPad` |
| `Card.Footer` | `Card.tsx` | — |
| `Input` | `Input.tsx` | `label`, `error`, `hint`, `iconLeft`, `iconRight` |
| `Textarea` | `Input.tsx` | `label`, `error`, `hint` |
| `Select` | `Input.tsx` | `label`, `error`, `hint` |
| `FormGroup` | `Input.tsx` | `label`, `htmlFor`, `error`, `hint` |
| `Panel` | `Panel.tsx` | `title`, `subtitle`, `action`, `noPad` |
| `Empty` | `Empty.tsx` | `icon`, `title`, `message`, `action` |
| `StatusDot` | `StatusDot.tsx` | `status`, `size`, `label` |

### Button variants

| Variant | Look | Use |
|---|---|---|
| `primary` | Sky fill | Primary non-destructive action |
| `secondary` | Zinc-800 with border | Secondary / neutral |
| `ghost` | Transparent | Inline / low-priority |
| `brand` | Crimson fill | Main CTAs |
| `danger` | Red-tinted | Destructive actions |

### Badge status variants

`completed` · `running` · `failed` · `queued` · `pending`

### SeverityBadge

`critical` · `high` · `medium` · `low` · `info`

---

## Barrel Import

```ts
import { Button, Badge, Card, Panel, Empty, StatusDot } from '@/design-system';
import { Logo, ForkColorLegend } from '@/design-system';
import { tokens } from '@/design-system';
import { playClick, playSuccess } from '@/design-system';
```

---

## Dark-First Principle

The UI is always dark. There is no light mode toggle. All colour tokens are dark-optimised:
- Backgrounds: zinc-950 / zinc-900 / zinc-800
- Text: zinc-200 (body), zinc-50 (headings), zinc-500 (muted)
- Borders: zinc-800 (default), zinc-700 (hover)

Do not add a light theme without redesigning the entire palette.
