/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      // Cloudflare R2 public dev subdomain. Swap for your custom domain's
      // hostname instead if the bucket is bound to one.
      { protocol: 'https', hostname: 'pub-*.r2.dev' },
    ],
  },
};

module.exports = nextConfig;

