/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @funspot/core ships TypeScript source directly (no build step) so its
  // workspace package can be shared unmodified with the Expo app — Next.js
  // needs to be told to transpile it rather than treat it as pre-built.
  transpilePackages: ['@funspot/core'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
