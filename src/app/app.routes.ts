import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'tuner', pathMatch: 'full' },
  {
    path: 'tuner',
    title: 'Tuner · OmniTuner',
    data: {
      seoDescription:
        'Tune any instrument with real-time pitch detection, a precise cents readout, and automatic or manual string targeting.',
    },
    loadComponent: () => import('./audio-monitor/audio-monitor').then((c) => c.AudioMonitor),
  },
  {
    path: 'scales',
    title: 'Scales · OmniTuner',
    data: {
      seoDescription:
        'Explore scales on an interactive fretboard for any root note and tuning, with playback and note or degree labels.',
    },
    loadComponent: () => import('./scales/scales').then((c) => c.Scales),
  },
  {
    path: 'chords',
    title: 'Chords · OmniTuner',
    data: {
      seoDescription:
        'Find chord voicings across your tuning, view them as tab, dots, or a neck diagram, and build progressions.',
    },
    loadComponent: () => import('./chord-finder/chord-finder').then((c) => c.ChordFinder),
  },
  {
    path: 'metronome',
    title: 'Metronome · OmniTuner',
    data: {
      seoDescription:
        'Practice with a precise metronome: tap tempo, meter and polyrhythm patterns, count-in, and per-role sounds.',
    },
    loadComponent: () => import('./metronome/metronome').then((c) => c.Metronome),
  },
  {
    path: 'about',
    title: 'About · OmniTuner',
    data: {
      seoDescription:
        'OmniTuner is a free, installable practice workbench for guitar and other instruments — tuner, scales, chords, and metronome in one web app.',
    },
    loadComponent: () => import('./pages/about/about-page').then((c) => c.AboutPage),
  },
  {
    path: 'privacy',
    title: 'Privacy Policy · OmniTuner',
    data: {
      seoDescription:
        'How OmniTuner handles your data: audio is analysed on your device and never uploaded, with no accounts, cookies, or analytics.',
    },
    loadComponent: () => import('./pages/privacy/privacy-page').then((c) => c.PrivacyPage),
  },
  {
    path: 'terms',
    title: 'Terms of Service · OmniTuner',
    data: {
      seoDescription: 'The terms that govern your use of the OmniTuner web app.',
    },
    loadComponent: () => import('./pages/terms/terms-page').then((c) => c.TermsPage),
  },
  {
    path: 'contact',
    title: 'Contact & feedback · OmniTuner',
    data: {
      seoDescription:
        'Report a bug, request a feature, or ask for help with OmniTuner on GitHub or by email.',
    },
    loadComponent: () => import('./pages/contact/contact-page').then((c) => c.ContactPage),
  },
  {
    path: 'error',
    loadComponent: () => import('./pages/error/error-page').then((c) => c.ErrorPage),
    title: 'Something went wrong · OmniTuner',
    data: {
      code: 'Oops',
      icon: 'ti-alert-triangle',
      title: 'Something went wrong',
      description:
        'The page failed to load. This can happen right after an app update — reload to get the latest version.',
      showReload: true,
      seoDescription: 'The page failed to load.',
      robots: 'noindex',
    },
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((c) => c.NotFound),
    title: 'Page not found · OmniTuner',
    data: {
      seoDescription: 'The page you were looking for could not be found.',
      robots: 'noindex',
    },
  },
];
