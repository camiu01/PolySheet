---
name: PolySheet
description: The supplied Contemporary Grimoire direction, adapted to a local character archive.
colors:
  bg: "#111417"
  surface: "#191c20"
  surface-soft: "#1d2024"
  sidebar: "#0b0e12"
  ink: "#e1e2e8"
  muted: "#b5afa5"
  line: "#323539"
  accent: "#e4c284"
  accent-soft: "#2d281f"
  on-accent: "#261900"
  success: "#a3d1b7"
  info: "#a5cce4"
  danger: "#ffb4ab"
  light-bg: "#f6f4ee"
  light-surface: "#fffefb"
  light-surface-soft: "#ede8de"
  light-ink: "#1e2124"
  light-muted: "#68635b"
  light-line: "#d5cebf"
  light-accent: "#745a27"
typography:
  display:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "44px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  display-mobile:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "36px"
    fontWeight: 500
  body:
    fontFamily: "Plus Jakarta Sans, Segoe UI, sans-serif"
    fontWeight: 400
  numbers:
    fontFamily: "Space Mono, Consolas, monospace"
  button:
    fontFamily: "Space Mono, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.025em"
rounded:
  control: "4px"
  badge: "2px"
  dialog: "8px"
spacing:
  compact: "8px"
  related: "12px"
  gutter: "16px"
  panel: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
    typography: "{typography.button}"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
---

# Design system: PolySheet

## Overview

**Creative North Star: "Contemporary Grimoire"**

Use the user's supplied charcoal/brass archive, with literary headings and
precise controls. Preserve PolySheet's real local tasks and imported source
content. Dark is the default; an existing saved light preference stays light.

The reference supplies the visual direction, not fictional sync, accounts,
storage quotas, game statistics or capabilities. Keep those out. The later user
request overrides phone bottom sheets: every dialog stays centered.

**Key Characteristics:**
- Charcoal surfaces and thin keylines.
- Garamond headings, Jakarta body, monospaced data and compact controls.
- Brass actions, sage success and sapphire metadata.
- Real character entries, without stock portraits or fabricated rules.

## Colors

`src/styles.css` owns runtime tokens. Frontmatter records the implemented
values, not the conflicting alternative palette values inside the reference ZIP.

Brass `accent` marks actions, focus and active navigation. `ink` and `muted`
carry reading hierarchy; `line` separates neutral surfaces. `success`, `info`
and `danger` communicate status, not decoration. The light theme uses stone
surfaces and darker brass, sage and sapphire for readable foregrounds.
Light success is `#2f6650`, info `#245d7a`, danger `#9a302b`.

## Typography

Self-host EB Garamond, Plus Jakarta Sans and Space Mono from `public/fonts/`.
Keep the OFL files and precache all four WOFF2 assets. No runtime font requests.

Page headings are 44px/500, 36px on phones. Character headings are 26px, or
32px in the recent entry, reducing to 28px on phones. Most form labels are
13px and source body text 14px; preserve imported text hierarchy. Page
descriptions stop at 68ch. Numeric results use Space Mono and tabular figures.
Do not add decorative labels above headings.

## Layout

Desktop uses a persistent 248px sidebar, 220px at widths up to 1100px. The main
container stops at 1440px. At 760px and below, navigation becomes a drawer plus
fixed character/system/dice shortcuts and **Altro**. Main bottom padding includes
the bar and safe-area inset.

The roster starts with the latest updated character, then smaller entries.
Search and system filters use actual stored records. Sheet content has a 292px
aside until 1200px, then stacks. Dialogs use fixed insets and auto margins on
both device sizes, bounded height and internal scrolling.

## Elevation & Depth

Resting cards use flat tonal layers and 1px keylines, without hover lift.
Dialogs use `0 4px 24px #0007`; their black backdrop has no decorative blur.
Active navigation uses an inset brass keyline, not a floating shadow.
State transitions are brief: 150–200ms. Reduced motion disables transitions
and animations; the default content remains visible.

## Shapes

Controls and panels have 4px corners, badges 2px, dialogs 8px.
Keep the geometry compact. Do not introduce glossy capsules or faux parchment.

## Components

### Buttons and fields

Primary buttons are brass with `on-accent` text. Secondary buttons are neutral
with a keyline; hover shifts the border to brass. Destructive actions use an
outlined danger treatment. Buttons and ordinary inputs have 44px minimum
targets. Inputs use the lowest surface and full-opacity muted placeholders.
Focus is an explicit accent outline, never color alone. Disabled controls fade.

### Cards and navigation

Character entries use source-independent initials. Uploaded photos remain in
their source sheet views rather than becoming fictional roster portraits.
Metadata identifies the real system/version and compatibility state. Cards
open the sheet and retain visible action text. The recent label describes real
recency, not an invented active session.

Navigation retains every existing destination. Mobile shortcuts do not replace
the complete drawer. Remove the requested fake workspace selector, top-right
profile/status group, sidebar version footer and privacy promotion panels.
Keep install, settings and backup actions. Save status remains screen-reader-only.

### Dialogs

Use native dialogs for focus trapping and Escape. Keep source titles,
validation, Save/Cancel and busy dismissal protection. The source's bottom-sheet
variant shares the centered placement required by the user.

## Do's and Don'ts

### Do:
- Do preserve Italian controls and unchanged imported labels.
- Do keep diagnostics visible and distinguish manual assignment from automation.
- Do use the supplied fonts, charcoal surfaces and brass actions in both layouts.
- Do keep dialogs centered on phones as well as desktop.

### Don't:
- Don't add fake sync, profiles, quotas, game statistics or version claims.
- Don't fetch fonts, portraits or game imagery at runtime.
- Don't hide unsupported source rules to imply complete compatibility.
- Don't replace source calculations with decorative values.
