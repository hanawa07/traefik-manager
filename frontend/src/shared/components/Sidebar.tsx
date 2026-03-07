"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { Server, LayoutDashboard, Shield, ArrowRightLeft, LogOut, Settings, SlidersHorizontal, History } from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "대시보드" },
  { href: "/dashboard/services", icon: Server, label: "서비스" },
  { href: "/dashboard/middlewares", icon: SlidersHorizontal, label: "미들웨어" },
  { href: "/dashboard/redirects", icon: ArrowRightLeft, label: "리다이렉트" },
  { href: "/dashboard/certificates", icon: Shield, label: "인증서" },
  { href: "/dashboard/audit", icon: History, label: "감사 로그" },
  { href: "/dashboard/settings", icon: Settings, label: "설정" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { username, role, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <aside className="w-60 min-h-screen bg-sidebar flex flex-col">
      {/* 로고 */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Server className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-semibold text-sm">Traefik Manager</span>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-blue-600 text-white font-medium"
                  : "text-slate-400 hover:text-white hover:bg-sidebar-hover"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* 하단 사용자 정보 */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center">
            <span className="text-xs text-white font-medium">
              {username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-300 text-sm truncate">{username}</p>
            <p className="text-[11px] text-slate-500">{role === "admin" ? "관리자" : "뷰어"}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full text-slate-400 hover:text-white hover:bg-sidebar-hover rounded-lg text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
