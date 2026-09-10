import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { axe } from 'vitest-axe';

import { ContactPage } from './contact-page';

describe('ContactPage', () => {
  let fixture: ComponentFixture<ContactPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactPage);
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('offers both a GitHub issues link and a mailto link', () => {
    expect(fixture.nativeElement.querySelector('a[href$="/issues"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href^="mailto:"]')).not.toBeNull();
  });

  it('has no axe violations', async () => {
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});
