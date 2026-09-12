import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // reactStrictMode: true,
  output: 'export',
    basePath: '',
  assetPrefix: './',
  images: {
    unoptimized: false
  }
};

export default nextConfig;

// module.exports = {
//   output: 'export',
//   basePath: '',
//   assetPrefix: './', // <-- relative paths
// };