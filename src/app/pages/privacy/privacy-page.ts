import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PUBLISHER_NAME } from '../../data/site.constants';
import { InfoPage } from '../info/info-page';

@Component({
  selector: 'app-privacy-page',
  imports: [InfoPage, RouterLink],
  templateUrl: './privacy-page.html',
  styleUrl: './privacy-page.scss',
})
export class PrivacyPage {
  protected readonly publisher = PUBLISHER_NAME;
}
