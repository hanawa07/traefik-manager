"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import Sidebar from "@/shared/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s._hydrated);
  const initialized = useAuthStore((s) => s._initialized);
  const syncSession = useAuthStore((s) => s.syncSession);

  useEffect(() => {
    if (hydrated && !initialized) {
      void syncSession();
    }
  }, [hydrated, initialized, syncSession]);

  useEffect(() => {
    if (hydrated && initialized && !isAuthenticated) router.replace("/login");
  }, [hydrated, initialized, isAuthenticated, router]);

  if (!hydrated || !initialized) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 overflow-auto pt-16 lg:pt-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
