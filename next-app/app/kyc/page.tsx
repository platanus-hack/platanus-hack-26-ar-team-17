import { redirect } from 'next/navigation';

export default function KycPage() {
  redirect('/onboard?step=2');
}
