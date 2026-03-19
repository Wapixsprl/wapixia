import type { CollectionConfig, Access } from 'payload'

const filterBySiteId: Access = ({ req }) => {
  const siteId = req.headers.get('x-site-id')
  if (!siteId) return false
  return { siteId: { equals: siteId } }
}

export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  admin: {
    useAsTitle: 'author',
  },
  access: {
    read: filterBySiteId,
  },
  fields: [
    {
      name: 'siteId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'author',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'text',
    },
    {
      name: 'rating',
      type: 'number',
      min: 1,
      max: 5,
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
    },
  ],
}
