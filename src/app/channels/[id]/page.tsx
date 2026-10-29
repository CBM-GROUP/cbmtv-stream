import { isAxiosError } from "axios";
import { notFound } from "next/navigation";
import { getChannelById } from "@/services/channels";
import ChannelPageClient from "./ChannelPageClient";

export default async function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  const channel = await getChannelById(id).then((response) => response.data).catch((error: unknown) => {
    if (isAxiosError(error) && error.response?.status === 404) notFound();
    throw error;
  });
  return <ChannelPageClient channel={channel} />;
}