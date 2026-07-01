import {
  ArrowRightLeft,
  History,
  LayoutDashboard,
  Server,
  Settings,
  Shield,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export interface SidebarNavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

export const sidebarNavItems: SidebarNavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "대시보드" },
  { href: "/dashboard/services", icon: Server, label: "서비스" },
  { href: "/dashboard/middlewares", icon: SlidersHorizontal, label: "미들웨어" },
  { href: "/dashboard/redirects", icon: ArrowRightLeft, label: "리다이렉트" },
  { href: "/dashboard/certificates", icon: Shield, label: "인증서" },
  { href: "/dashboard/audit", icon: History, label: "감사 로그" },
  { href: "/dashboard/settings", icon: Settings, label: "설정" },
];
