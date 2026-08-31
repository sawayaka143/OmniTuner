# OmniTuner

A chromatic instrument tuner and practice workbench for guitar and other acoustic instruments. OmniTuner listens through your microphone, detects pitch in real time, and pairs the tuner with a scale/fretboard explorer, a chord finder, and a metronome — all in a single installable web app.

**Live app:** [https://omni-tuner.vercel.app](https://omni-tuner.vercel.app)

## Features

- **Tuner** — real-time pitch detection with cents readout, auto or manual string targeting, adjustable reference pitch (A4), and in-tune sound/glow feedback.
- **Scales** — interactive fretboard map for any root note and scale, with scale playback, custom tunings, note/degree labels, and accent colors.
- **Chords** — search chord voicings across your tuning, view them as tab, dots, or a neck diagram, build progressions from degree presets, and detect the key of a progression.
- **Metronome** — tap tempo, meter and polyrhythm patterns, count-in, subdivisions, and per-role sound selection.
- **Command palette** — press `Ctrl+K` (or `Cmd+K`) to jump between pages, change the root note, or toggle the theme.
- **Installable PWA** — works offline after the first visit, with light/dark themes.

## Tech stack

- [Angular](https://angular.dev) 22 — standalone components, signals, zoneless change detection
- [TypeScript](https://www.typescriptlang.org) in strict mode
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) for pitch detection off the main thread
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) for input analysis and sample-based playback
- [Vitest](https://vitest.dev) with an axe-core accessibility gate

## Getting started

Prerequisites: [Node.js](https://nodejs.org) 22 (the version used in CI) and npm.

```bash
npm install
npm start
```

Then open `http://localhost:4200/` and grant microphone access when the tuner asks for it (microphone capture requires `localhost` or HTTPS).

## Scripts

| Script                  | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `npm start`             | Development server with live reload          |
| `npm run build`         | Production build into `dist/`                |
| `npm run watch`         | Rebuild on file changes (development config) |
| `npm test`              | Run unit tests with Vitest                   |
| `npm run test:coverage` | Tests with coverage and threshold checks     |
| `npm run lint`          | Lint with ESLint (angular-eslint)            |
| `npm run lint:fix`      | Lint and auto-fix                            |
| `npm run format`        | Format with Prettier                         |
| `npm run format:check`  | Verify formatting                            |

## Keyboard shortcuts

| Keys                | Action                 |
| ------------------- | ---------------------- |
| `Ctrl`/`Cmd` + `K`  | Command palette        |
| `←` / `→`           | Previous / next page   |
| `?` or `/`          | Shortcut help          |
| `Esc`               | Close dialogs          |
| `Space`             | Start / stop metronome |
| `T`                 | Tap tempo              |
| `↑` / `↓`           | Tempo ±1               |
| `Shift` + `↑` / `↓` | Tempo ±5               |

## Testing and quality gates

Unit tests run with [Vitest](https://vitest.dev) via `ng test`. The suite includes an accessibility gate: key UI primitives are checked with [axe-core](https://github.com/dequelabs/axe-core) and must have no violations.

CI (`.github/workflows/ci.yml`) runs on pushes to `master` and on all pull requests, and enforces:

1. `npm run lint`
2. `npm run format:check`
3. `npm run test:coverage` (coverage thresholds configured in `angular.json`)
4. `npm run build`

## Architecture notes

- **Pitch detection** runs in a dedicated Web Worker (`src/app/services/pitch-detector.worker.ts`) over a 4096-sample buffer (~85 ms at 48 kHz), searching the 60–1200 Hz range — low E on a guitar up to flute/mandolin territory. Results pass through a confidence gate and exponential smoothing before display.
- **Audio capture** uses `AnalyserNode.getFloatTimeDomainData` (see `audio-capture-service.ts`).
- **Playback** uses recorded guitar samples with pitch-rate shifting, falling back to synthesized tones when samples are unavailable (`scale-playback.ts`).
- **State** is signal-based. Tuner, scale, metronome, and instrument preferences persist to `localStorage` behind injectable storage tokens, which keeps services testable.
- **Theming** is a `data-theme` attribute on `<html>` driven by `ThemeService`, with a circular reveal view transition on toggle.
- **Icons** are the [Tabler](https://tabler.io/icons) webfont; the typeface is Instrument Sans.

## Project structure

```
src/
├── app/
│   ├── audio-monitor/      # Tuner page
│   ├── chord-finder/       # Chords page + neck diagram
│   ├── metronome/          # Metronome page, audio engine, preferences
│   ├── scales/             # Scales page (fretboard, tunings, playback)
│   ├── components/         # Shared components (app shell, pickers, editors)
│   ├── ui/                 # Reusable UI primitives (listbox, segmented, …)
│   ├── services/           # Audio capture, playback, preferences, theme
│   ├── utils/              # Pure music-theory and DSP helpers
│   ├── data/               # Static constants (scales, tunings, samples)
│   └── models/             # Type definitions
├── assets/audio/guitar/    # Guitar samples used for playback
└── styles.scss             # Design tokens and global styles
```
