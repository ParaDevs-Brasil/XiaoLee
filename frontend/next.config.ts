import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
  allowedDevOrigins: ['neriah-neumic-ontically.ngrok-free.dev'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent SSR bundling of browser-only Web3Auth deps
      config.resolve.alias = {
        ...config.resolve.alias,
        "@web3auth/modal": false,
        "@web3auth/solana-provider": false,
        "@web3auth/base": false,
      };
    }
    // Silence missing optional native deps from MetaMask SDK / permissionless
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      ox: false,
    };
    return config;
  },
};

export default nextConfig;
