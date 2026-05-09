import type { Metadata } from 'next';
import RegisterClient from './RegisterClient';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your Zero account and start issuing cryptographic identities to your AI agents.',
};

export default function RegisterPage() {
  return <RegisterClient />;
}
