import type { CollectionConfig, Access } from 'payload'

const filterBySiteId: Access = ({ req }) => {
  const siteId = req.headers.get('x-site-id')
  if (!siteId) return false
  return { siteId: { equals: siteId } }
}

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: filterBySiteId,
  },
  upload: {
    staticDir: 'media',
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
        height: 200,
        position: 'centre',
      },
      {
        name: 'card',
        width: 600,
        height: 400,
        position: 'centre',
      },
      {
        name: 'hero',
        width: 1200,
        height: 630,
        position: 'centre',
      },
    ],
  },
  fields: [
    {
      name: 'siteId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'alt',
      type: 'text',
    },
  ],
}
