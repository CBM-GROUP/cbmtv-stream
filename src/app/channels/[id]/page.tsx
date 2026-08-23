import { getChannelById } from '@/services/channels';
import ChannelPageClient from './ChannelPageClient';

type Props = {
  // Next 16: params is a Promise. This route already awaits it correctly;
  // the type just needs to say so.
  params: Promise<{ id: string }>;
};

export default async function ChannelPage({ params }: Props) {
  const { id } = await params;

  let channel = null;
  try {
    const response = await getChannelById(id);
    channel = response.data;
    console.log('Fetched channel data:', channel);
  } catch (error) {
    console.error('Error fetching channel:', error);
    
    return <div>Channel not found</div>;
  }

  if (!channel) {
    return <div>Loading...</div>;
  }

  return <ChannelPageClient channel={channel} />;
}