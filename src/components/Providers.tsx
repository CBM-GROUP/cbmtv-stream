"use client";

import { UserProvider } from "@/context/UserContext";
import QueryProvider from "@/components/QueryProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <UserProvider>
        {children}
      </UserProvider>
    </QueryProvider>
  );
}
