'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
  SidebarProvider,
} from '@/components/ui/sidebar';
import AppLogo from './app-logo';
import {
  LayoutDashboard,
  PlusSquare,
  Trophy,
  UserCircle,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '대시보드' },
  { href: '/game-sets/create', icon: PlusSquare, label: '퀴즈 만들기' },
  { href: '/leaderboard', icon: Trophy, label: '리더보드' },
  { href: '/profile', icon: UserCircle, label: '마이페이지' },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const { toast } = useToast();

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

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <AppLogo />
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    className="font-headline"
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          {loading ? (
            <div className="flex items-center gap-3 p-2">
              <Avatar className="h-9 w-9 animate-pulse bg-secondary" />
              <div className="flex-grow space-y-2">
                <div className="h-3 w-3/4 rounded bg-secondary animate-pulse"></div>
                <div className="h-3 w-1/2 rounded bg-secondary animate-pulse"></div>
              </div>
            </div>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="justify-start w-full p-2 h-auto"
                >
                  <div className="flex items-center gap-3 w-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={
                          user.photoURL ||
                          `https://picsum.photos/seed/${user.uid}/100/100`
                        }
                        alt={user.displayName || 'User'}
                      />
                      <AvatarFallback>
                        {getInitials(user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left flex-grow truncate">
                      <p className="font-semibold text-sm truncate">
                        {user.displayName || '게스트'}
                      </p>
                      {/* <p className="text-xs text-muted-foreground">Level 3</p> */}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mb-2" align="end">
                <DropdownMenuLabel>내 계정</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>프로필</span>
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
            <Button asChild className="w-full">
              <Link href="/login">로그인</Link>
            </Button>
          )}
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}
