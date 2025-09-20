import AppLogo from '@/components/app-logo';
import { Card } from '@/components/ui/card';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-secondary/50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <AppLogo />
        </div>
        <Card className="p-4 sm:p-6 md:p-8 shadow-2xl">{children}</Card>
      </div>
    </div>
  );
}
