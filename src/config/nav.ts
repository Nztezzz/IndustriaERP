import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  History,
  Package,
  Users,
  Truck,
  Disc3,
  Search,
  FileBarChart,
  FileText,
  UserCog,
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
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Search", url: "/search", icon: Search },
    ],
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
      { title: "Packing Slip", url: "/packing-slip", icon: FileText },
    ],
  },
  {
    label: "Master Data",
    items: [
      { title: "Products", url: "/products", icon: Package },
      { title: "Customers", url: "/customers", icon: Users },
    ],
  },
  {
    label: "Insights",
    items: [{ title: "Reports", url: "/reports", icon: FileBarChart }],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Settings",
        url: "/settings/profile",
        icon: UserCog,
      },
    ],
  },
]
