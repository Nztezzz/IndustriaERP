import { Link, useRouterState } from "@tanstack/react-router"
import { Factory } from "lucide-react"
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
  SidebarRail,
} from "@/components/ui/sidebar"
import { NAV_GROUPS } from "@/config/nav"
import { useAuthStore } from "@/stores/auth-store"
import { hasMinRole } from "@/lib/constants"

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const role = useAuthStore((s) => s.user?.role)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <div className="flex aspect-square size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Factory className="size-3.5" />
                </div>
                <span className="font-heading font-semibold">Preyansh ERP</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) =>
            hasMinRole(role, item.minRole ?? "viewer")
          )
          if (visibleItems.length === 0) return null

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.url || pathname.startsWith(`${item.url}/`)
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                        >
                          <Link to={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
