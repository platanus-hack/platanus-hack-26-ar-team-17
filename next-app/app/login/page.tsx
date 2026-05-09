import type { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to Zero and manage your AI agent identities.',
};

export default function LoginPage() {
  return <LoginClient />;
}
