---
name: 메이플 재획 알리미
description: An arcade cabinet in daylight for a by-ear hunting alarm. Bright, clear and quiet until something needs you, then one row lights ember.
colors:
  daylight-lilac-paper: "oklch(97% 0.01 315)"
  lilac-well: "oklch(94% 0.014 315)"
  lilac-press: "oklch(90.5% 0.018 315)"
  aubergine-ink: "oklch(20% 0.045 312)"
  aubergine-ink-soft: "oklch(33% 0.045 312)"
  aubergine-muted: "oklch(47% 0.035 312)"
  lilac-rule: "oklch(85% 0.025 312)"
  cabinet-ember: "oklch(64% 0.22 40)"
  ember-text: "oklch(52% 0.2 36)"
  acid-lime: "oklch(87% 0.2 115)"
  acid-olive: "oklch(47% 0.13 128)"
  test-teal: "oklch(50% 0.11 215)"
  crt-black: "oklch(10% 0.03 312)"
  crt-screen-ink: "oklch(92% 0.012 315)"
  crt-red: "oklch(63% 0.24 25)"
  crt-green: "oklch(80% 0.25 140)"
  crt-blue: "oklch(60% 0.24 265)"
  crt-cyan: "oklch(70% 0.14 200)"
typography:
  display:
    fontFamily: "Black Han Sans, Malgun Gothic, Apple SD Gothic Neo, sans-serif"
    fontSize: "1.728rem"
    fontWeight: 400
    lineHeight: 1.05
  headline:
    fontFamily: "Black Han Sans, Malgun Gothic, Apple SD Gothic Neo, sans-serif"
    fontSize: "1.44rem"
    fontWeight: 400
    lineHeight: 1.25
  title:
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
  square: "0px"
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
    backgroundColor: "{colors.lilac-well}"
    textColor: "{colors.aubergine-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    padding: "4px 12px"
    height: "34px"
  button-hover:
    backgroundColor: "{colors.lilac-press}"
  button-primary:
    backgroundColor: "{colors.cabinet-ember}"
    textColor: "{colors.aubergine-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    padding: "4px 12px"
    height: "34px"
  input:
    backgroundColor: "{colors.daylight-lilac-paper}"
    textColor: "{colors.aubergine-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "4px 8px"
    height: "34px"
  chip:
    backgroundColor: "{colors.lilac-well}"
    textColor: "{colors.aubergine-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    height: "34px"
  status-band:
    backgroundColor: "{colors.lilac-well}"
    textColor: "{colors.aubergine-ink}"
    rounded: "{rounded.card}"
    padding: "16px 24px"
  status-band-lost:
    backgroundColor: "{colors.cabinet-ember}"
    textColor: "{colors.aubergine-ink}"
  target-row-lit:
    backgroundColor: "{colors.cabinet-ember}"
    textColor: "{colors.aubergine-ink}"
    height: "67px"
  well:
    backgroundColor: "{colors.lilac-well}"
    rounded: "{rounded.card}"
    padding: "16px"
  toast:
    backgroundColor: "{colors.cabinet-ember}"
    textColor: "{colors.aubergine-ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.card}"
    padding: "12px 24px"
---

# Design System: 메이플 재획 알리미

## Overview

**Creative North Star: "The Cabinet Menu"**

The screen is set up, checked, then hidden. What it shows is what is about to ring. Targets sit one per line on hairlines like the menu of an arcade cabinet; the line that needs the person now (a buff about to end, a rune on the minimap, a target to register again) lights ember with dark ink, the way a selected menu line lights. Everything else stays bright, clear and quiet: lilac-white paper, aubergine ink, sections without boxes, a status band that says in one word whether the tool is watching.

The arcade arrives through material, never props: a heavy Hangul signage face for heads, pixel figures for timers, square inputs, 2px rules, and hard zero-blur offsets on the things you press. The only dark surface is the game screen itself, a CRT inset with a faint RGB grille that shows until the capture covers it. There is one light world; the tool does not follow the OS dark setting.

The page is an Operate surface. Density is moderate, controls are 34px, and motion only reports state. This is an original design that evokes the genre; it uses no game assets, logos, characters or the game's typeface.

**Key Characteristics:**
- Target rows on hairlines; the row that needs you lights ember.
- Ember means "act now", acid means "live"; nothing else is coloured.
- Black Han Sans for heads and the status word, Silkscreen Tabular for timer figures, the system Korean sans for everything else.
- Sections are a head over a 2px rule, never a box.
- Flat surfaces; only pressables and floating layers lift, on hard offsets.
- The game screen is a dark CRT inset, small until you register a target.

## Colors

A quiet lilac daylight with two loud inks that take turns: ember for what needs you, acid for what is live.

### Primary
- **Cabinet Ember** (oklch(64% 0.22 40)): the one filled primary action, the lit target row, the status band when the connection is lost, the registration banner, the toast, a gauge or timer figure near its end. Text on it is Aubergine Ink (4.97:1).
- **Ember Text** (oklch(52% 0.2 36)): ember as text on paper (warnings, a row's alert state, the "not found" notes), 5.0:1 or better.

### Secondary
- **Acid Lime** (oklch(87% 0.2 115)): a fill only. The gauge fill, the pressable offset shadow, the crest's clapper. It is 1.3:1 on paper, so never text or a line.
- **Acid Olive** (oklch(47% 0.13 128)): everything acid says in text or line. The watching state word and the status band's border, timer figures, checkboxes, radios and sliders, the focus ring, link underlines, list markers.

### Tertiary
- **Test Teal** (oklch(50% 0.11 215)): screenshot test mode only, as the status band border and state word.

### Neutral
- **Daylight Lilac Paper** (oklch(97% 0.01 315)): the page and the inputs.
- **Lilac Well** (oklch(94% 0.014 315)): the status band, an open target, manual timer tiles, the add menu, the dialog. **Lilac Press** (oklch(90.5% 0.018 315)) is hover.
- **Aubergine Ink** (oklch(20% 0.045 312)), **Soft** (oklch(33% 0.045 312)) and **Muted** (oklch(47% 0.035 312)): text, secondary text, hints. Muted is also every field edge.
- **Lilac Rule** (oklch(85% 0.025 312)): hairlines and section rules only.
- **CRT Black** (oklch(10% 0.03 312)) with **CRT Screen Ink** (oklch(92% 0.012 315)): the game screen, icon slots, gauge troughs, the floating layers' hard shadow. The CRT red, green, blue and cyan exist only for the wordmark's 1.5px split and the screen's grille.

### Named Rules
**The Two Inks Rule.** Ember means act now and acid means live. Neither is used for decoration, and a third accent is never added.

**The Acid Split Rule.** On light paper, acid is two tones: the lime fills, the olive speaks. Lime is never text.

**The Hex Contract Rule.** `--warn-text`, `--alert-bg`, `--muted` and `--accent` stay plain hex aliases of these colours in `css/tokens.css`; a regression test reads them as strings starting with `#`.

## Typography

**Display Font:** Black Han Sans (with Malgun Gothic, Apple SD Gothic Neo)
**Body Font:** the system Korean sans (Pretendard if installed, Malgun Gothic, Apple SD Gothic Neo, system-ui)
**Figure Font:** Silkscreen Tabular (`fonts/silkscreen-tabular.woff2`), Silkscreen Bold subset to digits and the colon with every digit one width (`fonts/OFL-silkscreen.txt`)

**Character:** a heavy Hangul signage face does the arcade's shouting in a few places, pixel figures count down, and a plain Korean sans carries every instruction and setting so the tool stays readable.

### Hierarchy
- **Display** (400, 1.728rem, 1.05): the wordmark, with a 1.5px red and cyan split, and the status word ("감시 중"), coloured by state.
- **Headline** (400, 1.44rem, 1.25): the toast and the dialog title.
- **Title** (400, 1.2rem, 1.2): section heads over their 2px rule.
- **Figure** (700, 2.75rem, 1): manual timer remaining time, olive while running, ember near the end.
- **Status** (700, 1.44rem, 1.2): an open target's state line, tabular.
- **Body** (400, 1rem, 1.5): default text and the setup guide (65ch measure). Hangul wraps by word (`word-break: keep-all`).
- **Label** (700, 0.875rem, 1.2): buttons and chips. Target names in rows are 1rem 700; hints and sub-labels are 0.875rem 400 in Muted.

### Named Rules
**The Figure Rule.** Silkscreen Tabular is only for digits and colons at 40px and up. Never a word, never small.

**The Two Weights Rule.** Body text uses 400 and 700 only; the display face has one weight.

## Layout

A centred container capped at 1440px with 24px side padding (16px under 40rem). The status band spans the top. From 75rem the body is three equal columns, 40px apart: the target menu, the manual timers, and a small game screen with the setup guide, sounds and backup under it. While a target is being registered the game screen takes two columns and the timers move under the targets, so the icon can be dragged at size; it returns when registration ends. From 60 to 75rem there are two columns (targets and timers 3, the screen 2). Under 60rem there is one column, ordered status band, targets, game screen, timers, guide, sounds.

Spacing uses one scale (2, 4, 8, 12, 16, 24, 40, 64px). A collapsed target row is one line, 67px whether or not its gauge shows (the row reserves the gauge's space), and never more than 70px. Manual timers tile at a 240px minimum.

## Elevation & Depth

Flat by default. Surfaces separate by tone (paper, then the lilac well a step darker) and by rules, never by blur. Only two kinds of thing lift, both on hard zero-blur offsets: what you press, and what floats over the page.

### Shadow Vocabulary
- **Press** (`box-shadow: 4px 4px 0 var(--color-accent-2)`): the filled primary button and the manual timer's start button. Hover lifts to 5px; active slams to 1px.
- **Float** (`box-shadow: 6px 6px 0 var(--color-shade)`): the toast, the undo bar and the import dialog.
- **Alert flash** (`box-shadow: inset 0 0 0 2px` ember plus an inset ember tint, stepped four times): a target row when its alert rings. It never touches the background, so a lit row keeps its contrast.

### Named Rules
**The Flat Until Pressed Rule.** Nothing lifts unless it can be pressed or floats over the page. Never a blur, a glow or a gradient on a control.

## Shapes

Square and blunt. Wells and buttons take a 4px corner; inputs, chips and icon slots are square (0). Strokes are 2px on wells, buttons, inputs and section rules, 1px on hairlines between rows. The disclosure chevron is one square-capped SVG mask, rotated when open. The game screen is a 4px-cornered dark rectangle with a static RGB grille.

## Components

Pressable and solid: 2px borders, hard offsets, and a press that moves toward its shadow.

### Buttons
- **Shape:** gently cut corners (4px), 34px tall, 2px border.
- **Default:** Lilac Well fill, Muted border, Aubergine Ink 700 label; hover turns to Lilac Press with an ink border; active moves 1px.
- **Primary:** Cabinet Ember fill, ink border, Aubergine Ink label, the Press shadow in Acid Lime. One filled primary per screen: further register buttons in the status band and the manual timer's start button use the unfilled surface with the same shadow.
- **On ember surfaces:** every button is unfilled with an Aubergine Ink border, and the focus ring turns Aubergine Ink.
- **Disabled:** 55% opacity, `cursor: not-allowed`, the native attribute.
- **Focus:** a 2px Acid Olive outline at 2px offset, instant.

### Chips
- **Style:** the default button, square corners. Used for the manual timer presets.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** Lilac Well on paper; never a box inside a box.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 2px Lilac Rule.
- **Internal Padding:** 16px.
- Used for an open target, manual timer tiles, the add menu and the sound grouping fieldset. Sections themselves have no box.

### Inputs / Fields
- **Style:** Daylight Lilac Paper fill, 2px Muted border, square, 34px tall, ember caret.
- **Focus:** a 2px Acid Olive outline drawn over the border (inset), border width unchanged.
- **Disabled:** 55% opacity, `cursor: not-allowed`.
- Checkboxes, radios and sliders are native, tinted Acid Olive; their labels are 32px tall hit areas.

### Navigation
- A top bar: the crest and the wordmark on the left, the session tools on the right (connect as the primary, then screenshot test, notifications, small window, and a sound well holding volume and voice).

### Status Band (signature)
- A Lilac Well band under the top bar. The state word in Display; the target summary parted by 2px vertical rules (never middle dots); the manual timer summary; the stop button at the far end. Watching turns the border and the word Acid Olive, test mode Test Teal, and a lost connection turns the whole band Cabinet Ember with Aubergine Ink.

### Target Row (signature)
- A 40px square icon slot (CRT Black, 2px rule; dashed Muted when nothing is registered), the name in 700 over a one-line state, the "사용" switch and the expand button. A 6px gauge sits under the row when the full length is known: Acid Lime on CRT Black, Cabinet Ember near the end. When the state needs the person, the whole collapsed row lights Cabinet Ember with Aubergine Ink. An open target becomes a Lilac Well holding its settings.

### Manual Timer Tile
- A Lilac Well tile: the name in 700, the remaining time in Silkscreen Tabular, the gauge, and small unfilled buttons.

### Small Window (Picture-in-Picture)
- A hex copy of the palette in `js/pip.js`: a Lilac Well status strip in Black Han Sans, rows on hairlines with tabular times, idle rows in Soft ink (not opacity), and full-row fills that blink for five seconds on an alert: ember for "soon", soft ink for "ended", cyan for "info", striped well for connection problems, each with a mark so colour is never the only signal.

## Do's and Don'ts

### Do:
- **Do** keep sections as a Title head over a 2px Lilac Rule; put rows on 1px hairlines.
- **Do** light a target row ember only for a state that needs the person now.
- **Do** use Acid Lime as a fill and Acid Olive for any acid text or line.
- **Do** keep every collapsed target row at 67px, reserving the gauge's space.
- **Do** keep motion to state: press physics at 120ms, the stepped alert flash, the linear gauge drain, all ended at once under reduced motion.
- **Do** keep `[hidden]` as `display: none !important`.

### Don't:
- **Don't** add a dark theme or a second accent unless the owner asks.
- **Don't** use a blur, a glow or a gradient on any control.
- **Don't** put a box inside a box, a coloured stripe on one side of a well, or a decorative status dot.
- **Don't** set a word in Silkscreen Tabular or use it under 40px.
- **Don't** draw sprites, controllers or game art, or use real game assets, logos or the game's typeface.
- **Don't** make the game screen big by default; it widens only while a target is being registered.

## System

Read by Hallmark runs as the locked system (`css/tokens.css` is the source of truth for every value).
- Genre: playful · Shape: app screen · Theme: Arcade, colourway ember, screen grille, re-derived on light paper at the owner's request (2026-11-09) · Axes: light/pixel/chromatic-ember · posture: full-palette
- Exports: `css/tokens.css` and `css/base.css`; `js/pip.js` (`PIP_CSS`) carries a hex copy for the small window.
