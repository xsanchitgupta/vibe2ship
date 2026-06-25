import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Assistant from '@/components/Assistant';
import ChromeOnly from '@/components/ChromeOnly';
import PwaRegister from '@/components/PwaRegister';
import OfflineQueue from '@/components/OfflineQueue';
import Toaster from '@/components/Toaster';

export const metadata: Metadata = {
  title: 'Community Hero — Hyperlocal Problem Solver',
  description:
    'Report, validate, track and resolve local civic issues with an agentic AI built on Google Gemini. Image-based reporting, autonomous triage, live maps and impact dashboards.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Community Hero', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192.png', sizes: '192x192' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <ChromeOnly>
          <Navbar />
        </ChromeOnly>
        <main id="main" className="main-content">{children}</main>
        <ChromeOnly>
          <Footer />
          <Assistant />
          <OfflineQueue />
        </ChromeOnly>
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
