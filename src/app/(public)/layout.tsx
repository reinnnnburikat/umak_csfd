import { PublicNavbar } from '@/components/layout/public-navbar';
import { Footer } from '@/components/layout/footer';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
    </div>
  );
}
