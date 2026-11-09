---
name: 메이플 재획 알리미
description: A 2D fantasy MMO game-window world for a by-ear hunting alarm, light (sky and wood) and dark (navy and gold), following the OS setting.
colors:
  sky: "#a7dbf5"
  sky-pale: "#e3f4fc"
  parchment: "#fffaf0"
  well-cream: "#f7ecd9"
  well-line: "#e3cfae"
  field-white: "#ffffff"
  field-line: "#cfb48b"
  bark-ink: "#3b2814"
  bark-muted: "#7a5f45"
  rim-umber: "#5c3a1a"
  frame-wood: "#c98d4f"
  frame-wood-hi: "#efc58f"
  bar-ember: "#e8791f"
  bar-ember-hi: "#ffad55"
  bar-ember-edge: "#9c4e12"
  bar-outline: "#6e3207"
  bar-sub: "#4a2406"
  shut-wood: "#a8713c"
  shut-wood-hi: "#d09a5c"
  shut-wood-edge: "#6e4419"
  shut-sub: "#1f0e02"
  button-cream: "#fff6e6"
  button-edge: "#c99d68"
  accent-gold: "#ffc53d"
  accent-gold-hi: "#ffe390"
  accent-gold-edge: "#b9780f"
  accent-ink: "#3b2208"
  control-orange: "#d9741a"
  slot-rim: "#3d2611"
  link-blue: "#1f5fae"
  ok-green: "#23803a"
  ok-fill: "#46bd5a"
  ok-num: "#3fbf58"
  ok-outline: "#123d1c"
  warn-red: "#d63c2b"
  warn-text: "#b52f22"
  warn-num: "#f0503a"
  warn-outline: "#4f0d06"
  info-blue: "#2a6fc9"
  flash-butter: "#ffe6a3"
  alert-red: "#c8321f"
  selection-gold: "#ffd88a"
  focus-blue: "#2a6fc9"
  gauge-trough: "#3d2a17"
  gauge-fill-hi: "#9bd8ff"
  gauge-fill: "#3b9cf0"
  gauge-fill-lo: "#1f6cc4"
  gauge-low-hi: "#ffb0a3"
  gauge-low: "#ea4a33"
  gauge-low-lo: "#b3271a"
  timer-orange: "#ff9a1f"
  timer-outline: "#5e2d06"
  gem-off: "#a58e74"
  stage-black: "#05070d"
  night-navy: "#0c1430"
  night-navy-2: "#121d40"
  night-panel: "#1a2547"
  night-well: "#121b38"
  night-ink: "#e9eefc"
  night-muted: "#a3b2d6"
  night-rim: "#050916"
  night-frame: "#30498a"
  night-frame-hi: "#7f9be0"
  night-bar: "#2c4385"
  night-bar-hi: "#3b569c"
  night-title-gold: "#ffd666"
  night-shut: "#16203f"
  night-shut-hi: "#212f5a"
  night-shut-sub: "#b9c6e6"
  night-button: "#243360"
  night-button-edge: "#405594"
  night-accent-gold: "#ffc23d"
  night-control: "#ffb02e"
  night-link: "#8fc0ff"
  night-ok: "#5fd37a"
  night-warn-text: "#ff8173"
  night-info: "#6aa8ff"
  night-gauge-fill: "#4aa6ff"
  night-timer-gold: "#ffc23d"
typography:
  display:
    fontFamily: "Jua Tabular, Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.01em"
  numeral:
    fontFamily: "Jua Tabular, Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0.02em"
  status:
    fontFamily: "Jua Tabular, Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.2
  state:
    fontFamily: "Jua Tabular, Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "Jua Tabular, Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0.01em"
  slot-name:
    fontFamily: "Jua Tabular, Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.1
  chip:
    fontFamily: "Jua Tabular, Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  prose:
    fontFamily: "Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  code: "5px"
  field: "7px"
  slot: "8px"
  button: "9px"
  inner: "10px"
  well: "11px"
  window: "15px"
  toast: "16px"
  pill: "999px"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "16px"
  xxl: "20px"
components:
  button:
    backgroundColor: "{colors.button-cream}"
    textColor: "{colors.bark-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "5px 12px 6px"
  button-primary:
    backgroundColor: "{colors.accent-gold}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.button}"
    padding: "7px 16px 8px"
  button-chip:
    backgroundColor: "{colors.button-cream}"
    textColor: "{colors.bark-ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "3px 13px 4px"
  input:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.bark-ink}"
    rounded: "{rounded.field}"
    padding: "4px 8px"
  window:
    backgroundColor: "{colors.frame-wood}"
    rounded: "{rounded.window}"
    padding: "4px"
  window-title-bar:
    backgroundColor: "{colors.bar-ember}"
    textColor: "{colors.field-white}"
    typography: "{typography.title}"
    padding: "6px 14px 7px"
  window-title-bar-shut:
    backgroundColor: "{colors.shut-wood}"
    textColor: "{colors.field-white}"
    typography: "{typography.title}"
  window-body:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.bark-ink}"
    padding: "14px"
  slot-well:
    backgroundColor: "{colors.well-cream}"
    rounded: "{rounded.well}"
    padding: "10px 12px"
  buff-slot:
    backgroundColor: "{colors.stage-black}"
    rounded: "{rounded.slot}"
    size: "38px"
  gauge:
    backgroundColor: "{colors.gauge-trough}"
    rounded: "{rounded.pill}"
    height: "9px"
  status-window:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.bark-ink}"
    rounded: "{rounded.window}"
    padding: "12px 20px"
  toast:
    backgroundColor: "{colors.alert-red}"
    textColor: "{colors.field-white}"
    typography: "{typography.state}"
    rounded: "{rounded.toast}"
    padding: "12px 24px"
---

# Design System: 메이플 재획 알리미

## Overview

**Creative North Star: "The Buff Bar"**

The app is a set of game windows floating over a sky. Each section is a framed window: a dark outer rim, a wooden (by day) or navy (by night) frame with a bright inner bevel, a glossy title bar, and a warm body. The one signature device is the buff slot plus gauge: a target's icon sits in a beveled slot, and when its full length is known, a pill gauge drains under it and turns red near the end. Titles, status words and every number use one chunky rounded face with outlined, drop-stamped numerals, the way game UIs print damage and timers.

The world arrives only through type, color, density and that one device; the controls themselves stay standard (native buttons, checkboxes, range sliders, `<details>`, `<dialog>`). The screen is an Operate surface: people set things up, confirm "감시 중" in the status window, then hide the tab and listen. Nothing animates for decoration; the only motion is state (gem beat, card flash, gauge drain, chevron turn), and all of it honors reduced motion.

Light and dark are two full worlds, not an inverted palette: light is the older-game look (sky, wood, ember title bars, brown ink), dark is the newer-game look (deep navy, navy frames with a pale blue inner line, gold title lettering). Both follow `prefers-color-scheme`; there is no manual toggle. This is an original design that evokes the genre. It uses no real game assets, logos, characters, UI sprites, or the official game typeface.

**Key Characteristics:**
- Framed game windows: rim, frame with inner bevel, title bar, body.
- Buff slot plus draining gauge as the single signature device.
- Jua Tabular for titles, states, numerals and chips; system Korean sans for body.
- Outlined, drop-stamped numerals and title lettering.
- Two complete tonal worlds (sky/wood, navy/gold) chosen by the OS.
- Standard controls, chunky inner-bevel buttons.

## Colors

A bright, saturated game palette: warm wood and ember against sky by day, navy and gold by night, with green, red and blue reserved for state.

### Primary
- **Ember Title Bar** (bar-ember, over bar-ember-hi): the glossy gradient on every open window's title bar and the import dialog header. In dark it becomes **Night Bar** (night-bar over night-bar-hi) with **Title Gold** lettering.
- **Coin Gold** (accent-gold, with accent-gold-hi and accent-gold-edge): the primary button only (`게임 화면 연결`), with dark **Accent Ink** text. It is the single filled call to action.

### Secondary
- **Frame Wood** (frame-wood, frame-wood-hi inner line) and **Umber Rim** (rim-umber): the window frame and its outer stroke; the rim also outlines slots, gauges and the status gem. Dark: night-frame, night-frame-hi, night-rim.
- **Shut Wood** (shut-wood over shut-wood-hi, shut-wood-edge): the title bar of a collapsed window. Dark: night-shut.
- **Control Orange** (control-orange; dark night-control): accent-color for checkboxes, radios and sliders, caret, list markers, disclosure chevron in the manual timer.

### Tertiary (state)
- **Leaf Green** (ok-green text, ok-fill gem and tint, ok-num outlined numerals): running, found, watching.
- **Alarm Red** (warn-red, warn-text, warn-num, alert-red): problems, alerts, the toast. Text uses warn-text, never warn-red.
- **Signal Blue** (info-blue): test mode.
- **Sky Gauge** (gauge-fill-hi to gauge-fill to gauge-fill-lo over gauge-trough); low state swaps to gauge-low-hi / gauge-low / gauge-low-lo.
- **Timer Orange** (timer-orange with timer-outline; dark night-timer-gold): the big manual-timer numerals.

### Neutral
- **Sky** (sky fading to sky-pale over 560px): page background. Dark: night-navy to night-navy-2.
- **Parchment** (parchment): window bodies, status window. Dark: night-panel.
- **Cream Well** (well-cream, well-line): inset rows, menus, fieldsets. Dark: night-well.
- **Bark Ink** (bark-ink) and **Bark Muted** (bark-muted): text and secondary text. Dark: night-ink, night-muted.
- **Stage Black** (stage-black): the game preview and empty buff slots, the same in both tones.

### Named Rules
**The Hex Contract Rule.** warn-text, alert-bg, muted and accent stay plain hex custom properties (`--warn-text`, `--alert-bg`, `--muted`, `--accent`); a regression test reads them as strings starting with `#`.

**The Two Worlds Rule.** Every color token has a light and a dark value in the same `:root`/`@media (prefers-color-scheme: dark)` pair. Never add a color that exists in one tone only.

**The State Color Rule.** Green, red and blue mean ok, alert and test. Do not use them for decoration.

## Typography

**Display Font:** Jua Tabular (with Pretendard, Malgun Gothic, Apple SD Gothic Neo, system-ui). A modified Jua (SIL OFL 1.1, `fonts/OFL.txt`) whose digits 0-9 are equalized to width 628, shipped locally as `fonts/jua-tabular.woff2`.
**Body Font:** System Korean sans (Pretendard if installed, Malgun Gothic, Apple SD Gothic Neo, system-ui).

**Character:** Jua is round, soft and heavy without weight changes, so it carries the game voice at weight 400; the plain system sans keeps instructions and settings readable.

### Hierarchy
- **Display** (400, 32px, 1.1; 26px under 560px): the wordmark only, white with an umber outline (dark: gold with near-black outline).
- **Numeral** (400, 34px, 1.15, +0.02em): manual-timer remaining time, outlined and drop-stamped.
- **Status** (400, 26px, 1.2): the open card's state line; outlined green when on, outlined red on alert.
- **State** (400, 23px, 1.2): the status window's state word; also the toast at 22px.
- **Title** (400, 20px, 1.25): window title bars, outlined.
- **Slot name** (400, 18px, 1.1): target name next to its slot; the one-line mini state below it is 15px Jua.
- **Chip** (400, 16px, 1.3): duration chips, the add button, group legends.
- **Body** (400, 15px, 1.5): default text.
- **Prose** (400, 14px, 1.65, max 78ch): the setup manual.
- **Label** (400, 13px, 1.35): small buttons, sub-labels, grids, hints.

### Named Rules
**The One Weight Rule.** Jua is set at 400 everywhere; emphasis comes from size, color and outline, never a faux bold.

**The Tabular Digits Rule.** Every changing number is set in Jua Tabular so its width does not jitter as it counts down.

**The Outline Stamp Rule.** Outlined lettering (eight 1-2px text-shadows plus a 2.5-4px drop below) is for title bars, the wordmark, on/alert status numbers and timer numerals only. Body text is never outlined.

## Layout

A centered column, max 1500px, 20px side padding (16px under 560px). The masthead puts the wordmark left and the tools right (connect, secondary buttons, a pill-shaped sound box). Below it the status window spans the full width. The body is a two-column grid: a flexible left column (game window, then manual, sounds, backup) and a fixed 404px right column (targets, then manual timer), 16px gap. Under 980px the columns collapse to one in the order stage, targets, manual timer, manual, sounds.

Spacing follows a small step set (4, 6, 8, 10, 14, 16, 20px): 8px between target rows, 14px window-body padding (12px on narrow screens), 16px between windows. Density is moderate; a collapsed target row stays one line and at most 70px tall (a browser test checks this). Manual timers tile in an auto-fill grid with a 250px minimum.

## Elevation & Depth

Depth is game-UI bevel, not floating material. Windows and controls carry inset highlights and shades (a top light line, a bottom shade) and one soft, short drop beneath; rows inside windows are sunk as wells. There is no hard offset shadow.

### Shadow Vocabulary
- **Window** (`box-shadow: inset 0 0 0 1px var(--frame-hi), 0 12px 26px -16px var(--shadow)`): every window; the status window adds an inset 4px frame ring and 1px highlight instead of padding.
- **Button bevel** (`box-shadow: inset 0 -2px 0 var(--btn-shade), inset 0 1px 0 var(--btn-hi)`): pressed flips to `inset 0 2px 3px var(--btn-shade)` with a 1px drop.
- **Primary bevel** (`box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--accent-edge) 60%, transparent), inset 0 1px 0 rgba(255,255,255,.6)`).
- **Well** (`box-shadow: inset 0 2px 3px -1px var(--well-shade)`): target rows, add menu, fields (2px variant).
- **Floating** (`box-shadow: 0 14px 30px -10px rgba(0,0,0,.5)` toast; `0 24px 50px -14px rgba(0,0,0,.55)` dialog).

### Named Rules
**The Sunk Rows Rule.** Target rows are inset wells inside a window, never raised cards. Only windows, buttons and floating layers rise.

## Shapes

Everything is rounded and chunky. Windows 15px outside with 10px inner corners; wells 11px; buttons 9px; buff slots 8px; fields 7px; chips, the sound box and gauges are full pills (999px). Strokes are thick for the size (1.5-2px), and a dark rim outlines anything that should read as a game object: windows, slots, gauges, the status gem. The status gem is a 20px circle with a radial highlight and a lower shade. The disclosure chevron is one SVG mask (`--chev`) tinted by background color, rotated 180deg when open.

## Components

### Buttons
Chunky and pressable.
- **Shape:** gently rounded (9px), 1.5px edge.
- **Default:** button-cream with button-edge stroke and bark-ink text, 14px, padding 5px 12px 6px; small variants 13px with 3px 10px 4px.
- **Primary:** Coin Gold gradient (accent-gold-hi to accent-gold at 62%) over a solid accent-gold background-color, accent-gold-edge stroke, accent-ink 700 text. Reserved for the one main action.
- **Hover / Active:** hover darkens the edge to the rim and brightens 5%; active drops 1px and inverts the bevel. Motion is 120ms `cubic-bezier(.16,1,.3,1)`. Disabled is 45% opacity with no hover change.
- **Chip:** full pill, Jua 16px, used for duration presets.
- **Add:** dashed edge, transparent, Jua 16px; hover fills with the well color.

### Cards / Containers (Windows)
- **Corner Style:** 15px outer, 10px inner.
- **Structure:** 2px rim, 4px frame padding, inner frame-hi line, title bar with a 1.5px edge and 2px bottom, parchment body at 14px padding.
- **Collapsible windows:** a `<details>` whose summary is the title bar. Collapsed uses the Shut Wood bar (rounded all round), with sub-labels in shut-sub; only open windows get the title-bar color. Chevron at the right end.
- **Dialog:** the same window build on `<dialog>`, header in the title-bar gradient, backdrop `rgba(10,14,30,.5)`.

### Inputs / Fields
- **Style:** field-white with 1.5px field-line, 7px radius, inner top shade, orange caret.
- **Focus:** 3px focus-blue outline at 1px offset and a focus-blue border. Global focus-visible is a 3px outline at 2px offset.
- **Checkbox / radio / range:** native, tinted with Control Orange.

### Status Window (signature)
Full-width parchment window with the frame drawn as inset rings so the state tint fills edge to edge. State classes tint the body: on mixes 13% ok-fill, test 12% info, bad 16% warn. The gem takes the state color and beats (a 0 to 9px ring, 600ms) on each check. JS rewrites its class list to `watch <state>`, so style it only through the base class and its state classes.

### Buff Slot Row + Gauge (signature)
A well row: a 38px beveled slot on the left (stage-black, 2px slot-rim, pixelated image), name in Jua 18px, a one-line mini state in Jua 15px below, the use switch and toggle on the right. An unregistered slot is a dashed outline. Under the row a pill gauge (9px open, 8px collapsed) with a rim stroke, a sky gradient fill scaled by remaining fraction, a 2px white gloss line, and a red fill in the low state. Transform transitions 500ms linear, off under reduced motion. Matching rows flash flash-butter four times on alert.

### Manual Timer
Tiles in the manual timer window: Jua 17px name, Jua 34px outlined Timer Orange numerals, the same gauge, small buttons.

### Toast and Undo
Toast: alert-red pill-cornered (16px) banner at bottom center, 2.5px dark red border, Jua 22px. Undo bar: small parchment window at bottom left with an inset 3px frame ring.

### Mini Window (Picture-in-Picture)
A reduced copy of the tokens: a title-bar strip in the bar color with outlined Jua 16px, rows in body sans with Jua 15px times, ok/warn state colors, and full-row fills (gold, red, blue, striped gray) that blink at 1s for alerts.

## Do's and Don'ts

### Do:
- **Do** build every new section as a window: rim, frame with inner highlight, title bar, parchment body (15px outer radius, 4px frame).
- **Do** give every new color both a light and a dark value, and keep warn-text, alert-bg, muted and accent as plain hex.
- **Do** set titles, states, chips and every counting number in Jua Tabular at 400.
- **Do** draw a gauge only when the full length is known (a buff with a known duration, a manual timer).
- **Do** put rows inside windows as inset wells with the well shadow.
- **Do** keep the collapsed target row at one line and no more than 70px.
- **Do** keep motion tied to state and switch it off under `prefers-reduced-motion`.
- **Do** use the `--chev` mask for every disclosure chevron.

### Don't:
- **Don't** use real game assets: logos, characters, UI sprites, item or skill art, or the official game typeface. Evoke the genre with original drawing only.
- **Don't** draw a gauge for a countdown whose total is unknown (the booster countdown).
- **Don't** give collapsed windows the title-bar color; they use Shut Wood.
- **Don't** raise target rows into floating cards.
- **Don't** add classes to the status window beyond its state class; JS overwrites them.
- **Don't** outline body text or set Jua bold.
- **Don't** use green, red or blue outside their state meanings.
- **Don't** let a `display` rule override the `hidden` attribute; `[hidden]` stays `display:none !important`.
