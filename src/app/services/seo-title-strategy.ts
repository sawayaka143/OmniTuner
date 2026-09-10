import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { OG_IMAGE_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '../data/site.constants';

const DEFAULT_ROBOTS = 'index,follow';

function deepestRoute(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let route = snapshot;
  while (route.firstChild) route = route.firstChild;
  return route;
}

@Service()
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot) ?? SITE_NAME;
    const route = deepestRoute(snapshot.root);
    const description = (route.data['seoDescription'] as string | undefined) ?? SITE_DESCRIPTION;
    const robots = (route.data['robots'] as string | undefined) ?? DEFAULT_ROBOTS;
    const url = `${SITE_URL}${snapshot.url}`;

    this.title.setTitle(title);

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: robots });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: OG_IMAGE_URL });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: OG_IMAGE_URL });

    this.setCanonical(url);
  }

  private setCanonical(url: string): void {
    const head = this.document.head;
    if (!head) return;

    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
