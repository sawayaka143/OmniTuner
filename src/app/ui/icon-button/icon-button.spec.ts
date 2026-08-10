import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IconButton } from './icon-button';

describe('IconButton', () => {
  let fixture: ComponentFixture<IconButton>;
  let button: HTMLButtonElement;
  let iconSpan: HTMLSpanElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [IconButton] }).compileComponents();
    fixture = TestBed.createComponent(IconButton);
    fixture.componentRef.setInput('icon', 'close');
    fixture.componentRef.setInput('label', 'Close');
    await fixture.whenStable();
    button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    iconSpan = button.querySelector('.material-symbols-outlined') as HTMLSpanElement;
  });

  afterEach(() => fixture?.destroy());

  it('renders the icon glyph inside a material-symbols-outlined span', () => {
    expect(iconSpan.textContent).toBe('close');
    expect(iconSpan.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses the label as aria-label', () => {
    expect(button.getAttribute('aria-label')).toBe('Close');
  });

  it('omits the title attribute by default', () => {
    expect(button.hasAttribute('title')).toBe(false);
  });

  it('mirrors the label to title when showTitle is true', () => {
    fixture.componentRef.setInput('showTitle', true);
    fixture.detectChanges();
    expect(button.getAttribute('title')).toBe('Close');
  });

  it('applies the size-sm class for the compact variant', () => {
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    expect(button.classList.contains('size-sm')).toBe(true);
  });

  it('applies the danger class and keeps aria-label untouched', () => {
    fixture.componentRef.setInput('danger', true);
    fixture.detectChanges();
    expect(button.classList.contains('danger')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Close');
  });

  it('disables the native button when disabled is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
  });

  it('emits activate on click', () => {
    let calls = 0;
    fixture.componentInstance.activate.subscribe(() => (calls += 1));
    button.click();
    expect(calls).toBe(1);
  });

  it('does not emit activate while disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    let calls = 0;
    fixture.componentInstance.activate.subscribe(() => (calls += 1));
    button.click();
    expect(calls).toBe(0);
  });

  it('applies the ghost class and removes the border when variant is ghost', () => {
    fixture.componentRef.setInput('variant', 'ghost');
    fixture.detectChanges();
    expect(button.classList.contains('ghost')).toBe(true);
  });

  it('stops click propagation when stopClickPropagation is true', () => {
    let reachedParent = false;
    const parent = document.createElement('div');
    parent.addEventListener('click', () => {
      reachedParent = true;
    });
    parent.appendChild(button);

    fixture.componentRef.setInput('stopClickPropagation', true);
    fixture.detectChanges();
    button.click();
    expect(reachedParent).toBe(false);
  });

  it('does not stop click propagation by default', () => {
    let reachedParent = false;
    const parent = document.createElement('div');
    parent.addEventListener('click', () => {
      reachedParent = true;
    });
    parent.appendChild(button);

    button.click();
    expect(reachedParent).toBe(true);
  });
});