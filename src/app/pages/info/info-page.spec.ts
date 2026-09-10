import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { axe } from 'vitest-axe';

import { InfoPage } from './info-page';

describe('InfoPage', () => {
  let fixture: ComponentFixture<InfoPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoPage);
    fixture.componentRef.setInput('kicker', 'About');
    fixture.componentRef.setInput('title', 'About OmniTuner');
    fixture.componentRef.setInput('updated', 'September 2026');
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('renders the kicker, heading and updated line', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('About');
    expect(text).toContain('About OmniTuner');
    expect(text).toContain('September 2026');
  });

  it('links to the other content pages from the footer', () => {
    const links = fixture.nativeElement.querySelectorAll('.info-footer a');
    expect(links.length).toBe(4);
  });

  it('renders no footer updated line when none is supplied', () => {
    fixture.componentRef.setInput('updated', '');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.info-updated')).toBeNull();
  });

  it('has no axe violations', async () => {
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});
