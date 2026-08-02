import { Component, input, output } from '@angular/core';
import { TuningString } from '../../models/instrument.model';

@Component({
  selector: 'app-string-list',
  templateUrl: './string-list.html',
  styleUrl: './string-list.scss',
})
export class StringList {
  readonly strings = input.required<readonly TuningString[]>();
  readonly activeString = input<string | null>(null);
  readonly inTune = input(false);
  readonly select = output<number>();
}
