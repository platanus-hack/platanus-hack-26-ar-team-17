import type { Metadata } from 'next';
import { Geist, Geist_Mono, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-jetbrains' });
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-grotesk-var' });

export const metadata: Metadata = {
  title: 'Zero | The Identity Layer for the Agentic Internet',
  description: 'Secure, audit and control every action your AI agents take.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${jetbrains.variable} ${grotesk.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
