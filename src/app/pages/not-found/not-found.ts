import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorPage } from '../error/error-page';

@Component({
  selector: 'app-not-found',
  imports: [ErrorPage],
  template: `
    <app-error-page
      code="404"
      icon="ti-music-off"
      title="Page not found"
      description="The page you're looking for doesn't exist or may have moved."
      [attemptedUrl]="attemptedUrl"
    />
  `,
})
export class NotFound {
  private readonly router = inject(Router);

  protected get attemptedUrl(): string | null {
    return this.router.url || null;
  }
}
