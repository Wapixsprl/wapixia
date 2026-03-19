import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import {
  Pages,
  Services,
  Testimonials,
  FAQItems,
  Media,
  SiteSettings,
  Navigation,
} from './collections'

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET ?? '',
  serverURL: process.env.PAYLOAD_URL ?? 'http://localhost:3001',

  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL ?? '',
    },
  }),

  editor: lexicalEditor({}),

  collections: [
    Pages,
    Services,
    Testimonials,
    FAQItems,
    Media,
    SiteSettings,
    Navigation,
  ],

  admin: {
    user: 'users',
    disable: true,
  },

  typescript: {
    outputFile: 'src/payload-types.ts',
  },
})
