
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection


# AGENTS.md

## Project context
This is a **guitar/acoustic instrument tuner** built with Angular (standalone components, signals, Dependency Injection).  
The app captures microphone audio, runs pitch detection in a Web Worker, and displays the frequency, nearest note, and cents deviation in real time.

## Tech stack
- **Angular** (latest, with signals, `inject`, `DestroyRef`)
- **TypeScript** (strict mode)
- **Web Workers** (for pitch detection off the main thread)
- **Web Audio API** (`AudioContext`, `AnalyserNode`, `getFloatTimeDomainData`)

## Current architecture (DO NOT CHANGE without explicit instruction)
### `AudioCaptureService` (injectable, providedIn: 'root')
- Uses `navigator.mediaDevices.getUserMedia({ audio: true })`
- Creates an `AudioContext` and `AnalyserNode` (fftSize = 4096)
- Reads time-domain data via `getFloatTimeDomainData` in a `requestAnimationFrame` loop
- Posts the raw buffer + `sampleRate` to the pitch detection worker
- Receives `{ frequency: number | null, confidence: number }` and applies:
  - Confidence threshold (`CONFIDENCE_THRESHOLD = 0.3` – subject to tuning)
  - Exponential moving average (`SMOOTHING_FACTOR = 0.1`) for display stability
- Exposes signals: `audioData`, `frequency`, `isCapturing`
- Handles cleanup on service destruction via `DestroyRef`

### Pitch detection worker (`pitch-detector.worker.ts`)
- **Current algorithm: Normalised autocorrelation with Hann window** (not YIN, not FFT peak picking)
- Applies a Hann window to the input buffer
- Computes autocorrelation, normalised by zero-lag energy
- Searches for the highest peak in the correlation array within a sensible frequency range (60 Hz – 1200 Hz)
- Uses parabolic interpolation for sub-sample accuracy
- Returns a confidence value (peak correlation) along with frequency
- Rejects frames with RMS < 0.005 (silence gate) or peak correlation < 0.3

### Why this algorithm (history)
- Original auto-correlation had an unstable “first valley” heuristic → caused jitter
- YIN was tried but failed: the dip in the difference function disappears as notes decay, causing frequency to vanish after half a second
- The current windowed, normalised autocorrelation stays locked on the fundamental and handles plucked string decay well

## Critical rules for AI agents

### DO NOT:
- Replace the pitch detection algorithm unless explicitly asked and given a clear, specific reason
- Remove or alter the window function (Hann) – it is essential for peak sharpness
- Change the search frequency range (60–1200 Hz) unless instructed
- Modify the confidence threshold or smoothing factor without direction
- Add any library or dependency not already in the project
- Refactor the service or worker structure without permission

### DO:
- Focus on the **specific task** described in the prompt
- Keep the existing code style and patterns (signals, `private readonly`, explicit types)
- Prefer minimal, surgical changes
- Explain *why* a change is being made, referencing the existing design decisions
- Respect the confidence + smoothing pipeline when handling frequency display
- Test with realistic audio scenarios (e.g., a guitar note decaying) before proposing a change

## Common issues & their resolution
| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Frequency disappears after half a second | Pitch algorithm lost lock (YIN dip vanished) | Use robust autocorrelation that searches for highest peak |
| Jittery display even with correct frequency | No smoothing or too high smoothing factor | Exponential moving average with factor ~0.1 |
| Needle drops to 0 in silence | Confidence threshold not applied | Use `CONFIDENCE_THRESHOLD` to gate low-confidence estimates |
| Erratic readings when not playing | RMS silence gate too low or missing | Keep RMS check before analysis |

## Testing notes
- The `requestAnimationFrame` loop runs at ~60 fps; expect ~60 pitch estimates per second
- Worker buffer length equals `fftSize` (4096 samples), which at 48 kHz yields ~85 ms of audio
- The autocorrelation search is limited to lags corresponding to 60–1200 Hz – suitable for guitar (low E ~82 Hz) up to flute/mandolin

---

*When in doubt, ask before modifying core pitch detection logic.*