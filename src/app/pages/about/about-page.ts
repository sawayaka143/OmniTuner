import { Component } from '@angular/core';

import { REPO_URL } from '../../data/site.constants';
import { InfoPage } from '../info/info-page';

@Component({
  selector: 'app-about-page',
  imports: [InfoPage],
  templateUrl: './about-page.html',
  styleUrl: './about-page.scss',
})
export class AboutPage {
  protected readonly repoUrl = REPO_URL;
}
