import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage(): void {}
  terminate(): void {}
}

describe('App', () => {
  beforeEach(async () => {
    globalThis.Worker = MockWorker as unknown as typeof Worker;
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
