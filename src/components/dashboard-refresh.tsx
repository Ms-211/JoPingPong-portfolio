"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function DashboardRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 10000);
    return () => window.clearInterval(interval);
  }, [router]);

  return null;
}

