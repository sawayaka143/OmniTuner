import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { axe } from 'vitest-axe';

import { TermsPage } from './terms-page';

describe('TermsPage', () => {
  let fixture: ComponentFixture<TermsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermsPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TermsPage);
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('covers the as-is warranty position and acceptable use', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('as is');
    expect(text).toContain('Acceptable use');
    expect(text).toContain('Limitation of liability');
  });

  it('has no axe violations', async () => {
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});
