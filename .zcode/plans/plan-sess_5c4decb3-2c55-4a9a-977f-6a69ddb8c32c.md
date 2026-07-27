# Scales Section — Implementation Plan

## Overview
Add a **Scales** section (routed at `/scales`, alongside `/tuner`) that renders a scale/mode on a virtual guitar fretboard, with root + scale pickers, standard/custom tuning, interval-colored dots, and an interval legend. A fully decoupled, UI-free theory engine drives it; `computeFretboard` accepts a generic `IntervalEntry[]` so it can be reused later for a Chord Builder.

Decisions (confirmed): router routes; 15 frets with horizontal scroll; custom tuning = 6 free-text pitch-class inputs.

---

## Part 1 — Theory Engine (pure TS, no Angular, no UI)

### 1a. `src/app/models/scale.model.ts`
```ts
export interface IntervalEntry {
  readonly semitones: number;  // offset from root; can exceed 11 (e.g. 9=14)
  readonly label: string;      // SOURCE OF TRUTH for color/display: 'R','b3','5','9','sus2'…
}

export interface Scale {
  readonly id: string;
  readonly label: string;
  readonly intervals: readonly IntervalEntry[];
}

// One renderable fret position (display-ready). Note: computed, label-led.
export interface FretCell {
  readonly stringIndex: number;            // 0 = highest string (top of board)
  readonly fret: number;                   // 0 = open
  readonly pitchClass: number;             // 0–11 absolute
  readonly interval: IntervalEntry | null; // null = not in the current scale
  readonly noteName: string;               // enharmonic-correct display name
  readonly color: string;                  // resolved from label via colorForLabel
  readonly isRoot: boolean;
}
```

### 1b. `src/app/data/interval-colors.ts` (central label→color map)
Exactly your mapping; a fallback for any unforeseen label:
```ts
export const INTERVAL_COLORS: Readonly<Record<string, string>> = {
  R: '#779900',
  '3': '#ff9900', m3: '#ff9900', sus2: '#ff9900', sus4: '#ff9900',
  '5': '#227799', b5: '#227799', '#5': '#227799',
  b6: '#ee6600', '6': '#ee6600', dim7: '#ee6600', '7': '#ee6600', maj7: '#ee6600',
  '9': '#ee0000', '11': '#ee0000', '13': '#ee0000',
  b9: '#bb3366', '#9': '#bb3366', '#11': '#bb3366', b13: '#bb3366',
};
export const DEFAULT_INTERVAL_COLOR = '#62625d'; // --text-dim
export const colorForLabel = (label: string): string =>
  INTERVAL_COLORS[label] ?? DEFAULT_INTERVAL_COLOR;
// luminance-based readable text color for a swatch (AA-safe on dots)
export const textColorOn = (hex: string): string => { /* relative luminance calc → '#f5f5f3' or '#121211' */ };
```

### 1c. `src/app/data/scale.constants.ts`
- `SHARP_NAMES` / `FLAT_NAMES` (C-rooted 12-name arrays, parallel, indexable by pitch class).
- `ROOT_NOTES`: root-picker options = `['C','C#','D','Eb','E','F','F#','G','G#','A','Bb','B']` (canonical, user-friendly).
- `STANDARD_TUNING_PCS`: standard guitar open pitch classes **high-string-first** (1st=E on top): `[4, 11, 7, 2, 9, 4]` (E,B,G,D,A,E).
- `SCALES: readonly Scale[]` — Major, Natural Minor, Harmonic Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian, Major Pentatonic, Minor Pentatonic, Blues (interval labels chosen from the color map, see Design Summary table). Trivial to add more later.

### 1d. `src/app/utils/scale-theory.ts` (the reusable engine)
Pure functions, no Angular imports:
```ts
parseNote(input: string): number | null
  // accept 'Eb','D#','bb','♭','♯', unicode; uppercase; reject anything not a valid
  // chromatic pitch class → returns null (never throws; invalid input can't break UI)
noteName(pitchClass: number, preferFlats: boolean): string
preferFlatsFor(rootName: string): boolean   // 'Eb'/'Bb'/'Ab'/… → true; else sharps
intervalByPitchClass(intervals): Map<number, IntervalEntry>   // semitones%12 → entry (later wins on collision)
tuningToPitchClasses(noteInputs: string[]): (number | null)[]  // per-string parse
computeFretboard(
  openPitchClasses: readonly number[],  // high-string-first (index 0 = top)
  fretCount: number,
  intervals: readonly IntervalEntry[],  // GENERIC — same engine reused for chords later
  preferFlats: boolean,
): FretCell[][]
```
`computeFretboard` returns `stringCount × (fretCount+1)` matrix; each cell carries its resolved `interval`, `noteName`, `color`, `isRoot`. Pitch class math uses `(((open + fret) % 12) + 12) % 12`. Root = `label === 'R'`. **No hardcoded shapes; works for any tuning (incl. duplicates/odd tunings).**

### 1e. `src/app/utils/scale-theory.spec.ts`
Vitest unit tests (project already uses vitest + jsdom): `parseNote` valid/invalid/unicode/enharmonic; `computeFretboard` correctness vs. standard tuning (e.g. 6th-string fret 5 = A, pitch class 9); flat-spelling when root is Eb; `intervalByPitchClass` collision-wins behavior; invalid custom-tuning inputs return null without throwing.

---

## Part 2 — UI Components (presentational, Pattern A: input()/output() only, no DI, external templates relative to TS, `@if`/`@for`, `[class]`/`[style]` only)

### 2a. `src/app/components/root-note-picker/{ts,html,scss}`
Reuses the existing **dropdown** pattern (`.dropdown-wrapper` + `.btn` + `.dropdown-menu.card` + `expand_more` icon, `dropdown-appear` animation). Input: `notes: string[]`, `selected: string`, `open: boolean`. Output: `select`, `toggle`, `close`.

### 2b. `src/app/components/scale-picker/{ts,html,scss}`
Same dropdown pattern. Input: `scales: Scale[]`, `selectedId: string`, `open`. Output: `select`, `toggle`, `close`.

### 2c. `src/app/components/custom-tuning/{ts,html,scss}`
6 free-text inputs labelled "String 1 (highest) … String 6 (lowest)" (display order = high→low to match fretboard). Input: `values: (string|null)[]` (6), `errors: boolean[]` (per-string validity). Output: `change(index, value)`. Each field: `<input class="tuning-input">` styled like `.btn`/`.dropdown-wrapper .btn` (mono 13px, `--surface-container-low`, `--border-subtle`, `--r-md`, focus `--border-active`). Invalid field → border `#bb3366` + `aria-invalid` + `aria-describedby` error text.

### 2d. `src/app/components/fretboard/{ts,html,scss}`
The visualization. Inputs: `cells: FretCell[][]`, `fretCount: number`. Layout:
- Outer `.fretboard-scroll` (`overflow-x: auto`), inner `.fretboard` (`min-width` ≈ 880px for 15 frets).
- CSS grid: `grid-template-columns: var(--open-w) repeat(fretCount, var(--fret-w))`, rows = strings.
- **Row 0 = highest string (top)** — the container passes `cells` already high-string-first.
- Fret lines (right border of each cell, `--border-subtle`) + a heavier **nut** before fret 1. Inlay dots at frets 3/5/7/9 (single) and 12 (double) in `--text-dim`.
- Horizontal **string lines** across each row (`--border-medium`).
- Each in-scale cell renders a `.fret-dot`: background = `cell.color` (from label), text = `cell.noteName` (color via `textColorOn(color)` for AA), sized by interval: **root** is larger + ring (`box-shadow` halo) to stand out. Non-scale cells are empty.
- `aria-label` describes the board (root + scale); dots carry `title` = note + interval label.

### 2e. `src/app/components/interval-legend/{ts,html,scss}`
Input: `intervals: IntervalEntry[]` (dedup by label in container). Renders a row of swatches: colored chip (`colorForLabel`) + label, in `.btn`/`.card`-adjacent styling. Root swatch highlighted.

---

## Part 3 — Section Container (Pattern B, mirrors `audio-monitor.ts`)

### `src/app/scales/scales.{ts,html,scss}`
`@Component` standalone (no `standalone:true`, no `changeDetection`), `imports: [RootNotePicker, ScalePicker, CustomTuning, Fretboard, IntervalLegend]`, `inject(DestroyRef)`, external template/styles relative to TS.

**Signals (state):** `rootNote = signal('C')`, `scaleId = signal('major')`, `tuningMode = signal<'standard'|'custom'>('standard')`, `customNotes = signal<(string)[]>(['E','B','G','D','A','E'])` (high-string-first, defaulting to standard), `rootOpen = signal(false)`, `scaleOpen = signal(false)`.

**Computed (derived):** `currentScale` (find by id), `intervals` (= scale.intervals), `preferFlats` (= preferFlatsFor(rootNote)), `customPcs` / `customErrors` (per-string parse validity), `openPcs` (standard → STANDARD_TUNING_PCS; custom → parsed valid set, invalid strings excluded or board disabled — invalid input **must not break the app**: when any string is invalid, show an inline error and render standard/fallback so the board never throws), `cells` = `computeFretboard(openPcs, 15, intervals, preferFlats)`, `legendIntervals` (dedup of `intervals`).

**Handlers (protected):** `selectRoot`, `selectScale`, `toggleRoot`, `toggleScale`, `closePickers`, `setTuningMode`, `onCustomChange(i, v)`. All use `set`/`update` (no `mutate`).

**Template (`scales.html`):** `<main class="app-main">` (reuses audio-monitor layout token) → a controls row (Root picker, Scale picker, and a `.seg` segmented control "Standard | Custom" reusing the sliding-indicator pattern for tuning mode) → `<app-fretboard>` (inside `.fretboard-stage`, centered, scrollable) → `<app-interval-legend>`. When `tuningMode==='custom'`, render `<app-custom-tuning>` above/below the board.

**Styles (`scales.scss`):** `:host { display: contents; }`; `.app-main` mirrors audio-monitor (`flex column`, `gap: 24px`, `padding: 16px 0 48px`); `.scales-controls` flex row, wrap, `gap: 12px`, centered; `.fretboard-stage { width:100%; max-width: 960px; padding: 0 24px; }`. All colors/borders/radii/fonts from existing tokens (no new hues outside the interval-color dots). Reuse `.seg`/`.dropdown` styling conventions.

---

## Part 4 — Routing & Shell Wiring

### `src/app/app.routes.ts`
```ts
export const routes: Routes = [
  { path: '', redirectTo: 'tuner', pathMatch: 'full' },
  { path: 'tuner', loadComponent: () => import('./audio-monitor/audio-monitor').then(c => c.AudioMonitor) },
  { path: 'scales', loadComponent: () => import('./scales/scales').then(c => c.Scales) },
];
```

### `src/app/components/app-shell/app-shell.ts`
Add `RouterLink, RouterLinkActive` to `imports` (currently only `RouterOutlet`).

### `src/app/components/app-shell/app-shell.html`
Replace the dead `<a class="nav-link active" href="#">Tuner</a>` with two real links (the `.nav-link`/`.active` styles already exist):
```html
<a class="nav-link" routerLink="/tuner" routerLinkActive="active">Tuner</a>
<a class="nav-link" routerLink="/scales" routerLinkActive="active">Scales</a>
```
Both render inside the persistent `<router-outlet />` under the same sticky header — "Scales alongside Tuner," not a new standalone page. (No `.scss` changes needed; nav already supports multiple links with `gap:24px`.)

---

## Correctness & Requirements Checklist
- ✅ Standard tuning default; custom 6-string free-text with validation (invalid → flagged, app never breaks).
- ✅ Tuning change recomputes the whole board instantly (signals + `computed`).
- ✅ Root picker + scale/mode picker; scales defined as data, easy to extend.
- ✅ Enharmonic spelling: flat roots → flats everywhere; sharp/natural roots → sharps.
- ✅ Algorithmic from open note + fret + intervals; **no CAGED/hardcoded shapes**; works for any tuning incl. duplicates.
- ✅ All scale notes shown; root highlighted distinctly (size + halo).
- ✅ String orientation: highest (1st) on top, lowest (6th) on bottom (engine expects high-string-first).
- ✅ Interval-based coloring via **label**, not semitone; central color map with all listed labels.
- ✅ Legend of active intervals.
- ✅ Exact color mapping used verbatim.
- ✅ `IntervalEntry` data structure (semitones + label); label is coloring source of truth.
- ✅ `computeFretboard(intervals: IntervalEntry[])` generic → directly reusable for Chord Builder.
- ✅ Out of scope respected: no chords, no fingerings, no recommendations.
- ✅ Matches design system: monochrome tokens, `.btn`/`.card`/`.seg`/dropdown conventions, JetBrains Mono + Newsreader + Material Symbols, existing transitions & press feedback, `@if`/`@for`, `[class]`/`[style]` only, no `standalone:true`/`changeDetection`/`@HostBinding`/`ngClass`/`ngStyle`.
- ✅ Accessibility: real form controls w/ labels, `aria-*`, AA text contrast on dots (luminance-based text color), keyboard-operable, `aria-label` on the fretboard.

## Verification
1. `npm run test` — run the new `scale-theory.spec.ts` (parse, computeFretboard, enharmonic, invalid-input safety).
2. `npm run start` (or `ng serve`) — click Tuner/Scales nav; default lands on Tuner (redirect), Scales shows C Major on standard tuning; switch root to `Eb` (dots re-spell to flats, colors stay); switch scale/mode (board updates); switch to Custom, type invalid note (field flags, board degrades gracefully, no crash); change a custom string to a new note (board updates); confirm highest string on top, root dots visually distinct, legend reflects active intervals, horizontal scroll appears below ~960px.
3. Manual AXE/WCAG spot-check on the Scales page (focus order, contrast, labels).