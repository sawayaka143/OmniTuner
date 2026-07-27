import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-custom-tuning',
  templateUrl: './custom-tuning.html',
  styleUrl: './custom-tuning.scss',
})
export class CustomTuning {
  readonly values = input.required<readonly string[]>();
  readonly errors = input.required<readonly boolean[]>();

  readonly change = output<{ index: number; value: string }>();

  protected onInput(event: Event, index: number): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.change.emit({ index, value: target.value });
    }
  }
}