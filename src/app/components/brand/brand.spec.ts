import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Brand } from './brand';

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage(): void {}
  terminate(): void {}
}

describe('Brand', () => {
  let component: Brand;
  let fixture: ComponentFixture<Brand>;

  beforeEach(async () => {
    globalThis.Worker = MockWorker as unknown as typeof Worker;
    await TestBed.configureTestingModule({
      imports: [Brand],
    }).compileComponents();

    fixture = TestBed.createComponent(Brand);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the app icon logo beside the wordmark', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img.logo')).toBeTruthy();
    expect(el.querySelector('.wordmark')?.textContent).toContain('OmniTuner');
  });
});
