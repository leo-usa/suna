import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // This rule prevents issues with pdf.js and canvas
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    
    // Ensure node native modules are ignored
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };
    
    return config;
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000/api';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
