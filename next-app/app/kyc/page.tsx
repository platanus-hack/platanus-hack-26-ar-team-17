import type { Metadata } from 'next';
import KycClient from './KycClient';

export const metadata: Metadata = {
  title: 'Verify Identity',
  description: 'Complete identity verification to start using Zero.',
};

export default function KycPage() {
  return <KycClient />;
}
