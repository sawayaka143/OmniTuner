import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PUBLISHER_NAME } from '../../data/site.constants';
import { InfoPage } from '../info/info-page';

@Component({
  selector: 'app-terms-page',
  imports: [InfoPage, RouterLink],
  templateUrl: './terms-page.html',
  styleUrl: './terms-page.scss',
})
export class TermsPage {
  protected readonly publisher = PUBLISHER_NAME;
}
