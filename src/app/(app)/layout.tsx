'use client';

import { SidebarNav } from '@/components/sidebar-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <main className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 bg-background">
        {children}
      </main>
    </div>
  );
}
