import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'tuner', pathMatch: 'full' },
  {
    path: 'tuner',
    loadComponent: () => import('./audio-monitor/audio-monitor').then((c) => c.AudioMonitor),
  },
  {
    path: 'scales',
    loadComponent: () => import('./scales/scales').then((c) => c.Scales),
  },
  { path: '**', redirectTo: 'tuner' },
];
