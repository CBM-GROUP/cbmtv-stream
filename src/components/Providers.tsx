"use client";

import QueryProvider from "@/components/QueryProvider";
import { LibraryProvider } from "@/context/LibraryContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <LibraryProvider>{children}</LibraryProvider>
    </QueryProvider>
  );
}
