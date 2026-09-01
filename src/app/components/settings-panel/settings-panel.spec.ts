import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';
import { vi } from 'vitest';

import { DEFAULT_TUNER_SETTINGS } from '../../models/tuner-preferences.model';
import { SettingsPanel } from './settings-panel';

const POSITION_KEY = 'omnituner.settings-panel.position.v1';

const createStorageStub = (): Storage => {
  const entries = new Map<string, string>();
  return {
    get length(): number {
      return entries.size;
    },
    clear: (): void => entries.clear(),
    getItem: (key: string): string | null => entries.get(key) ?? null,
    key: (index: number): string | null => [...entries.keys()][index] ?? null,
    removeItem: (key: string): void => {
      entries.delete(key);
    },
    setItem: (key: string, value: string): void => {
      entries.set(key, value);
    },
  };
};

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 800;
const SHEET_WIDTH = 420;
const SHEET_HEIGHT = 760;
const BASE_X = VIEWPORT_WIDTH - SHEET_WIDTH - 12;
const BASE_Y = (VIEWPORT_HEIGHT - SHEET_HEIGHT) / 2;

describe('SettingsPanel', () => {
  let component: SettingsPanel;
  let fixture: ComponentFixture<SettingsPanel>;

  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement): void {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement): void {
      this.open = false;
    };
    vi.stubGlobal('localStorage', createStorageStub());
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SettingsPanel],
    }).compileComponents();
    fixture = TestBed.createComponent(SettingsPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture?.destroy();
    localStorage.clear();
  });

  const stubDimensions = (): void => {
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLElement;
    const sheet = fixture.nativeElement.querySelector('.settings-sheet') as HTMLElement;
    Object.defineProperty(dialog, 'clientWidth', { configurable: true, value: VIEWPORT_WIDTH });
    Object.defineProperty(dialog, 'clientHeight', { configurable: true, value: VIEWPORT_HEIGHT });
    Object.defineProperty(sheet, 'offsetWidth', { configurable: true, value: SHEET_WIDTH });
    Object.defineProperty(sheet, 'offsetHeight', { configurable: true, value: SHEET_HEIGHT });
  };

  const openPanel = async (): Promise<void> => {
    stubDimensions();
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const header = (): HTMLElement =>
    fixture.nativeElement.querySelector('.settings-header') as HTMLElement;

  const sheet = (): HTMLElement =>
    fixture.nativeElement.querySelector('.settings-sheet') as HTMLElement;

  const dragBy = (dx: number, dy: number): void => {
    header().dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      }),
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy }),
    );
    window.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy }),
    );
    fixture.detectChanges();
  };

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has no axe violations while open', async () => {
    await openPanel();
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });

  describe('window placement', () => {
    it('anchors the sheet to the right, vertically centered once open', async () => {
      await openPanel();
      expect(sheet().style.left).toBe(`${BASE_X}px`);
      expect(sheet().style.top).toBe(`${BASE_Y}px`);
      expect(sheet().style.transform).toBe('translate3d(0px, 0px, 0)');
    });

    it('restores a stored position and clamps it to the viewport', async () => {
      localStorage.setItem(POSITION_KEY, JSON.stringify({ x: 5000, y: -9999 }));
      fixture.destroy();
      fixture = TestBed.createComponent(SettingsPanel);
      component = fixture.componentInstance;
      await fixture.whenStable();
      await openPanel();
      expect(sheet().style.transform).toBe(`translate3d(12px, ${-BASE_Y}px, 0)`);
    });

    it('falls back to the default position for invalid stored data', async () => {
      localStorage.setItem(POSITION_KEY, 'not-json');
      fixture.destroy();
      fixture = TestBed.createComponent(SettingsPanel);
      component = fixture.componentInstance;
      await fixture.whenStable();
      await openPanel();
      expect(sheet().style.transform).toBe('translate3d(0px, 0px, 0)');
    });

    it('re-clamps the position when the viewport shrinks', async () => {
      await openPanel();
      dragBy(-400, 0);
      const dialog = fixture.nativeElement.querySelector('dialog') as HTMLElement;
      Object.defineProperty(dialog, 'clientWidth', { configurable: true, value: 800 });
      window.dispatchEvent(new Event('resize'));
      fixture.detectChanges();
      expect(sheet().style.transform).toBe('translate3d(-368px, 0px, 0)');
    });
  });

  describe('pointer dragging', () => {
    it('moves the window after the drag threshold and persists the position', async () => {
      await openPanel();
      dragBy(-60, 10);
      expect(sheet().style.transform).toBe('translate3d(-60px, 10px, 0)');
      expect(JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null')).toEqual({ x: -60, y: 10 });
    });

    it('ignores movement below the drag threshold and persists nothing', async () => {
      await openPanel();
      dragBy(2, 1);
      expect(sheet().style.transform).toBe('translate3d(0px, 0px, 0)');
      expect(localStorage.getItem(POSITION_KEY)).toBeNull();
    });

    it('clamps the drag so the window stays inside the viewport', async () => {
      await openPanel();
      dragBy(-5000, 2000);
      const maxY = VIEWPORT_HEIGHT - SHEET_HEIGHT - BASE_Y;
      expect(sheet().style.transform).toBe(`translate3d(${-BASE_X}px, ${maxY}px, 0)`);
    });

    it('does not start dragging from the close button', async () => {
      await openPanel();
      const closeButton = header().querySelector('button') as HTMLElement;
      closeButton.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          pointerId: 3,
          clientX: 100,
          clientY: 100,
        }),
      );
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 3, clientX: 200, clientY: 200 }),
      );
      window.dispatchEvent(
        new PointerEvent('pointerup', { pointerId: 3, clientX: 200, clientY: 200 }),
      );
      expect(sheet().style.transform).toBe('translate3d(0px, 0px, 0)');
      expect(localStorage.getItem(POSITION_KEY)).toBeNull();
    });

    it('releases the body user-select lock when the drag ends', async () => {
      await openPanel();
      dragBy(30, 30);
      expect(document.body.style.userSelect).toBe('');
    });
  });

  describe('keyboard moving', () => {
    it('moves the window with arrow keys and persists the position', async () => {
      await openPanel();
      header().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      header().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(sheet().style.transform).toBe('translate3d(-20px, -20px, 0)');
      expect(JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null')).toEqual({ x: -20, y: -20 });
    });

    it('ignores non-arrow keys', async () => {
      await openPanel();
      header().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(sheet().style.transform).toBe('translate3d(0px, 0px, 0)');
      expect(localStorage.getItem(POSITION_KEY)).toBeNull();
    });
  });

  it('resets the window position on header double-click', async () => {
    await openPanel();
    dragBy(80, 50);
    header().dispatchEvent(new Event('dblclick'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(sheet().style.transform).toBe('translate3d(0px, 0px, 0)');
    expect(JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null')).toEqual({ x: 0, y: 0 });
  });

  it('dismisses on backdrop click but not on clicks inside the window', async () => {
    await openPanel();
    let dismissed = false;
    component.dismiss.subscribe(() => (dismissed = true));
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLElement;
    dialog.dispatchEvent(new MouseEvent('click'));
    expect(dismissed).toBe(true);
    dismissed = false;
    header().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dismissed).toBe(false);
  });

  it('renders the auto-start toggle state and emits changes', async () => {
    await openPanel();
    fixture.componentRef.setInput('tunerSettings', {
      ...DEFAULT_TUNER_SETTINGS,
      autoStart: false,
    });
    fixture.detectChanges();

    const row = [...fixture.nativeElement.querySelectorAll('.toggle-row')].find((el) =>
      el.textContent?.includes('Start tuner automatically'),
    ) as HTMLElement;
    const toggleButton = row.querySelector('button') as HTMLButtonElement;
    expect(toggleButton.getAttribute('aria-checked')).toBe('false');

    let emitted: boolean | null = null;
    component.autoStartChange.subscribe((value) => (emitted = value));
    toggleButton.click();
    expect(emitted).toBe(true);
  });
});
