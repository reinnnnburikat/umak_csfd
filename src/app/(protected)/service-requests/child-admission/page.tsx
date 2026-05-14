import { redirect } from 'next/navigation';

export default function ChildAdmissionPage() {
  redirect('/service-requests?type=CAC');
}
