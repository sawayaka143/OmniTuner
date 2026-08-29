declare module 'node:fs' {
  export function readFileSync(
    path: URL | string,
    options: { readonly encoding: 'utf8'; readonly flag?: string },
  ): string;
  export function readFileSync(path: URL | string, options: 'utf8'): string;
}

declare const process: { readonly cwd: () => string };
