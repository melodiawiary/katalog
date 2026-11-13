/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '5mb' }, // zdjęcia produktów
  },
};
export default nextConfig;
