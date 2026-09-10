import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { axe } from 'vitest-axe';

import { AboutPage } from './about-page';

describe('AboutPage', () => {
  let fixture: ComponentFixture<AboutPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AboutPage);
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('describes the four tools and links to the source repository', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Tuner');
    expect(text).toContain('Scales');
    expect(text).toContain('Chords');
    expect(text).toContain('Metronome');
    expect(fixture.nativeElement.querySelector('a[href^="https://github.com/"]')).not.toBeNull();
  });

  it('has no axe violations', async () => {
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});
