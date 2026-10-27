import Link from "next/link";
import { Play } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";

interface ProgramCardProps {
  id: number;
  title: string;
  src: string | null;
  alt: string;
  slug: string;
  href: string;
}

export const ProgramCard = ({ title, src, alt, href }: ProgramCardProps) => (
  <Link href={href} className="program-card group block min-w-0 rounded-lg" aria-label={`View ${title}`}>
    <div className="relative aspect-2/3 overflow-hidden rounded-lg bg-white/5">
      <SafeImage src={src} alt={alt} fill className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" sizes="(max-width: 639px) 42vw, (max-width: 1023px) 23vw, 15vw" />
      <span className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:flex" aria-hidden="true">
        <Play className="size-12 rounded-full bg-black/60 p-3 text-white" />
      </span>
    </div>
    <p className="mt-2 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-white/90">{title}</p>
  </Link>
);
