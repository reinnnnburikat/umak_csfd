import { redirect } from 'next/navigation';

export default function GoodMoralPage() {
  redirect('/service-requests?type=GMC');
}
