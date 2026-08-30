import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { axe } from 'vitest-axe';

import { ErrorPage, reloadTarget } from './error-page';

describe('ErrorPage', () => {
  let fixture: ComponentFixture<ErrorPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  it('renders the configured code, title and description', () => {
    fixture = TestBed.createComponent(ErrorPage);
    fixture.componentRef.setInput('code', '404');
    fixture.componentRef.setInput('title', 'Page not found');
    fixture.componentRef.setInput('description', 'Nothing here.');
    fixture.detectChanges();

    const el = fixture.nativeElement;
    expect(el.querySelector('.error-code')?.textContent.trim()).toBe('404');
    expect(el.querySelector('.error-title')?.textContent.trim()).toBe('Page not found');
    expect(el.querySelector('.error-desc')?.textContent.trim()).toBe('Nothing here.');
  });

  it('hides the reload button and requested URL by default', () => {
    fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();

    const el = fixture.nativeElement;
    expect(el.querySelector('button.btn')).toBeNull();
    expect(el.querySelector('.error-url')).toBeNull();
  });

  it('shows the reload button and requested page only when configured', () => {
    fixture = TestBed.createComponent(ErrorPage);
    fixture.componentRef.setInput('attemptedUrl', '/bogus?x=1');
    fixture.componentRef.setInput('showReload', true);
    fixture.detectChanges();

    const el = fixture.nativeElement;
    expect(el.querySelector('a.btn.primary')?.textContent).toContain('Go to Tuner');
    expect(el.querySelector('a.btn.primary')?.getAttribute('href')).toBe('/tuner');
    expect(el.querySelector('button.btn')?.textContent).toContain('Reload page');
    expect(el.querySelector('.error-url code')?.textContent.trim()).toBe('/bogus?x=1');
  });

  it('has no axe violations with reload and requested URL visible', async () => {
    fixture = TestBed.createComponent(ErrorPage);
    fixture.componentRef.setInput('code', '404');
    fixture.componentRef.setInput('title', 'Page not found');
    fixture.componentRef.setInput('attemptedUrl', '/bogus?x=1');
    fixture.componentRef.setInput('showReload', true);
    fixture.detectChanges();

    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});

describe('reloadTarget', () => {
  it('accepts root-relative app paths', () => {
    expect(reloadTarget('/tuner?via=error')).toBe('/tuner?via=error');
  });

  it('rejects null and non-app URLs', () => {
    expect(reloadTarget(null)).toBeNull();
    expect(reloadTarget('//evil.example/tuner')).toBeNull();
    expect(reloadTarget('https://evil.example')).toBeNull();
  });
});
