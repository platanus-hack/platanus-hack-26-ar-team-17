import type { Metadata } from 'next';
import { Suspense } from 'react';
import OnboardClient from './OnboardClient';

export const metadata: Metadata = {
  title: 'Empezar',
  description: 'Crea tu cuenta de Zero, verifica tu identidad y emite la primera credencial de tu agente.',
};

export default function OnboardPage() {
  return (
    <Suspense fallback={null}>
      <OnboardClient />
    </Suspense>
  );
}
