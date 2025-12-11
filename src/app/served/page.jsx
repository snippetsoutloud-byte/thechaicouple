"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ServedPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/q");
  }, [router]);

  return null;
}


