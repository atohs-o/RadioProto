'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileTextIcon, RadioIcon, GlobeIcon, BusIcon } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { LogoutButton } from './_components/LogoutButton'

const NAV_ITEMS = [
  {
    title: 'コンテンツ一覧',
    href: '/contents',
    icon: FileTextIcon,
  },
  {
    title: 'ラジオ番組',
    href: '/programs',
    icon: RadioIcon,
  },
  {
    title: 'ポーリングサイト',
    href: '/polling-sites',
    icon: GlobeIcon,
  },
  {
    title: 'バス管理',
    href: '/buses',
    icon: BusIcon,
  },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-2 px-2 py-3">
            <RadioIcon className="size-6 text-primary" />
            <span className="font-semibold text-lg">AutoDJ Radio</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>管理メニュー</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(item.href)}
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <LogoutButton />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b px-4 md:px-6">
          <SidebarTrigger className="size-9 md:size-7" />
          <h1 className="text-lg font-semibold">
            {NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.title ?? '管理画面'}
          </h1>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
