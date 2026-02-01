/** @type {import('next').NextConfig} */
const nextConfig = {
  redirects: async () => [{ source: "/tracker", destination: "/dashboard", permanent: true }],
};

export default nextConfig;
