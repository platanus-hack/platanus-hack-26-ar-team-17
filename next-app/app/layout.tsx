import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://platanus-hack-26-ar-team-17.vercel.app'),
  title: {
    default: 'Zero - La patente de los agentes de IA',
    template: '%s | Zero',
  },
  description:
    'Identidad, permisos y trazabilidad para agentes de IA. Registra un agente, asígnale un responsable, define permisos y verifica cada acción en tiempo real.',
  keywords: [
    'agentes de IA',
    'identidad de agentes',
    'autenticación de agentes',
    'autorización de agentes',
    'API keys',
    'KYC para agentes',
    'IA agéntica',
    'Internet de Agentes',
    'Platanus Hack',
  ],
  authors: [{ name: 'Zero' }],
  creator: 'Zero',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    title: 'Internet no fue construida para agentes de IA. Zero lo arregla.',
    description:
      'La capa de identidad para la Internet de Agentes. Registra un agente, asígnale un responsable, define permisos y verifica cada acción en tiempo real.',
    siteName: 'Zero',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'La patente de los agentes de IA.',
    description:
      'Identidad, permisos y accountability para la Internet de Agentes. Construido en Platanus Hack.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
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
