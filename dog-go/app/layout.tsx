import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Dog-go: cozy walks with your low-poly pup',
  description: 'Walk with your real dog, or a low-poly 3D version of them.',
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/icon.png`, apple: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/icon.png` },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FFF7EC',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
