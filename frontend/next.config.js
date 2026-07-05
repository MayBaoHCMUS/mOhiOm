/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      // Cloudflare R2 public dev subdomain. Swap for your custom domain's
      // hostname instead if the bucket is bound to one.
      { protocol: 'https', hostname: 'pub-*.r2.dev' },
      { protocol: 'https', hostname: 'mohiom.me' },
      { protocol: 'https', hostname: 'www.mohiom.me' },
      { protocol: 'https', hostname: 'gpu.mohiom.me' },
    ],
  },
};

module.exports = nextConfig;

