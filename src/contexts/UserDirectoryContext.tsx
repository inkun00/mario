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

interface UserDirectoryContextType {
  userDirectory: SimpleUser[];
  isLoading: boolean;
  getUserByEmail: (email: string) => SimpleUser | undefined;
}

const UserDirectoryContext = createContext<UserDirectoryContextType | undefined>(undefined);

export const UserDirectoryProvider = ({ children }: { children: ReactNode }) => {
  const [userDirectory, setUserDirectory] = useState<SimpleUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef);
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const allUsers = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              uid: doc.id,
              email: data.email || null,
              displayName: data.displayName || '이름없음',
            };
          });
          setUserDirectory(allUsers);
        }
      } catch (error) {
        console.error("Error fetching user directory:", error);
        toast({
          variant: 'destructive',
          title: '오류',
          description: '사용자 목록을 불러오는 데 실패했습니다. 일부 기능이 제한될 수 있습니다.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [toast]);
  
  const getUserByEmail = (email: string): SimpleUser | undefined => {
      return userDirectory.find(user => user.email?.toLowerCase() === email.toLowerCase());
  }

  return (
    <UserDirectoryContext.Provider value={{ userDirectory, isLoading, getUserByEmail }}>
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
