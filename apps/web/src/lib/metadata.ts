import type { Metadata } from "next";

interface SiteSettings {
  name: string;
  description: string;
  url: string;
  ogImage?: string;
  googleSiteVerification?: string;
}

interface PageMeta {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  noIndex?: boolean;
}

export function generatePageMetadata(
  settings: SiteSettings,
  page: PageMeta,
): Metadata {
  const canonicalUrl = page.path
    ? `${settings.url}${page.path}`
    : settings.url;

  const ogImage = page.ogImage ?? settings.ogImage;

  return {
    title: page.title,
    description: page.description,
    metadataBase: new URL(settings.url),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: canonicalUrl,
      siteName: settings.name,
      locale: "fr_BE",
      type: "website",
      ...(ogImage && { images: [{ url: ogImage }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      ...(ogImage && { images: [ogImage] }),
    },
    ...(page.noIndex && {
      robots: { index: false, follow: false },
    }),
    ...(settings.googleSiteVerification && {
      verification: {
        google: settings.googleSiteVerification,
      },
    }),
  };
}

export function createMetadataTemplate(siteName: string): Metadata {
  return {
    title: {
      template: `%s | ${siteName}`,
      default: siteName,
    },
  };
}
