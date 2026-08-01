import { Component, computed, effect, ElementRef, input, output, viewChild } from '@angular/core';
import {
  DEFAULT_TUNER_SETTINGS,
  TUNER_HOLD_MAX,
  TUNER_HOLD_MIN,
  TUNER_HOLD_STEP,
  TUNER_TOLERANCE_MAX,
  TUNER_TOLERANCE_MIN,
  TunerSettings,
  TunerStartupMode,
} from '../../models/tuner-preferences.model';

interface AccentOption {
  readonly name: string;
  readonly value: string;
}

interface StartupModeOption {
  readonly value: TunerStartupMode;
  readonly label: string;
}

@Component({
  selector: 'app-settings-panel',
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
})
export class SettingsPanel {
  readonly open = input(false);
  readonly accent = input('#779900');
  readonly rootNoteColor = input('#ffffff');
  readonly noteColor = input('#2e2e28');
  readonly workbenchScale = input(1);
  readonly tunerSettings = input<TunerSettings>(DEFAULT_TUNER_SETTINGS);

  readonly accentChange = output<string>();
  readonly rootNoteColorChange = output<string>();
  readonly noteColorChange = output<string>();
  readonly workbenchScaleChange = output<number>();
  readonly workbenchScaleReset = output<void>();
  readonly startupModeChange = output<TunerStartupMode>();
  readonly inTuneEnabledChange = output<boolean>();
  readonly inTuneSoundChange = output<boolean>();
  readonly inTuneGlowChange = output<boolean>();
  readonly inTuneColorChange = output<string>();
  readonly inTuneToleranceChange = output<number>();
  readonly inTuneHoldMsChange = output<number>();
  readonly dismiss = output<void>();

  protected readonly toleranceMin = TUNER_TOLERANCE_MIN;
  protected readonly toleranceMax = TUNER_TOLERANCE_MAX;
  protected readonly holdMin = TUNER_HOLD_MIN;
  protected readonly holdMax = TUNER_HOLD_MAX;
  protected readonly holdStep = TUNER_HOLD_STEP;

  protected readonly accentOptions: readonly AccentOption[] = [
    { name: 'Root green', value: '#779900' },
    { name: 'Third amber', value: '#ff9900' },
    { name: 'Fifth blue', value: '#227799' },
    { name: 'Seventh orange', value: '#ee6600' },
    { name: 'Extension red', value: '#ee0000' },
    { name: 'Altered magenta', value: '#bb3366' },
  ];

  protected readonly inTuneColorOptions: readonly AccentOption[] = [
    { name: 'Mint', value: '#7ecba8' },
    { name: 'Root green', value: '#779900' },
    { name: 'Third amber', value: '#ff9900' },
    { name: 'Fifth blue', value: '#227799' },
    { name: 'Seventh orange', value: '#ee6600' },
    { name: 'Altered magenta', value: '#bb3366' },
  ];

  protected readonly startupModeOptions: readonly StartupModeOption[] = [
    { value: 'remember', label: 'Remember last' },
    { value: 'auto', label: 'Auto' },
    { value: 'manual', label: 'Manual' },
  ];

  protected readonly startupIndicatorTransform = computed(() => {
    const index = this.startupModeOptions.findIndex(
      (option) => option.value === this.tunerSettings().startupMode,
    );
    return `translateX(${Math.max(0, index) * 100}%)`;
  });

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.open() && !dialog.open) dialog.showModal();
      if (!this.open() && dialog.open) dialog.close();
    });
  }

  protected chooseAccent(value: string): void {
    this.accentChange.emit(value);
  }

  protected onCustomAccent(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.chooseAccent(target.value);
  }

  protected onRootNoteColor(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.rootNoteColorChange.emit(target.value);
  }

  protected onNoteColor(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.noteColorChange.emit(target.value);
  }

  protected onWorkbenchScale(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.workbenchScaleChange.emit(Number(target.value));
  }

  protected chooseStartupMode(value: TunerStartupMode): void {
    this.startupModeChange.emit(value);
  }

  protected toggleInTuneEnabled(): void {
    this.inTuneEnabledChange.emit(!this.tunerSettings().inTune.enabled);
  }

  protected toggleInTuneSound(): void {
    this.inTuneSoundChange.emit(!this.tunerSettings().inTune.sound);
  }

  protected toggleInTuneGlow(): void {
    this.inTuneGlowChange.emit(!this.tunerSettings().inTune.glow);
  }

  protected chooseInTuneColor(value: string): void {
    this.inTuneColorChange.emit(value);
  }

  protected onCustomInTuneColor(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.chooseInTuneColor(target.value);
  }

  protected onTolerance(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.inTuneToleranceChange.emit(Number(target.value));
  }

  protected onHoldMs(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.inTuneHoldMsChange.emit(Number(target.value));
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    this.dismiss.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }
}
