import { redirect } from 'next/navigation';

export default function CrossDressingPage() {
  redirect('/service-requests?type=CDC');
}
