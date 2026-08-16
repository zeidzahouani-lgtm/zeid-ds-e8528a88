import { Helmet } from "react-helmet-async";
import { useEffect } from "react";
import type { ReactNode } from "react";

const SITE_URL = "https://screenflow-ds.com";

export interface SeoHeadProps {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown>;
}

export function SeoHead({ title, description, path, jsonLd }: SeoHeadProps) {
  const url = `${SITE_URL}${path}`;

  // Signal to global settings that this route owns the document title.
  useEffect(() => {
    (window as unknown as { __routeHasSeoTitle?: boolean }).__routeHasSeoTitle = true;
    return () => {
      (window as unknown as { __routeHasSeoTitle?: boolean }).__routeHasSeoTitle = false;
    };
  }, []);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}

/** Wraps a route element with its page-specific head tags. */
export function WithSeo({ seo, children }: { seo: SeoHeadProps; children: ReactNode }) {
  return (
    <>
      <SeoHead {...seo} />
      {children}
    </>
  );
}
