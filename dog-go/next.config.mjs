/** @type {import('next').NextConfig} */
// PAGES_BASE is set only for the GitHub Pages build (npm run build:pages), so the web version
// can live in a sub-folder. The normal build (used by Capacitor / the APK) has no base path.
const base = process.env.PAGES_BASE || '';
const nextConfig = {
  output: 'export', // static export -> /out, consumed by Capacitor
  trailingSlash: true, // /walk/index.html so file-based routing works inside the WebView
  images: { unoptimized: true },
  reactStrictMode: true,
  ...(base ? { basePath: base, assetPrefix: base } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: base },
};
export default nextConfig;
