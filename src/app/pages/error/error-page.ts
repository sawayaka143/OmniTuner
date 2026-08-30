import { Component, inject, input } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';

export function reloadTarget(url: string | null): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//')) return null;
  return url;
}

@Component({
  selector: 'app-error-page',
  imports: [RouterLink],
  templateUrl: './error-page.html',
  styleUrl: './error-page.scss',
})
export class ErrorPage {
  private readonly document = inject(DOCUMENT);

  readonly code = input('Error');
  readonly title = input('Something went wrong');
  readonly description = input(
    'An unexpected problem occurred. You can try again or head back to the tuner.',
  );
  readonly icon = input('ti-alert-triangle');
  readonly attemptedUrl = input<string | null>(null);
  readonly showReload = input(false);

  protected reload(): void {
    const view = this.document.defaultView;
    if (!view) return;
    const target = reloadTarget(this.attemptedUrl());
    if (target) {
      view.location.assign(target);
      return;
    }
    view.location.reload();
  }
}
