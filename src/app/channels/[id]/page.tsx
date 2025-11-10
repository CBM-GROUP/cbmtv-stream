import { getChannelById } from '@/services/channels';
import ChannelPageClient from './ChannelPageClient';

type Props = {
  params: { id: string };
};

export default async function ChannelPage({ params }: Props) {
  const { id } = params;

  let channel = null;
  try {
    const response = await getChannelById(id);
    channel = response.data;
  } catch (error) {
    console.error('Error fetching channel:', error);
    // You could return a not-found page here
    return <div>Channel not found</div>;
  }

  if (!channel) {
    return <div>Loading...</div>;
  }

  return <ChannelPageClient channel={channel} />;
}