"use client";
import { useQuery } from "@tanstack/react-query";
import { listAds } from "@/services/adverts";

export const useAds = () => {
  return useQuery({
    queryKey: ["ads"],
    queryFn: listAds,
  });
};
