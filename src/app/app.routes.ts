import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'tuner', pathMatch: 'full' },
  {
    path: 'tuner',
    title: 'Tuner · OmniTuner',
    loadComponent: () => import('./audio-monitor/audio-monitor').then((c) => c.AudioMonitor),
  },
  {
    path: 'scales',
    title: 'Scales · OmniTuner',
    loadComponent: () => import('./scales/scales').then((c) => c.Scales),
  },
  {
    path: 'chords',
    title: 'Chords · OmniTuner',
    loadComponent: () => import('./chord-finder/chord-finder').then((c) => c.ChordFinder),
  },
  {
    path: 'metronome',
    title: 'Metronome · OmniTuner',
    loadComponent: () => import('./metronome/metronome').then((c) => c.Metronome),
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
    },
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((c) => c.NotFound),
    title: 'Page not found · OmniTuner',
  },
];
