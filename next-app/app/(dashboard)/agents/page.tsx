'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AgentsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/keys'); }, [router]);
  return null;
}
