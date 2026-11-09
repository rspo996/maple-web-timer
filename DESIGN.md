---
name: 메이플 재획 알리미
description: An arcade cabinet in daylight for a by-ear hunting alarm. Lilac-white paper, aubergine ink, ember for what needs you now, acid and its olive for what is live, the game screen a dark CRT inset. One light world.
colors:
  paper: "#f8f3fa"
  paper-2: "#efe8f2"
  paper-3: "#e4dce8"
  shade: "#060209"
  screen-ink: "#e8e2ea"
  ink: "#1d0f25"
  ink-2: "#3d2f46"
  muted: "#615569"
  rule: "#d3c9da"
  ember: "#f24700"
  acid: "#d1e200"
  ok-olive: "#456700"
  accent-ink: "#1d0f25"
  warn-text: "#c12100"
  info-teal: "#00728a"
  crt-red: "#f92434"
  crt-cyan: "#00b7c1"
typography:
  display:
    fontFamily: "Black Han Sans, Malgun Gothic, Apple SD Gothic Neo, sans-serif"
    fontSize: "1.728rem"
    fontWeight: 400
    lineHeight: 1.05
  section:
    fontFamily: "Black Han Sans, Malgun Gothic, Apple SD Gothic Neo, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.2
  figure:
    fontFamily: "Silkscreen Tabular, Pretendard, Malgun Gothic, Apple SD Gothic Neo, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1
  status:
    fontFamily: "Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "1.44rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  input: "0px"
  card: "4px"
spacing:
  3xs: "2px"
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
components:
  button:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    height: "34px"
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.card}"
    shadow: "4px 4px 0 {colors.acid}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    height: "34px"
  status-band:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  target-row:
    textColor: "{colors.ink}"
    height: "70px max, collapsed"
  target-row-lit:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.accent-ink}"
  well:
    backgroundColor: "{colors.paper-2}"
    rounded: "{rounded.card}"
  toast:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.status}"
---

# Design: 메이플 재획 알리미

The locked system. Every Hallmark run reads this first. Change it on purpose; the file is the rule. `css/tokens.css` is the source of truth for every value below.

## System
- Genre: playful
- Shape: app screen (one screen, redesigned in full on 2026-11-09)
- Theme: Arcade, colourway ember, screen grille (`arcade: ember/grille`), re-derived on light paper at the owner's request (2026-11-09)
- Axes: light/pixel/chromatic-ember · posture: full-palette

## Overview

**North star: the cabinet menu.** The screen is set up, checked, then hidden. What it shows is what is about to ring. Targets are rows on hairlines like a cabinet's menu; the row that needs you now (expiring, a rune present, re-register needed) is lit ember with dark ink, the way a selected menu line lights. One light world; the game screen is the only dark surface, a CRT inset in the page.

## Colours (four roles, each with one job)
- **Ground:** paper (lilac-white), paper-2 for wells and the status band, paper-3 for hover; each step is darker. Shade is the dark game screen, the gauge trough and the hard shadow of floating layers.
- **Ember (signal):** the one filled primary action, the lit target row, the status band when the connection is lost, the registration banner, the toast, a gauge near its end, a timer figure near its end.
- **Acid (answer):** two tones on light paper. Acid itself (a fill) for the gauge fill, the pressable offset shadow and the crest's clapper; it is 1.3:1 on paper, so never text. Its olive (`--color-ok`) for everything acid says in text or line: the watching state word and the status band's border, timer figures, checkboxes and sliders, the focus ring, link underlines, list markers.
- **Teal (info):** screenshot test mode only.
- **Ink:** aubergine text; muted for secondary text; rule for hairlines only (never a field edge; field edges are muted).
- Hex contract: `--warn-text`, `--alert-bg`, `--muted` and `--accent` stay plain hex aliases in `tokens.css`; `tests/browser/regression.mjs` reads them as strings starting with `#`.

## Type
- **Display:** Black Han Sans 400 (stands in for Bungee, the page is Hangul): the wordmark with a 1.5px red and cyan split, section heads, the status word, the toast, the dialog title.
- **Body and labels:** the system Korean sans (Pretendard, Malgun Gothic, Apple SD Gothic Neo) at 400 and 700. `word-break: keep-all` so Hangul wraps by word.
- **Figures:** Silkscreen Tabular 700 (`fonts/silkscreen-tabular.woff2`, every digit one width, `fonts/OFL-silkscreen.txt`), 40px and up only, digits and colons only, never a word.
- Two weights in use: 400 and 700.

## Layout
- Status band across the top, then three columns from 75rem: the target menu, the manual timers, and a small game screen with the setup guide, sounds and backup under it. While a target is being registered (`#banner.on`) the game screen takes two columns and the timers move under the targets, so the icon can be dragged at size. Two columns from 60 to 75rem (targets and timers wider, the screen narrower), one column below that, with the game screen right under the targets.

## Surfaces
- Sections have no box: a display head over a 2px rule. Target rows sit on 1px hairlines; an open target becomes a paper-2 well. Manual timers are paper-2 wells. Never a box inside a box.
- 4px radius on wells and buttons, square inputs and tags. Depth is a zero-blur offset only: acid 4px on pressables, shade 6px on floating layers. Never a blur, a glow or a gradient on a control.
- The CRT grille sits only on the empty game screen, behind the canvas, never under text.

## Controls
- Primary: ember fill, accent-ink text, 2px ink border, 4px acid offset; hover lifts away from the shadow, active slams into it. One filled primary per screen; extra register buttons in the status band and the manual timer's start button are unfilled.
- Secondary: paper-2 fill, 2px muted border, same 34px height as inputs.
- Disabled: 55% opacity, `cursor: not-allowed`, the native attribute.
- On an ember surface every button is unfilled with an accent-ink border, and the focus ring turns accent-ink.

## Motion
- Character: brisk and state-only. Press physics at 120ms; the alert flash is a stepped ember ring four times; the gauge drains linearly. Nothing decorative moves; under reduced motion everything ends at once.

## Do not
- Do not add a dark theme or a second accent unless the owner asks.
- Do not draw sprites, controllers or game art; no real game assets, logos or the official typeface.
- Do not light a row ember for anything but a state that needs the person now.
- Do not let a `display` rule override `[hidden]`.

## Exports
`css/tokens.css` and `css/base.css` in this project. The small window (`js/pip.js`, `PIP_CSS`) carries a hex copy of the same palette.
