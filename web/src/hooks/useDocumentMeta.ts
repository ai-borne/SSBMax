import { useEffect } from 'react';

export interface DocumentMeta {
  title: string;
  description: string;
  /** Absolute canonical URL for this page, e.g. https://ssbmax.in/study/... */
  url: string;
}

function upsertMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonicalLink(url: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

/**
 * Sets document.title, the description meta tag, Open Graph, Twitter Card, and canonical
 * link for the current route (Phase 3, docs/plans/i-just-watched-a-nested-russell.md).
 * index.html ships one static <title>/description for '/' -- content routes need their own
 * per Phase-3's "match real query phrasing" requirement, and there is no per-route static
 * HTML yet (that's Phase 5's prerenderer), so this sets them at render time. Mutates
 * existing tags in place rather than removing them, since '/' -> content-route navigation
 * inside the SPA session must not leave the page with no description tag at all.
 */
export function useDocumentMeta({ title, description, url }: DocumentMeta): void {
  useEffect(() => {
    document.title = title;
    upsertMetaTag('name', 'description', description);
    upsertMetaTag('property', 'og:title', title);
    upsertMetaTag('property', 'og:description', description);
    upsertMetaTag('property', 'og:type', 'article');
    upsertMetaTag('property', 'og:url', url);
    upsertMetaTag('name', 'twitter:card', 'summary');
    upsertMetaTag('name', 'twitter:title', title);
    upsertMetaTag('name', 'twitter:description', description);
    upsertCanonicalLink(url);
  }, [title, description, url]);
}
