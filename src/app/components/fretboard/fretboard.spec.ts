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

  it('scales down to fit without scaling above 100%', async () => {
    const container = fixture!.nativeElement.querySelector('.fretboard-scroll') as HTMLElement;
    const frame = fixture!.nativeElement.querySelector('.fretboard-scale-frame') as HTMLElement;
    const board = fixture!.nativeElement.querySelector('.fretboard') as HTMLElement;
    let availableWidth = 300;

    container.style.padding = '0';
    Object.defineProperty(container, 'clientWidth', {
      configurable: true,
      get: () => availableWidth,
    });
    Object.defineProperty(board, 'offsetWidth', { configurable: true, value: 600 });
    Object.defineProperty(board, 'offsetHeight', { configurable: true, value: 300 });

    ResizeObserverMock.latest?.trigger();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(board.style.transform).toBe('scale(0.5)');
    expect(frame.style.width).toBe('300px');
    expect(frame.style.height).toBe('150px');

    availableWidth = 800;
    ResizeObserverMock.latest?.trigger();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(board.style.transform).toBe('scale(1)');
    expect(frame.style.width).toBe('600px');
    expect(frame.style.height).toBe('300px');
  });

  it('disconnects its container observer on destroy', () => {
    const observer = ResizeObserverMock.latest;

    fixture?.destroy();
    fixture = null;

    expect(observer?.disconnected).toBe(true);
  });
});
