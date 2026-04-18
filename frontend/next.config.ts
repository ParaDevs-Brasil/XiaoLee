import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure proper handling of client-side code
  reactStrictMode: true,
  
  // Suppress ngrok warnings by allowing specific origins
  experimental: {
    // Use type assertion to bypass TypeScript limitation
    ...(process.env.NODE_ENV === 'development' && {
      allowedDevOrigins: [
        '29522158a50d.ngrok-free.app',
        '96c5a1581191.ngrok-free.app',
        /.*\.ngrok-free\.app$/,
        /.*\.ngrok\.io$/,
        /localhost:\d+$/,
      ],
    } as any),
  },
  
  // Custom headers to handle CORS and ngrok warnings
  async headers() {
    const devHeaders = process.env.NODE_ENV === 'development' ? [
      // Specific headers for Next.js static assets to work with ngrok
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ] : [];

    return [
      ...devHeaders,
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
