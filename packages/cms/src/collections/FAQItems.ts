import type { CollectionConfig, Access } from 'payload'

const filterBySiteId: Access = ({ req }) => {
  const siteId = req.headers.get('x-site-id')
  if (!siteId) return false
  return { siteId: { equals: siteId } }
}

export const FAQItems: CollectionConfig = {
  slug: 'faq-items',
  admin: {
    useAsTitle: 'question',
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
      name: 'category',
      type: 'text',
    },
    {
      name: 'question',
      type: 'text',
      required: true,
    },
    {
      name: 'answer',
      type: 'textarea',
      required: true,
    },
    {
      name: 'sortOrder',
      type: 'number',
    },
  ],
}
