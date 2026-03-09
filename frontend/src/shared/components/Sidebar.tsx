"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { 
  LayoutDashboard, Shield, ArrowRightLeft, LogOut, Settings, 
  SlidersHorizontal, History, Server, Menu, X, Sun, Moon 
} from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // 다크 모드 토글 로직
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const isDarkMode = savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDark(isDarkMode);
    if (isDarkMode) document.documentElement.classList.add("dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    if (newTheme) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* 모바일 상단 바 (Dark 모드 대응) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar dark:bg-slate-900 border-b border-sidebar-border/30 dark:border-slate-800 px-4 flex items-center justify-between z-50 transition-colors duration-300">
        <div className="flex items-center gap-2">
          <Image src="/icon.png" alt="" width={32} height={32} className="w-8 h-8 object-contain" />
          <span className="text-slate-800 dark:text-white font-bold text-sm">Traefik Manager</span>
        </div>
        <button 
          onClick={toggleSidebar}
          className="p-2 text-slate-800 dark:text-white hover:bg-sidebar-hover rounded-lg transition-colors"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* 모바일 오버레이 */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[55]" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 사이드바 메인: #E7E7E7 배경 적용 */}
      <aside className={clsx(
        "fixed lg:static inset-y-0 left-0 w-64 min-h-screen bg-sidebar dark:bg-[#111827] flex flex-col border-r border-sidebar-border/50 dark:border-slate-800 shadow-2xl transition-all duration-300 z-[60]",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* 브랜드 영역: 박스를 제거하고 아이콘 크기를 극대화(w-40) */}
        <div className="flex flex-col items-center gap-4 px-6 py-12 border-b border-sidebar-border/10 dark:border-slate-800 bg-gradient-to-b from-black/[0.01] to-transparent">
          <div className="relative group cursor-default">
            {/* 호버 시 은은한 광채 효과만 유지 */}
            <div className="absolute -inset-8 bg-brand-primary/5 rounded-full opacity-0 group-hover:opacity-100 blur-3xl transition-all duration-1000"></div>
            
            {/* 아이콘: 박스 없이 이미지 자체를 크게 노출 (w-40) */}
            <div className="relative transition-all duration-700 hover:scale-105">
              <Image
                src="/icon.png" 
                alt="" 
                width={160}
                height={160}
                className="w-40 h-40 object-contain drop-shadow-[0_20px_30px_rgba(59,130,246,0.15)] dark:drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]" 
              />
            </div>
          </div>
          
          <div className="w-full text-center mt-2">
            <Image
              src="/logo.png" 
              alt="Traefik Manager" 
              width={160}
              height={40}
              className="h-10 w-auto mx-auto object-contain dark:brightness-110" 
            />
          </div>
        </div>

        {/* 내비게이션: 비활성 text-slate-600, 활성 #3B82F6 배경 */}
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={clsx(
                  "group flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm transition-all duration-300",
                  isActive
                    ? "bg-brand-primary text-white font-bold shadow-xl shadow-brand-primary/20 scale-[1.02]" // 선택색 #3B82F6 + 화이트 텍스트
                    : "text-slate-600 dark:text-slate-400 hover:text-brand-primary hover:bg-sidebar-hover dark:hover:bg-slate-800"
                )}
              >
                <Icon className={clsx(
                  "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                  isActive ? "text-white" : "text-slate-400 group-hover:text-brand-primary"
                )} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* 하단 제어 센터: 다크모드 토글 버튼 추가 */}
        <div className="px-4 py-6 border-t border-sidebar-border/20 dark:border-slate-800 space-y-4">
          {/* 다크모드 전환 버튼 */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-between w-full px-4 py-3 bg-white/40 dark:bg-white/[0.05] border border-white/60 dark:border-white/[0.1] rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-white/[0.08] transition-all duration-300 shadow-sm"
          >
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="w-4 h-4 text-brand-primary" /> : <Sun className="w-4 h-4 text-orange-400" />}
              <span>{isDark ? "다크 모드" : "라이트 모드"}</span>
            </div>
            <div className={clsx(
              "w-8 h-4 rounded-full relative transition-colors duration-300",
              isDark ? "bg-brand-primary" : "bg-slate-300"
            )}>
              <div className={clsx(
                "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-300",
                isDark ? "translate-x-4.5" : "translate-x-0.5"
              )} />
            </div>
          </button>

          {/* 사용자 정보 및 로그아웃 */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-white/20 dark:bg-white/[0.02] rounded-2xl border border-white/20 dark:border-white/[0.05]">
            <div className="w-8 h-8 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xs text-white font-bold">{username?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-800 dark:text-slate-200 text-sm font-semibold truncate">{username}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest">{role === "admin" ? "ADMIN" : "VIEWER"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl text-sm transition-all duration-300"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </aside>
    </>
  );
}
