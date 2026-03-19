import type { FC } from "react";

type Sector =
  | "btp"
  | "beaute"
  | "horeca"
  | "immobilier"
  | "medical"
  | "automobile"
  | "commerce"
  | "b2b"
  | "fitness"
  | "asbl";

type PriceRange = "budget" | "medium" | "premium";

interface Address {
  streetAddress: string;
  postalCode: string;
  addressLocality: string;
  addressRegion?: string;
  addressCountry: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface OpeningHoursEntry {
  dayOfWeek: string | string[];
  opens: string;
  closes: string;
}

interface LocalBusinessSchemaProps {
  name: string;
  description: string;
  phone?: string;
  email?: string;
  address: Address;
  coordinates?: Coordinates;
  openingHours?: OpeningHoursEntry[];
  socialLinks?: string[];
  sector: Sector;
  priceRange?: PriceRange;
  url?: string;
  image?: string;
}

const SECTOR_TYPE_MAP: Record<Sector, string> = {
  btp: "HomeAndConstructionBusiness",
  beaute: "BeautySalon",
  horeca: "Restaurant",
  immobilier: "RealEstateAgent",
  medical: "MedicalClinic",
  automobile: "AutoDealer",
  commerce: "Store",
  b2b: "ProfessionalService",
  fitness: "SportsClub",
  asbl: "NGO",
} as const;

const PRICE_RANGE_MAP: Record<PriceRange, string> = {
  budget: "€",
  medium: "€€",
  premium: "€€€",
} as const;

export const LocalBusinessSchema: FC<LocalBusinessSchemaProps> = ({
  name,
  description,
  phone,
  email,
  address,
  coordinates,
  openingHours,
  socialLinks,
  sector,
  priceRange,
  url,
  image,
}) => {
  const schemaType = SECTOR_TYPE_MAP[sector];

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name,
    description,
    address: {
      "@type": "PostalAddress",
      streetAddress: address.streetAddress,
      postalCode: address.postalCode,
      addressLocality: address.addressLocality,
      ...(address.addressRegion && { addressRegion: address.addressRegion }),
      addressCountry: address.addressCountry,
    },
  };

  if (phone) {
    schema.telephone = phone;
  }

  if (email) {
    schema.email = email;
  }

  if (url) {
    schema.url = url;
  }

  if (image) {
    schema.image = image;
  }

  if (coordinates) {
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
  }

  if (openingHours && openingHours.length > 0) {
    schema.openingHoursSpecification = openingHours.map((entry) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: entry.dayOfWeek,
      opens: entry.opens,
      closes: entry.closes,
    }));
  }

  if (socialLinks && socialLinks.length > 0) {
    schema.sameAs = socialLinks;
  }

  if (priceRange) {
    schema.priceRange = PRICE_RANGE_MAP[priceRange];
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};
