"use client";

import { useAuth } from "@/context/AuthContext";
import { redirect } from "next/navigation";

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Profile</h1>
      <p>Welcome, {user?.name}!</p>
    </div>
  );
}
