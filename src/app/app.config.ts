import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  NavigationError,
  PreloadAllModules,
  Router,
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withNavigationErrorHandler,
  withPreloading,
} from '@angular/router';

import { Capacitor } from '@capacitor/core';

import { routes } from './app.routes';
import { SeoTitleStrategy } from './services/seo-title-strategy';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withComponentInputBinding(),
      withNavigationErrorHandler((error: NavigationError) => {
        const router = inject(Router);
        if (error.url.split('?')[0] === '/error' || router.url.split('?')[0] === '/error') return;
        void router.navigate(['/error'], { queryParams: { attemptedUrl: error.url } });
      }),
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: TitleStrategy, useClass: SeoTitleStrategy },
  ],
};
