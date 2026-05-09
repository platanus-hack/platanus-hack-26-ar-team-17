import type { Metadata } from 'next';
import { Geist, Geist_Mono, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-jetbrains' });
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-grotesk-var' });

export const metadata: Metadata = {
  metadataBase: new URL('https://zero-dnvh8x7x6-martinpulis-projects.vercel.app'),
  title: {
    default: 'Zero — Identity for AI Agents',
    template: '%s | Zero',
  },
  description: 'The identity layer for the agentic internet. Issue cryptographic API keys to your AI agents, audit every action, and revoke access instantly.',
  keywords: ['AI agents', 'agent authentication', 'API keys', 'KYC', 'agentic AI', 'agent identity', 'agent authorization'],
  authors: [{ name: 'Zero' }],
  creator: 'Zero',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Zero — Identity for AI Agents',
    description: 'Issue cryptographic API keys to your AI agents. Full audit trail, revocable at any time.',
    siteName: 'Zero',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zero — Identity for AI Agents',
    description: 'Issue cryptographic API keys to your AI agents. Full audit trail, revocable at any time.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${jetbrains.variable} ${grotesk.variable}`}>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#050505" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
