import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  Router,
  RouterOutlet,
  provideRouter,
  withDisabledInitialNavigation,
} from '@angular/router';
import { axe } from 'vitest-axe';

import { routes } from '../../app.routes';
import { NotFound } from './not-found';

@Component({
  selector: 'app-nf-host',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
class NfHost {}

@Component({
  selector: 'app-tuner-stub',
  template: `<p>tuner</p>`,
})
class TunerStub {}

describe('NotFound route', () => {
  let fixture: ComponentFixture<NfHost>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NfHost],
      providers: [provideRouter(routes, withDisabledInitialNavigation())],
    }).compileComponents();
    fixture = TestBed.createComponent(NfHost);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('renders the 404 page with the attempted URL, page title and no reload action', async () => {
    await router.navigateByUrl('/definitely-not-a-page?via=link');
    fixture.detectChanges();

    const el = fixture.nativeElement;
    expect(el.querySelector('.error-code')?.textContent.trim()).toBe('404');
    expect(el.querySelector('.error-url code')?.textContent.trim()).toBe(
      '/definitely-not-a-page?via=link',
    );
    expect(el.querySelector('a.btn.primary')?.getAttribute('href')).toBe('/tuner');
    expect(el.querySelector('button.btn')).toBeNull();
    expect(document.title).toBe('Page not found · OmniTuner');
  });

  it('has no axe violations', async () => {
    await router.navigateByUrl('/definitely-not-a-page');
    fixture.detectChanges();

    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});

describe('NotFound recovery link', () => {
  let fixture: ComponentFixture<NfHost>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NfHost, TunerStub],
      providers: [
        provideRouter([
          { path: 'tuner', component: TunerStub },
          { path: '**', component: NotFound },
        ]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NfHost);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('navigates back to the tuner', async () => {
    await router.navigateByUrl('/nope');
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a.btn.primary') as HTMLAnchorElement;
    link.click();
    await fixture.whenStable();

    expect(router.url).toBe('/tuner');
  });
});
