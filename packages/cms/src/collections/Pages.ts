import type { CollectionConfig, Access } from 'payload'

const filterBySiteId: Access = ({ req }) => {
  const siteId = req.headers.get('x-site-id')
  if (!siteId) return false
  return { siteId: { equals: siteId } }
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    read: filterBySiteId,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
    },
    {
      name: 'siteId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'text' },
        { name: 'ctaPrimary', type: 'text' },
        { name: 'ctaSecondary', type: 'text' },
      ],
    },
    {
      name: 'content',
      type: 'richText',
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text', maxLength: 60 },
        { name: 'metaDescription', type: 'text', maxLength: 160 },
        { name: 'canonical', type: 'text' },
        { name: 'noIndex', type: 'checkbox' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      defaultValue: 'draft',
    },
    {
      name: 'publishedAt',
      type: 'date',
    },
  ],
}
