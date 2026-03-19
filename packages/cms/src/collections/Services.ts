import type { CollectionConfig, Access } from 'payload'

const filterBySiteId: Access = ({ req }) => {
  const siteId = req.headers.get('x-site-id')
  if (!siteId) return false
  return { siteId: { equals: siteId } }
}

export const Services: CollectionConfig = {
  slug: 'services',
  admin: {
    useAsTitle: 'name',
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
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
    },
    {
      name: 'h2',
      type: 'text',
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'details',
      type: 'textarea',
    },
    {
      name: 'duration',
      type: 'text',
    },
    {
      name: 'priceFrom',
      type: 'text',
    },
    {
      name: 'sortOrder',
      type: 'number',
    },
    {
      name: 'faq',
      type: 'array',
      fields: [
        { name: 'question', type: 'text' },
        { name: 'answer', type: 'textarea' },
      ],
    },
  ],
}
