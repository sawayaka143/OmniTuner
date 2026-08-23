import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FretCell } from '../../models/scale.model';
import { Fretboard } from './fretboard';

const createCell = (fret: number, midi: number): FretCell => ({
  stringIndex: 0,
  fret,
  pitchClass: 4,
  midi,
  interval: { semitones: 0, label: '1' },
  noteName: 'E',
  color: '#ffffff',
  isRoot: true,
});

const ACTIVE_CELL = createCell(0, 40);
const OCTAVE_CELL = createCell(1, 52);

/** A fret-1 cell whose pitch is not part of the current scale. */
const OUTSIDE_CELL: FretCell = {
  stringIndex: 0,
  fret: 1,
  pitchClass: 5,
  midi: 41,
  interval: null,
  noteName: 'F',
  color: '',
  isRoot: false,
};

/** An open-string (fret 0) cell outside the scale. */
const OPEN_OUTSIDE_CELL: FretCell = {
  stringIndex: 0,
  fret: 0,
  pitchClass: 5,
  midi: 41,
  interval: null,
  noteName: 'F',
  color: '',
  isRoot: false,
};

/** An in-scale root cell at fret 1. */
const IN_SCALE_CELL: FretCell = {
  stringIndex: 0,
  fret: 1,
  pitchClass: 4,
  midi: 41,
  interval: { semitones: 0, label: '1' },
  noteName: 'E',
  color: '#779900',
  isRoot: true,
};

/** A non-root in-scale cell at fret 1, used to verify label mode. */
const THIRD_CELL: FretCell = {
  stringIndex: 0,
  fret: 1,
  pitchClass: 7,
  midi: 41,
  interval: { semitones: 3, label: '♭3' },
  noteName: 'G',
  color: '#cc4422',
  isRoot: false,
};

class ResizeObserverMock implements ResizeObserver {
  static latest: ResizeObserverMock | null = null;

  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverMock.latest = this;
  }

  observe(): void {}

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(): void {
    this.callback([], this);
  }
}

describe('Fretboard', () => {
  let fixture: ComponentFixture<Fretboard> | null;
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(async () => {
    ResizeObserverMock.latest = null;
    globalThis.ResizeObserver = ResizeObserverMock;

    await TestBed.configureTestingModule({ imports: [Fretboard] }).compileComponents();

    fixture = TestBed.createComponent(Fretboard);
    fixture.componentRef.setInput('cells', [[ACTIVE_CELL, OCTAVE_CELL]]);
    fixture.componentRef.setInput('fretCount', 1);
    fixture.componentRef.setInput('scaleLabel', 'Major');
    fixture.componentRef.setInput('rootLabel', 'E');
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture?.destroy();
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it('highlights only the active fretboard position', async () => {
    fixture?.componentRef.setInput('activeCell', ACTIVE_CELL);
    await fixture?.whenStable();

    const notes = [...fixture!.nativeElement.querySelectorAll('.fret-dot')] as HTMLButtonElement[];
    expect(notes[0].classList.contains('sounding')).toBe(true);
    expect(notes[1].classList.contains('sounding')).toBe(false);
  });

  it('emits the clicked cell through play', () => {
    const played: FretCell[] = [];
    fixture!.componentInstance.play.subscribe((cell) => played.push(cell));

    const dots = [...fixture!.nativeElement.querySelectorAll('.fret-dot')] as HTMLButtonElement[];
    dots[1].click();

    expect(played).toEqual([OCTAVE_CELL]);
  });

  it('emits inspect on hover and clears on leave', () => {
    const inspected: (FretCell | null)[] = [];
    fixture!.componentInstance.inspect.subscribe((cell) => inspected.push(cell));

    const dots = [...fixture!.nativeElement.querySelectorAll('.fret-dot')] as HTMLButtonElement[];
    dots[1].dispatchEvent(new MouseEvent('mouseenter'));
    dots[1].dispatchEvent(new MouseEvent('mouseleave'));

    expect(inspected).toEqual([OCTAVE_CELL, null]);
  });

  it('emits inspect on focus and clears on blur', () => {
    const inspected: (FretCell | null)[] = [];
    fixture!.componentInstance.inspect.subscribe((cell) => inspected.push(cell));

    const dots = [...fixture!.nativeElement.querySelectorAll('.fret-dot')] as HTMLButtonElement[];
    dots[0].dispatchEvent(new Event('focus'));
    dots[0].dispatchEvent(new Event('blur'));

    expect(inspected).toEqual([ACTIVE_CELL, null]);
  });

  it('shows note names in note-names mode', async () => {
    fixture!.componentRef.setInput('cells', [[ACTIVE_CELL, THIRD_CELL]]);
    await fixture!.whenStable();

    const texts = [...fixture!.nativeElement.querySelectorAll('.fret-dot')].map((d) =>
      (d as HTMLButtonElement).textContent?.trim(),
    );
    expect(texts).toEqual(['E', 'G']);
  });

  it('shows interval labels in scale-degrees mode', async () => {
    fixture!.componentRef.setInput('cells', [[ACTIVE_CELL, THIRD_CELL]]);
    fixture!.componentRef.setInput('labelMode', 'scale-degrees');
    await fixture!.whenStable();

    const texts = [...fixture!.nativeElement.querySelectorAll('.fret-dot')].map((d) =>
      (d as HTMLButtonElement).textContent?.trim(),
    );
    expect(texts).toEqual(['1', '♭3']);
  });

  it('renders a ghost button for out-of-scale cells when showOutsideScale is true', async () => {
    fixture!.componentRef.setInput('cells', [[ACTIVE_CELL, OUTSIDE_CELL]]);
    fixture!.componentRef.setInput('showOutsideScale', true);
    await fixture!.whenStable();

    expect(fixture!.nativeElement.querySelectorAll('.fret-dot.is-ghost').length).toBe(1);
  });

  it('emits play for an out-of-scale ghost cell', async () => {
    fixture!.componentRef.setInput('cells', [[ACTIVE_CELL, OUTSIDE_CELL]]);
    fixture!.componentRef.setInput('showOutsideScale', true);
    await fixture!.whenStable();

    const played: FretCell[] = [];
    fixture!.componentInstance.play.subscribe((cell) => played.push(cell));

    const ghost = fixture!.nativeElement.querySelector('.fret-dot.is-ghost') as HTMLButtonElement;
    ghost.click();

    expect(played).toEqual([OUTSIDE_CELL]);
  });

  it('labels the open string for assistive tech when it is outside the scale', async () => {
    fixture!.componentRef.setInput('cells', [[OPEN_OUTSIDE_CELL, IN_SCALE_CELL]]);
    await fixture!.whenStable();

    const openNote = fixture!.nativeElement.querySelector('.open-note') as HTMLElement;
    expect(openNote.getAttribute('role')).toBe('img');
    expect(openNote.getAttribute('aria-label')).toBe('Open string: F');
  });

  it('does not add an img role when the open string has an in-scale play button', () => {
    const openNote = fixture!.nativeElement.querySelector('.open-note') as HTMLElement;
    expect(openNote.getAttribute('role')).toBeNull();
    expect(openNote.getAttribute('aria-label')).toBeNull();
  });

  it('does not add an img role when showOutsideScale renders a ghost on the open string', async () => {
    fixture!.componentRef.setInput('cells', [[OPEN_OUTSIDE_CELL, IN_SCALE_CELL]]);
    fixture!.componentRef.setInput('showOutsideScale', true);
    await fixture!.whenStable();

    const openNote = fixture!.nativeElement.querySelector('.open-note') as HTMLElement;
    expect(openNote.getAttribute('role')).toBeNull();
    expect(openNote.getAttribute('aria-label')).toBeNull();
    expect(openNote.querySelector('.fret-dot.is-ghost')).toBeTruthy();
  });

  it('scales the board down to fit a narrow container', async () => {
    const container = fixture!.nativeElement.querySelector('.fretboard-scroll') as HTMLElement;
    const frame = fixture!.nativeElement.querySelector('.fretboard-scale-frame') as HTMLElement;
    const board = fixture!.nativeElement.querySelector('.fretboard') as HTMLElement;
    const availableWidth = 300;

    container.style.padding = '0';
    Object.defineProperty(container, 'clientWidth', {
      configurable: true,
      get: () => availableWidth,
    });
    Object.defineProperty(board, 'offsetWidth', { configurable: true, value: 600 });
    Object.defineProperty(board, 'offsetHeight', { configurable: true, value: 300 });

    ResizeObserverMock.latest?.trigger();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(board.style.transform).toBe('translateY(75px) scale(0.5)');
    expect(frame.style.width).toBe('300px');
    expect(frame.style.height).toBe('300px');
  });

  it('does not scale the board when there is room to spare', async () => {
    const container = fixture!.nativeElement.querySelector('.fretboard-scroll') as HTMLElement;
    const board = fixture!.nativeElement.querySelector('.fretboard') as HTMLElement;

    container.style.padding = '0';
    Object.defineProperty(container, 'clientWidth', {
      configurable: true,
      get: () => 800,
    });
    Object.defineProperty(board, 'offsetWidth', { configurable: true, value: 600 });
    Object.defineProperty(board, 'offsetHeight', { configurable: true, value: 300 });

    ResizeObserverMock.latest?.trigger();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(board.style.transform).toBe('translateY(0px) scale(1)');
  });

  it('disconnects its container observer on destroy', () => {
    const observer = ResizeObserverMock.latest;

    fixture?.destroy();
    fixture = null;

    expect(observer?.disconnected).toBe(true);
  });
});

