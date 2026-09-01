import {
  Component,
  DestroyRef,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  DEFAULT_TUNER_SETTINGS,
  REFERENCE_PITCH_MAX,
  REFERENCE_PITCH_MIN,
  TUNER_HOLD_MAX,
  TUNER_HOLD_MIN,
  TUNER_HOLD_STEP,
  TUNER_TOLERANCE_MAX,
  TUNER_TOLERANCE_MIN,
  TunerSettings,
  TunerStartupMode,
} from '../../models/tuner-preferences.model';
import { Toggle } from '../../ui/toggle/toggle';
import { IconButton } from '../../ui/icon-button/icon-button';
import { ColorField } from '../../ui/color-field/color-field';
import { RovingRadioGroup } from '../../ui/keyboard-nav';
import type { Theme } from '../../services/theme.service';

interface StartupModeOption {
  readonly value: TunerStartupMode;
  readonly label: string;
}

interface ThemeOption {
  readonly value: Theme;
  readonly label: string;
}

export interface ThemeChangeEvent {
  readonly theme: Theme;
  readonly origin: { readonly x: number; readonly y: number } | null;
}

interface PanelPosition {
  readonly x: number;
  readonly y: number;
}

const PANEL_POSITION_STORAGE_KEY = 'omnituner.settings-panel.position.v1';
const DEFAULT_PANEL_POSITION: PanelPosition = { x: 0, y: 0 };
const SHEET_INSET_PX = 12;
const DRAG_THRESHOLD_PX = 4;
const DRAG_KEYBOARD_STEP_PX = 20;

@Component({
  selector: 'app-settings-panel',
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
  imports: [Toggle, IconButton, ColorField, RovingRadioGroup],
  host: {
    '(window:resize)': 'onWindowResize()',
  },
})
export class SettingsPanel {
  readonly open = input(false);
  readonly accent = input('#ede8d0');
  readonly rootNoteColor = input('#ede8d0');
  readonly noteColor = input('#3b3b3b');
  readonly bgColor = input<string | null>(null);
  readonly cardColor = input<string | null>(null);
  readonly tunerSettings = input<TunerSettings>(DEFAULT_TUNER_SETTINGS);
  readonly theme = input<Theme>('dark');

  readonly accentChange = output<string>();
  readonly rootNoteColorChange = output<string>();
  readonly noteColorChange = output<string>();
  readonly bgColorChange = output<string | null>();
  readonly cardColorChange = output<string | null>();
  readonly startupModeChange = output<TunerStartupMode>();
  readonly autoStartChange = output<boolean>();
  readonly themeChange = output<ThemeChangeEvent>();
  readonly inTuneEnabledChange = output<boolean>();
  readonly inTuneSoundChange = output<boolean>();
  readonly inTuneGlowChange = output<boolean>();
  readonly inTuneColorChange = output<string>();
  readonly outOfTuneColorChange = output<string>();
  readonly inTuneToleranceChange = output<number>();
  readonly inTuneHoldMsChange = output<number>();
  readonly referencePitchChange = output<number>();
  readonly openShortcuts = output<void>();
  readonly dismiss = output<void>();

  protected readonly dragOffset = signal<PanelPosition>(readStoredPosition());
  protected readonly dragging = signal(false);
  protected readonly sheetLeft = computed(() => this.basePosition()?.x ?? null);
  protected readonly sheetTop = computed(() => this.basePosition()?.y ?? null);
  protected readonly dragTransform = computed(() => {
    const { x, y } = this.dragOffset();
    return `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  });

  protected readonly toleranceMin = TUNER_TOLERANCE_MIN;
  protected readonly toleranceMax = TUNER_TOLERANCE_MAX;
  protected readonly holdMin = TUNER_HOLD_MIN;
  protected readonly holdMax = TUNER_HOLD_MAX;
  protected readonly holdStep = TUNER_HOLD_STEP;
  protected readonly refPitchMin = REFERENCE_PITCH_MIN;
  protected readonly refPitchMax = REFERENCE_PITCH_MAX;

  protected readonly startupModeOptions: readonly StartupModeOption[] = [
    { value: 'remember', label: 'Remember last' },
    { value: 'auto', label: 'Auto' },
    { value: 'manual', label: 'Manual' },
  ];

  protected readonly themeOptions: readonly ThemeOption[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  protected readonly themeIndicatorTransform = computed(() => {
    const index = this.themeOptions.findIndex((option) => option.value === this.theme());
    return `translateX(${Math.max(0, index) * 100}%)`;
  });

  protected readonly startupIndicatorTransform = computed(() => {
    const index = this.startupModeOptions.findIndex(
      (option) => option.value === this.tunerSettings().startupMode,
    );
    return `translateX(${Math.max(0, index) * 100}%)`;
  });

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePosition = signal<PanelPosition | null>(null);
  private dragState: {
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly origin: PanelPosition;
  } | null = null;

  private readonly onPointerMove = (event: PointerEvent): void => {
    const state = this.dragState;
    if (!state || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!this.dragging()) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      this.dragging.set(true);
    }
    this.dragOffset.set(this.clampPosition({ x: state.origin.x + dx, y: state.origin.y + dy }));
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    const wasDragging = this.dragging();
    this.detachDragListeners();
    this.dragState = null;
    this.dragging.set(false);
    if (wasDragging) this.persistPosition();
  };

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.open() && !dialog.open) {
        dialog.showModal();
        this.measureBase();
        untracked(() => this.dragOffset.update((position) => this.clampPosition(position)));
      }
      if (!this.open() && dialog.open) dialog.close();
    });
    this.destroyRef.onDestroy(() => this.detachDragListeners());
  }

  protected onDragStart(event: PointerEvent): void {
    if (event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest('button')) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    this.dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: this.dragOffset(),
    };
    handle.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerEnd);
    window.addEventListener('pointercancel', this.onPointerEnd);
    document.body.style.userSelect = 'none';
  }

  protected onDragKeydown(event: KeyboardEvent): void {
    const key = event.key;
    const dx =
      key === 'ArrowLeft'
        ? -DRAG_KEYBOARD_STEP_PX
        : key === 'ArrowRight'
          ? DRAG_KEYBOARD_STEP_PX
          : 0;
    const dy =
      key === 'ArrowUp' ? -DRAG_KEYBOARD_STEP_PX : key === 'ArrowDown' ? DRAG_KEYBOARD_STEP_PX : 0;
    if (dx === 0 && dy === 0) return;
    event.preventDefault();
    this.dragOffset.update((position) =>
      this.clampPosition({ x: position.x + dx, y: position.y + dy }),
    );
    this.persistPosition();
  }

  protected resetPosition(): void {
    this.dragOffset.set(DEFAULT_PANEL_POSITION);
    this.persistPosition();
  }

  protected onWindowResize(): void {
    if (!this.open()) return;
    this.measureBase();
    this.dragOffset.update((position) => this.clampPosition(position));
  }

  protected chooseAccent(value: string): void {
    this.accentChange.emit(value);
  }

  protected chooseStartupMode(value: TunerStartupMode): void {
    if (this.tunerSettings().startupMode === value) return;
    this.startupModeChange.emit(value);
  }

  protected chooseTheme(value: Theme, event: MouseEvent): void {
    if (this.theme() === value) return;
    const target = event.currentTarget as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    this.themeChange.emit({
      theme: value,
      origin: rect
        ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
        : null,
    });
  }

  protected chooseInTuneColor(value: string): void {
    this.inTuneColorChange.emit(value);
  }

  protected onTolerance(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.inTuneToleranceChange.emit(Number(target.value));
  }

  protected onHoldMs(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.inTuneHoldMsChange.emit(Number(target.value));
  }

  protected onReferencePitch(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.referencePitchChange.emit(Number(target.value));
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    this.dismiss.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }

  private measureBase(): void {
    const sheet = this.sheet()?.nativeElement;
    const dialog = this.dialog()?.nativeElement;
    if (!sheet || !dialog) return;
    const width = sheet.offsetWidth;
    const height = sheet.offsetHeight;
    if (width === 0 || height === 0) return;
    this.basePosition.set({
      x: Math.max(0, dialog.clientWidth - width - SHEET_INSET_PX),
      y: Math.max(0, (dialog.clientHeight - height) / 2),
    });
  }

  private clampPosition(position: PanelPosition): PanelPosition {
    const base = this.basePosition();
    const sheet = this.sheet()?.nativeElement;
    if (!base || !sheet) return position;
    const width = sheet.offsetWidth;
    const height = sheet.offsetHeight;
    const viewportWidth = this.viewportWidth();
    const viewportHeight = this.viewportHeight();
    const minX = -base.x;
    const minY = -base.y;
    const maxX = Math.max(minX, viewportWidth - width - base.x);
    const maxY = Math.max(minY, viewportHeight - height - base.y);
    return {
      x: Math.min(maxX, Math.max(minX, position.x)),
      y: Math.min(maxY, Math.max(minY, position.y)),
    };
  }

  private viewportWidth(): number {
    return this.dialog()?.nativeElement.clientWidth || window.innerWidth;
  }

  private viewportHeight(): number {
    return this.dialog()?.nativeElement.clientHeight || window.innerHeight;
  }

  private persistPosition(): void {
    try {
      const { x, y } = this.dragOffset();
      localStorage.setItem(
        PANEL_POSITION_STORAGE_KEY,
        JSON.stringify({ x: Math.round(x), y: Math.round(y) }),
      );
    } catch {}
  }

  private detachDragListeners(): void {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerEnd);
    window.removeEventListener('pointercancel', this.onPointerEnd);
    document.body.style.userSelect = '';
  }
}

function readStoredPosition(): PanelPosition {
  try {
    const raw = localStorage.getItem(PANEL_POSITION_STORAGE_KEY);
    if (!raw) return DEFAULT_PANEL_POSITION;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PANEL_POSITION;
    const record = parsed as Record<string, unknown>;
    const x = record['x'];
    const y = record['y'];
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return DEFAULT_PANEL_POSITION;
    }
    return { x: Math.round(x), y: Math.round(y) };
  } catch {
    return DEFAULT_PANEL_POSITION;
  }
}
