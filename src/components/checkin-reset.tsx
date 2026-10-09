"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function CheckinReset() {
  const router = useRouter();

  useEffect(() => {
    const timeout = window.setTimeout(() => router.replace("/checkin"), 5000);
    return () => window.clearTimeout(timeout);
  }, [router]);

  return null;
}
