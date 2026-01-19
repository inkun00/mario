'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  PlusSquare,
  Trophy,
  UserCircle,
  LogOut,
  Users,
  Menu,
} from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';

import AppLogo from './app-logo';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { useEffect, useState } from 'react';
import type { User } from '@/lib/types';
import { doc, onSnapshot } from 'firebase/firestore';
import { getLevelInfo, LevelInfo } from '@/lib/level-system';
import { PixelAvatar } from './pixel-avatar';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '참여하기' },
  { href: '/game-sets/create', icon: PlusSquare, label: '퀴즈 만들기' },
  { href: '/leaderboard', icon: Trophy, label: '리더보드' },
  { href: '/my-class', icon: Users, label: '나의 학급' },
];

export function Header() {
  const pathname = usePathname();
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const { toast } = useToast();
  const [userData, setUserData] = useState<User | null>(null);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);

  useEffect(() => {
    if (!user) {
      setUserData(null);
      setLevelInfo(null);
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const fetchedUserData = docSnap.data() as User;
        setUserData(fetchedUserData);
        setLevelInfo(getLevelInfo(fetchedUserData.xp));
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    toast({
      title: '로그아웃',
      description: '성공적으로 로그아웃되었습니다.',
    });
    router.push('/');
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '';
    return name.substring(0, 2);
  };
  
  const logoHref = user ? '/dashboard' : '/';
  
  let pixelAvatarData = null;
  if (userData?.pixelAvatar) {
    try {
      pixelAvatarData = JSON.parse(userData.pixelAvatar);
    } catch (e) {
      console.error("Error parsing pixel avatar in header", e);
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        {user && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden mr-2">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-4">
              <AppLogo href={logoHref} className="mb-6"/>
              <nav className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                        pathname.startsWith(item.href)
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        )}

        <AppLogo href={logoHref} className={cn(user && 'hidden md:flex')} />
        <nav className="ml-6 hidden md:flex items-center space-x-4 lg:space-x-6">
          {user && navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                pathname.startsWith(item.href)
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center space-x-4">
          {loading ? (
             <Skeleton className="h-8 w-8 rounded-full" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                >
                  <Avatar className="h-9 w-9 flex items-center justify-center bg-secondary">
                    {pixelAvatarData ? (
                      <PixelAvatar pixels={pixelAvatarData} />
                    ) : (
                      <AvatarFallback>
                        {getInitials(userData?.displayName)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {userData?.displayName || user.displayName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>마이페이지</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/login">로그인</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
