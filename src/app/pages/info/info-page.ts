import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

interface InfoLink {
  readonly path: string;
  readonly label: string;
}

const INFO_LINKS: readonly InfoLink[] = [
  { path: '/about', label: 'About' },
  { path: '/privacy', label: 'Privacy' },
  { path: '/terms', label: 'Terms' },
  { path: '/contact', label: 'Contact' },
];

@Component({
  selector: 'app-info-page',
  imports: [RouterLink],
  templateUrl: './info-page.html',
  styleUrl: './info-page.scss',
})
export class InfoPage {
  readonly kicker = input('');
  readonly title = input.required<string>();
  readonly updated = input('');

  protected readonly links = INFO_LINKS;
}
