import { Component } from '@angular/core';
import { AppShell } from './components/app-shell/app-shell';

@Component({
  selector: 'app-root',
  imports: [AppShell],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
