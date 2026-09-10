import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';

import { Listbox } from './ui/listbox/listbox';
import { Segmented } from './ui/segmented/segmented';
import { Toggle } from './ui/toggle/toggle';
import { TextField } from './ui/text-field/text-field';
import { IconButton } from './ui/icon-button/icon-button';
import { PillButton } from './ui/pill-button/pill-button';
import { StepButton } from './ui/step-button/step-button';
import { ColorField } from './ui/color-field/color-field';

const ELEMENTS: readonly string[] = ['Peach', 'Plum', 'Lemon', 'Lime'];

@Component({
  selector: 'app-a11y-host',
  template: `
    <app-listbox
      [options]="items"
      [value]="selected()!"
      ariaLabel="Pick a fruit"
      triggerLabel="{{ selected()!.label }}"
      triggerKicker="Fruit"
      [optionLabel]="labelFn"
      [trackByFn]="trackFn"
      [open]="open()"
      (toggle)="open.set(!open())"
    />
    <app-segmented
      [options]="views"
      [value]="seg()"
      ariaLabel="View"
      [optionLabel]="identityFn"
      [trackByFn]="identityFn"
      (select)="seg.set($event)"
    />
    <app-toggle [checked]="toggled()" label="Enable sound" (change)="toggled.set($event)" />
    <app-text-field label="Name" [value]="name()" (valueChange)="name.set($event)" />
    <app-icon-button icon="x" label="Close" (activate)="closed.set(true)" />
    <app-pill-button label="Apply" />
    <app-step-button ariaLabel="Step" [direction]="1" [value]="1" [min]="0" [max]="10" />
    <app-color-field label="Accent color" [value]="color()" (valueChange)="color.set($event)" />
  `,
  imports: [Listbox, Segmented, Toggle, TextField, IconButton, PillButton, StepButton, ColorField],
})
class A11yHost {
  readonly items = ELEMENTS.map((label, id) => ({ id, label }));
  readonly selected = signal({ id: 0, label: 'Peach' });
  readonly open = signal(false);
  readonly views = ['tab', 'dots', 'lines'] as const;
  readonly seg = signal<'tab' | 'dots' | 'lines'>('tab');
  readonly toggled = signal(false);
  readonly name = signal('');
  readonly closed = signal(false);
  readonly stepped = signal(false);
  readonly color = signal('#ff0000');
  readonly labelFn = (f: { id: number; label: string }) => f.label;
  readonly trackFn = (f: { id: number; label: string }) => f.id;
  readonly identityFn = <T>(value: T): T => value;
}

describe('a11y gate (axe)', () => {
  let fixture: ComponentFixture<A11yHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [A11yHost] }).compileComponents();
    fixture = TestBed.createComponent(A11yHost);
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('shared UI primitives have no axe violations', async () => {
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });

  it('open listbox menu has no axe violations', async () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});
