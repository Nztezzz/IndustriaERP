import { useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useTheme } from "next-themes"
import { LogOut, Monitor, Moon, Search, Settings, Sun } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/auth-store"

function initialsFor(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { theme, setTheme } = useTheme()

  function handleLogout() {
    logout()
    navigate({ to: "/login" })
  }

  // Ctrl/Cmd+K jumps to the global Search page (task 21) -- kept as a
  // simple navigation rather than an overlay command palette, matching
  // every list page's existing pattern of its OWN inline filters (see
  // global-search-page.tsx's own note on this).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        navigate({ to: "/search" })
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [navigate])

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex-1">{children}</div>
      <Button
        variant="outline"
        size="sm"
        className="text-muted-foreground"
        onClick={() => navigate({ to: "/search" })}
      >
        <Search />
        Search
        <kbd className="ml-1 hidden rounded border bg-muted px-1 font-mono text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </Button>
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 pr-2 outline-none hover:bg-muted">
            <Avatar size="sm">
              <AvatarFallback>{initialsFor(user.fullName)}</AvatarFallback>
            </Avatar>
            <div className="hidden flex-col items-start leading-tight sm:flex">
              <span className="text-sm font-medium">{user.fullName}</span>
            </div>
            <Badge variant="outline" className="capitalize">
              {user.role}
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{user.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate({ to: "/settings/profile" })}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />}
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                  <DropdownMenuRadioItem value="light">
                    <Sun />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon />
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor />
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
}
