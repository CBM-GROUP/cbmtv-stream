"use client";

import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getUserProfile } from "@/services/accounts";
import apiClient from "@/services/api";
import axios from "axios";
import { BiLoader, BiUpload } from "react-icons/bi";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

const ProfileEditForm = () => {
  const { user } = useAuth();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { dirtyFields },
  } = useForm();

  useEffect(() => {
    if (user) {
      setImagePreview(user.image || null);
      reset({
        name: user.name,
        email: user.email,
        phone: user.phone,
        location: user.location,
        country: user.country,
        profile_picture: user.image,
      });
      setIsLoading(false);
    } else {
      redirect("/");
    }
  }, [user, reset]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    setIsUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("image", file);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      const response = await axios.post(
        "https://development.autofore.com/api/upload-image",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      setValue("profile_picture", response.data.url, { shouldDirty: true });
    } catch (error) {
      console.error("Error uploading image:", error);
      setStatus({ type: "error", message: "Image upload failed." });
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: any) => {
    if (!user || !user.id) {
      console.error("User not found or user ID is missing.");
      setStatus({
        type: "error",
        message: "User not found or user ID is missing.",
      });
      return;
    }

    const changedFields: { [key: string]: any } = {};

    for (const key in dirtyFields) {
      changedFields[key] = data[key];
    }

    if (Object.keys(changedFields).length > 0) {
      try {
        await apiClient.patch(`/api/accounts/users/${user.id}/`, changedFields);
        setStatus({
          type: "success",
          message: "Profile updated successfully!",
        });
      } catch (error) {
        console.error("Error updating user profile:", error);
        setStatus({ type: "error", message: "Failed to update profile." });
      }
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card className="bg-transparent border-none text-white">
      <CardHeader>
        <CardTitle className="text-2xl">Edit Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {status && (
            <div
              className={`p-4 rounded-md ${status.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
            >
              {status.message}
            </div>
          )}
          <div>
            <Label className="text-white/40" htmlFor="name">
              Name
            </Label>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Input {...field} className="border-white/10 h-13 mt-2 px-6" />
              )}
            />
          </div>
          <div>
            <Label className="text-white/40" htmlFor="email">
              Email
            </Label>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  className="border-white/10 h-13 mt-2 px-6"
                  type="email"
                />
              )}
            />
          </div>
          <div>
            <Label className="text-white/40" htmlFor="phone">
              Phone
            </Label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <Input {...field} className="border-white/10 h-13 mt-2 px-6" />
              )}
            />
          </div>
          <div>
            <Label className="text-white/40" htmlFor="location">
              Location
            </Label>
            <Controller
              name="location"
              control={control}
              render={({ field }) => (
                <Input {...field} className="border-white/10 h-13 mt-2 px-6" />
              )}
            />
          </div>
          <div>
            <Label className="text-white/40" htmlFor="country">
              Country
            </Label>
            <Controller
              name="country"
              control={control}
              render={({ field }) => (
                <Input {...field} className="border-white/10 h-13 mt-2 px-6" />
              )}
            />
          </div>
          <div>
            <div className="flex items-center space-x-4">
              {user?.image && (
                <>
                  <Label>Profile Picture</Label>
                  <img
                    src={
                      imagePreview ||
                      user?.image ||
                      "/images/default-avatar.png"
                    }
                    alt="Profile"
                    className="w-20 h-20 rounded-full text-transparent"
                  />
                </>
              )}

              <Controller
                name="profile_picture"
                control={control}
                render={({ field }) => (
                  <>
                    <input
                      type="file"
                      id="profile_picture_upload"
                      className="hidden"
                      onChange={(e) => {
                        field.onChange(e);
                        handleImageUpload(e);
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("profile_picture_upload")
                          ?.click()
                      }
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <BiLoader className="animate-spin" />
                      ) : (
                        <BiUpload />
                      )}
                      Upload Image
                    </Button>
                  </>
                )}
              />
            </div>
          </div>
          <Button
            type="submit"
            className="h-14 w-full border border-yellow-500 text-yellow-500 bg-transparent  hover:bg-yellow-300 hover:text-black"
          >
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProfileEditForm;
