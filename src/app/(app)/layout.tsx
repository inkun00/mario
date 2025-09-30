'use client';

import { Header } from '@/components/header';
import { UserDirectoryProvider } from '@/contexts/UserDirectoryContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserDirectoryProvider>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </UserDirectoryProvider>
  );
}
