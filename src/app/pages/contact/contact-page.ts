import { Component } from '@angular/core';

import { CONTACT_EMAIL, ISSUES_URL } from '../../data/site.constants';
import { InfoPage } from '../info/info-page';

@Component({
  selector: 'app-contact-page',
  imports: [InfoPage],
  templateUrl: './contact-page.html',
  styleUrl: './contact-page.scss',
})
export class ContactPage {
  protected readonly issuesUrl = ISSUES_URL;
  protected readonly email = CONTACT_EMAIL;
}
