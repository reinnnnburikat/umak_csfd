import { redirect } from 'next/navigation';

export default function UniformExemptionPage() {
  redirect('/service-requests?type=UER');
}
