import type { FC } from "react";

interface ServiceSchemaProps {
  name: string;
  description: string;
  providerName: string;
  city: string;
}

export const ServiceSchema: FC<ServiceSchemaProps> = ({
  name,
  description,
  providerName,
  city,
}) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    provider: {
      "@type": "LocalBusiness",
      name: providerName,
    },
    areaServed: {
      "@type": "City",
      name: city,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};
