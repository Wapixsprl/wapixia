import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@wapixia/ui', '@wapixia/types'],
}

export default nextConfig
