"use client";

import QueryProvider from "@/components/QueryProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
