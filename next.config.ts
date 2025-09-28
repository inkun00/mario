
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
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
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      }
    ],
  },
  webpack: (config, { isServer }) => {
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
  serverActions: {
    allowedOrigins: ["localhost:9002", "*.firebase.app", "*.web.app"],
    bodySizeLimit: '4.5mb',
  },
  experimental: {
    httpAgentOptions: {
      keepAlive: true,
    },
  },
};

export default nextConfig;
