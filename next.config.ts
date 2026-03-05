import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // GitHub Pages usually serves at https://<username>.github.io/<repo-name>
  // So we need to set the basePath to the repo name
  basePath: '/isotron',
  // Disable image optimization as it requires a Node.js server
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
