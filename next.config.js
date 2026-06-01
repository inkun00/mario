/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '*.firebasestorage.app',
      }
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('genkit', '@genkit-ai/google-genai');
    }

    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        async_hooks: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
