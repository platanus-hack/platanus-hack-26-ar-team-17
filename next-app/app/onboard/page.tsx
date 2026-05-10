import type { Metadata } from 'next';
import { Suspense } from 'react';
import OnboardClient from './OnboardClient';

export const metadata: Metadata = {
  title: 'Get started',
  description: 'Create your Zero account, verify your identity, and issue your first agent key.',
};

export default function OnboardPage() {
  return (
    <Suspense fallback={null}>
      <OnboardClient />
    </Suspense>
  );
}
