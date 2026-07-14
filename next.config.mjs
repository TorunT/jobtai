/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias['@'] = new URL('.', import.meta.url).pathname;
    return config;
  }
};
export default nextConfig;
