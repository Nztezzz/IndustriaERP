import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  History,
  Package,
  Ruler,
  Users,
  Truck,
  Disc3,
  Search,
  FileBarChart,
  DatabaseBackup,
  UserCog,
  ScrollText,
} from "lucide-react"
import type { Role } from "@/lib/constants"

export interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  /** Minimum role required to see this item. Defaults to viewer (everyone). */
  minRole?: Role
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Inventory",
    items: [
      { title: "Stock Overview", url: "/inventory", icon: Package },
      {
        title: "Inward Entry",
        url: "/inventory/inward",
        icon: ArrowDownToLine,
        minRole: "operator",
      },
      {
        title: "Outward Entry",
        url: "/inventory/outward",
        icon: ArrowUpFromLine,
        minRole: "operator",
      },
      {
        title: "Adjustments",
        url: "/inventory/adjustments",
        icon: SlidersHorizontal,
        minRole: "operator",
      },
      { title: "Stock History", url: "/inventory/history", icon: History },
    ],
  },
  {
    label: "Dispatch & Reels",
    items: [
      { title: "Dispatches", url: "/dispatches", icon: Truck },
      { title: "Reel Tracking", url: "/reels", icon: Disc3 },
    ],
  },
  {
    label: "Master Data",
    items: [
      { title: "Products", url: "/products", icon: Package },
      { title: "Units", url: "/units", icon: Ruler },
      { title: "Customers", url: "/customers", icon: Users },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Search", url: "/search", icon: Search },
      { title: "Reports", url: "/reports", icon: FileBarChart },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Users & Roles",
        url: "/settings/users",
        icon: UserCog,
        minRole: "admin",
      },
      {
        title: "Backup & Restore",
        url: "/settings/backup",
        icon: DatabaseBackup,
        minRole: "admin",
      },
      {
        title: "Audit Log",
        url: "/settings/audit-log",
        icon: ScrollText,
        minRole: "admin",
      },
    ],
  },
]
