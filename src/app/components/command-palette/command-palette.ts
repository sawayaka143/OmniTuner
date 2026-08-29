import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import { ScalePreferences } from '../../services/scale-preferences';
import { ThemeService } from '../../services/theme.service';
import { FLAT_NAMES, SHARP_NAMES } from '../../data/scale.constants';

type CommandGroup = 'Go to' | 'Root note' | 'Theme';

interface Command {
  readonly id: string;
  readonly group: CommandGroup;
  readonly label: string;
  readonly icon: string;
  readonly hint: string | null;
  readonly run: () => void;
}

const PAGE_COMMANDS: readonly {
  readonly id: string;
  readonly label: string;
  readonly route: string;
  readonly icon: string;
}[] = [
  { id: 'go-tuner', label: 'Go to Tuner', route: '/tuner', icon: 'ti-wave-sine' },
  { id: 'go-chords', label: 'Go to Chords', route: '/chords', icon: 'ti-grid-dots' },
  { id: 'go-scales', label: 'Go to Scales', route: '/scales', icon: 'ti-music' },
  { id: 'go-metronome', label: 'Go to Metronome', route: '/metronome', icon: 'ti-metronome' },
];

@Component({
  selector: 'app-command-palette',
  imports: [],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
})
export class CommandPalette {
  private readonly router = inject(Router);
  private readonly preferences = inject(ScalePreferences);
  private readonly themeService = inject(ThemeService);

  readonly open = input(false);
  readonly dismiss = output<void>();

  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly optionEls = viewChildren<ElementRef<HTMLLIElement>>('option');

  private readonly preferencesState = this.preferences.state;

  protected readonly commands = computed<readonly Command[]>(() => {
    const state = this.preferencesState();
    const noteNames = state.accidental === 'flat' ? FLAT_NAMES : SHARP_NAMES;

    return [
      ...PAGE_COMMANDS.map((page) => ({
        id: page.id,
        group: 'Go to' as const,
        label: page.label,
        icon: page.icon,
        hint: null,
        run: () => void this.router.navigate([page.route]),
      })),
      ...noteNames.map((name, pitchClass) => ({
        id: `root-${pitchClass}`,
        group: 'Root note' as const,
        label: `Root note: ${name}`,
        icon: 'ti-music',
        hint: state.rootPitchClass === pitchClass ? 'Current' : null,
        run: () => this.preferences.setRootPitchClass(pitchClass),
      })),
      {
        id: 'theme-toggle',
        group: 'Theme',
        label: 'Toggle theme',
        icon: this.themeService.theme() === 'dark' ? 'ti-moon' : 'ti-sun',
        hint: null,
        run: () => this.themeService.toggle(),
      },
      {
        id: 'theme-dark',
        group: 'Theme',
        label: 'Use dark theme',
        icon: 'ti-moon',
        hint: this.themeService.theme() === 'dark' ? 'Current' : null,
        run: () => this.themeService.setTheme('dark'),
      },
      {
        id: 'theme-light',
        group: 'Theme',
        label: 'Use light theme',
        icon: 'ti-sun',
        hint: this.themeService.theme() === 'light' ? 'Current' : null,
        run: () => this.themeService.setTheme('light'),
      },
    ];
  });

  protected readonly filteredCommands = computed<readonly Command[]>(() => {
    const needle = this.query().trim().toLowerCase();
    const commands = this.commands();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.group} ${command.label}`.toLowerCase().includes(needle),
    );
  });

  protected readonly activeOptionId = computed(() => {
    const command = this.filteredCommands()[this.activeIndex()];
    return command ? `palette-option-${command.id}` : null;
  });

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.open() && !dialog.open) {
        this.query.set('');
        this.activeIndex.set(0);
        dialog.showModal();
        this.input()?.nativeElement.focus();
      }
      if (!this.open() && dialog.open) dialog.close();
    });

    effect(() => {
      if (this.activeIndex() >= this.filteredCommands().length) this.activeIndex.set(0);
    });

    effect(() => {
      const option = this.optionEls()[this.activeIndex()]?.nativeElement;
      if (option && typeof option.scrollIntoView === 'function') {
        option.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    this.dismiss.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    const commands = this.filteredCommands();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (commands.length > 0) {
        this.activeIndex.update((index) => (index + 1) % commands.length);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (commands.length > 0) {
        this.activeIndex.update((index) => (index - 1 + commands.length) % commands.length);
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.activeIndex.set(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.activeIndex.set(Math.max(0, commands.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = commands[this.activeIndex()];
      if (command) this.runCommand(command);
    }
  }

  protected runCommand(command: Command): void {
    this.requestDismiss();
    command.run();
  }
}
