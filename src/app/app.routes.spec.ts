import { routes } from './app.routes';

describe('app.routes', () => {
  it('sets a document title on every page route so stale titles never persist', () => {
    for (const route of routes) {
      if (route.redirectTo !== undefined) continue;
      expect(route.title, `route '/${route.path ?? '**'}'`).toBeTruthy();
    }
  });
});
