'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FileText,
  Radio,
  Globe,
  Bus,
  BarChart2,
  Settings,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar'

const navItems = [
  {
    label: 'コンテンツ',
    items: [
      { title: 'コンテンツ一覧', href: '/contents', icon: FileText },
      { title: 'ラジオ番組', href: '/programs', icon: Radio },
      { title: 'ポーリングサイト', href: '/polling-sites', icon: Globe },
    ],
  },
  {
    label: '運行管理',
    items: [
      { title: 'バス管理', href: '/buses', icon: Bus },
      { title: '再生ログ', href: '/logs', icon: BarChart2 },
    ],
  },
  {
    label: 'システム',
    items: [
      { title: '設定', href: '/settings', icon: Settings },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radio className="size-4" />
          </div>
          <span className="text-lg font-semibold">AutoDJ Radio</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {navItems.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <Link href={item.href}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <p className="text-xs text-muted-foreground">
          AutoDJ Radio Admin v1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
