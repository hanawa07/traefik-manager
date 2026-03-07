"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store/useAuthStore";

export default function RootPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    router.replace(isAuthenticated ? "/dashboard" : "/login");
  }, [isAuthenticated, router]);

  return null;
}
