import { DOCUMENT } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { Router, Routes, TitleStrategy, provideRouter } from '@angular/router';

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '../data/site.constants';
import { SeoTitleStrategy } from './seo-title-strategy';

@Component({ selector: 'app-seo-dummy', template: '' })
class Dummy {}

const testRoutes: Routes = [
  {
    path: 'alpha',
    title: 'Alpha · Test',
    data: { seoDescription: 'Alpha description' },
    component: Dummy,
  },
  { path: 'hidden', title: 'Hidden · Test', data: { robots: 'noindex' }, component: Dummy },
  { path: 'plain', component: Dummy },
];

describe('SeoTitleStrategy', () => {
  let router: Router;
  let title: Title;
  let meta: Meta;
  let document: Document;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(testRoutes),
        { provide: TitleStrategy, useClass: SeoTitleStrategy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);
    document = TestBed.inject(DOCUMENT);
  });

  it('sets the title, description, canonical and social tags from route data', async () => {
    await router.navigateByUrl('/alpha');

    expect(title.getTitle()).toBe('Alpha · Test');
    expect(meta.getTag('name="description"')?.content).toBe('Alpha description');
    expect(meta.getTag('property="og:title"')?.content).toBe('Alpha · Test');
    expect(meta.getTag('property="og:url"')?.content).toBe(`${SITE_URL}/alpha`);
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary_large_image');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SITE_URL}/alpha`,
    );
  });

  it('marks routes carrying a robots directive as noindex', async () => {
    await router.navigateByUrl('/hidden');

    expect(meta.getTag('name="robots"')?.content).toBe('noindex');
  });

  it('falls back to the site defaults when a route omits title and description', async () => {
    await router.navigateByUrl('/plain');

    expect(title.getTitle()).toBe(SITE_NAME);
    expect(meta.getTag('name="description"')?.content).toBe(SITE_DESCRIPTION);
    expect(meta.getTag('name="robots"')?.content).toBe('index,follow');
  });

  it('keeps a single canonical link across navigations', async () => {
    await router.navigateByUrl('/alpha');
    await router.navigateByUrl('/plain');

    expect(document.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SITE_URL}/plain`,
    );
  });
});
