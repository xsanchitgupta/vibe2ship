import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for containerised hosting
  // (Google Cloud Run, which is what AI Studio's "Publish" deploys to).
  output: 'standalone',
};

export default nextConfig;
