import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./audio-monitor/audio-monitor').then(c => c.AudioMonitor),
  },
];
