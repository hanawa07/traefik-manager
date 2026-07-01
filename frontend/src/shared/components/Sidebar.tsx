"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { SidebarBrand } from "@/shared/components/sidebar/SidebarBrand";
import { SidebarFooter } from "@/shared/components/sidebar/SidebarFooter";
import { SidebarMobileBar } from "@/shared/components/sidebar/SidebarMobileBar";
import { SidebarNavigation } from "@/shared/components/sidebar/SidebarNavigation";
import { useSidebarTheme } from "@/shared/components/sidebar/useSidebarTheme";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { username, role, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const { isDark, toggleTheme } = useSidebarTheme();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      <SidebarMobileBar isOpen={isOpen} onToggle={toggleSidebar} />

      {isOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 사이드바 메인: #E7E7E7 배경 적용 */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-[60] flex min-h-screen w-64 flex-col bg-sidebar shadow-2xl",
          "border-r border-sidebar-border/50 transition-all duration-300 dark:border-slate-800",
          "dark:bg-[#111827] lg:sticky lg:top-0 lg:h-screen lg:self-start",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <SidebarBrand />
        <SidebarNavigation pathname={pathname} onNavigate={() => setIsOpen(false)} />
        <SidebarFooter
          isDark={isDark}
          username={username}
          role={role}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
        />
      </aside>
    </>
  );
}
