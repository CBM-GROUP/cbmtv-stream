"use client";
import React from "react";
import ProfileEditForm from "@/components/ProfileEditForm";
import { useAuth } from "@/context/AuthContext";
import { redirect } from "next/navigation";

const ProfileEditPage = () => {
  const { user } = useAuth();
  if (!user) {
    redirect("/");
  }
  return (
    <div className="container md:w-2xl mx-auto py-10">
      <ProfileEditForm />
    </div>
  );
};

export default ProfileEditPage;
