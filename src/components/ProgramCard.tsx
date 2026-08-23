import Link from "next/link";
import { SafeImage } from "@/components/SafeImage";

interface ProgramCardProps {
  title: string,
  src: string;
  alt: string;
  slug: string;
  href: string;
}

export const ProgramCard = ({ title, src, alt, href }: ProgramCardProps) => {
  return (
    <div className="w-full aspect-3/4 rounded-lg border-4 hover:scale-105 duration-300 border-white/7 hover:border-chart-4 overflow-hidden z-0 relative">
      <Link href={href || ""}>
        <SafeImage
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={false}
        />
        <h1 className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-sm font-normal truncate text-center ">
          {title}
        </h1>
      </Link>
    </div>
  );
};

