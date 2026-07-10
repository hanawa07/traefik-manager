import Image from "next/image";
import { Menu, X } from "lucide-react";

interface SidebarMobileBarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function SidebarMobileBar({ isOpen, onToggle }: SidebarMobileBarProps) {
  return (
    <div
      id="dashboard-mobile-bar"
      className={
        "fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b " +
        "border-sidebar-border/30 bg-sidebar px-4 transition-colors duration-300 " +
        "dark:border-slate-800 dark:bg-slate-900 lg:hidden"
      }
    >
      <div className="flex items-center gap-2">
        <Image src="/icon.png" alt="" width={32} height={32} className="h-8 w-8 object-contain" />
        <span className="text-sm font-bold text-slate-800 dark:text-white">
          Traefik Manager
        </span>
      </div>
      <button
        type="button"
        aria-controls="dashboard-sidebar"
        aria-expanded={isOpen}
        aria-label={isOpen ? "메뉴 닫기" : "메뉴 열기"}
        onClick={onToggle}
        className="rounded-lg p-2 text-slate-800 transition-colors hover:bg-sidebar-hover dark:text-white"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>
    </div>
  );
}
