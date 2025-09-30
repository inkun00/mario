'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface SimpleUser {
  uid: string;
  email: string | null;
  displayName: string;
}

// The context type is simplified as we are removing direct data fetching logic from here.
// This context might still be useful for other purposes in the future.
interface UserDirectoryContextType {
  userDirectory: SimpleUser[];
  isLoading: boolean;
}

const UserDirectoryContext = createContext<UserDirectoryContextType | undefined>(undefined);

export const UserDirectoryProvider = ({ children }: { children: ReactNode }) => {
  const [userDirectory, setUserDirectory] = useState<SimpleUser[]>([]);
  const [isLoading, setIsLoading] = useState(false); // No longer loading from here by default
  const { toast } = useToast();
  
  // The client-side data fetching is removed to rely on server actions for sensitive operations.
  // This hook can be repurposed if there's a need for a global, non-sensitive user list.

  const value = { userDirectory, isLoading };

  return (
    <UserDirectoryContext.Provider value={value}>
      {children}
    </UserDirectoryContext.Provider>
  );
};

export const useUserDirectory = () => {
  const context = useContext(UserDirectoryContext);
  if (context === undefined) {
    throw new Error('useUserDirectory must be used within a UserDirectoryProvider');
  }
  return context;
};
