"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store/useAuthStore";

export default function RootPage() {
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
    if (hydrated && initialized) {
      router.replace(isAuthenticated ? "/dashboard" : "/login");
    }
  }, [hydrated, initialized, isAuthenticated, router]);

  return null;
}
