import Link from "next/link";
import Image from "next/image";

const PLACEHOLDER_IMAGE = "/images/cbmtvwhitelogo.png";

interface Props {
  title: string;
  slug: string;
  image: string;
  isLive?: boolean;
  viewersCount?: number;
}

export default function ChannelCard({ 
  title, 
  slug, 
  image, 
  isLive = false, 
  viewersCount = 0 
}: Props) {
  return (
    <Link 
      href={`/channels/${slug}`}
      className="block group rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
      aria-label={`Watch ${title} channel`}
    >
      <div className="relative aspect-video">
        <Image
          src={image || PLACEHOLDER_IMAGE}
          alt={`${title} channel thumbnail`}
          fill
          className="object-cover transition-opacity group-hover:opacity-90"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          priority={false}
        />
        
        {/* Live badge */}
        {isLive && (
          <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            LIVE
          </div>
        )}
        
        {/* Viewers count */}
        {viewersCount > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md">
            {viewersCount.toLocaleString()} viewers
          </div>
        )}
      </div>
      
      <div className="bg-gradient-to-b from-gray-900 to-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white text-center truncate">
          {title}
        </h2>
        {isLive && (
          <p className="text-xs text-gray-400 text-center mt-1">Live Now</p>
        )}
      </div>
    </Link>
  );
}