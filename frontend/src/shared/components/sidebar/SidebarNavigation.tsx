import Link from "next/link";
import { clsx } from "clsx";

import { sidebarNavItems } from "./sidebarNavItems";

interface SidebarNavigationProps {
  pathname: string;
  onNavigate: () => void;
}

export function SidebarNavigation({ pathname, onNavigate }: SidebarNavigationProps) {
  return (
    <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-8">
      {sidebarNavItems.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={clsx(
              "group flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm transition-all duration-300",
              isActive
                ? "scale-[1.02] bg-brand-primary font-bold text-white shadow-xl shadow-brand-primary/20"
                : (
                    "text-slate-600 hover:bg-sidebar-hover hover:text-brand-primary " +
                    "dark:text-slate-400 dark:hover:bg-slate-800"
                  ),
            )}
          >
            <Icon
              className={clsx(
                "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                isActive ? "text-white" : "text-slate-400 group-hover:text-brand-primary",
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
