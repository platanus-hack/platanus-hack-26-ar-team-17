import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://platanus-hack-26-ar-team-17.vercel.app'),
  title: {
    default: 'Zero — The License Plate for AI Agents',
    template: '%s | Zero',
  },
  description:
    'Identity, permissions and accountability for AI agents. Register an agent, assign an owner, define permissions, and verify every action in real time. Built at Platanus Hack.',
  keywords: [
    'AI agents',
    'agent identity',
    'agent authentication',
    'agent authorization',
    'API keys',
    'KYC for agents',
    'agentic AI',
    'Internet of Agents',
    'Platanus Hack',
  ],
  authors: [{ name: 'Zero' }],
  creator: 'Zero',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: "Internet wasn't built for AI agents. Zero fixes that.",
    description:
      'The identity layer for the Internet of Agents. Register an agent, assign an owner, define permissions, and verify every action in real time.',
    siteName: 'Zero',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The license plate for AI agents.',
    description:
      'Identity, permissions and accountability for the Internet of Agents. Built at Platanus Hack.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
