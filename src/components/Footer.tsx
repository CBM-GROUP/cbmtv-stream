import Image from "next/image";
import Link from "next/link";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
} from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-black/30 px-4 py-6 text-center sm:py-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3">
        <Link
          href="/"
          aria-label="CBM TV home"
          className="flex h-20 w-48 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 sm:w-52"
        >
          <Image
            src="/images/cbm logo (1).png"
            alt="CBM TV"
            width={500}
            height={500}
            sizes="(min-width: 640px) 208px, 192px"
            className="brand-logo h-48 w-48 sm:h-52 sm:w-52"
          />
        </Link>

        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm leading-6 sm:text-base"
        >
          <Link href="/programs" className="text-slate-300 hover:text-teal-300">Browse</Link>
          <Link href="/channels" className="text-slate-300 hover:text-teal-300">Channels</Link>
          <a
            href="https://cbmbrothers.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded text-sky-300 transition-colors hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            Advertise
          </a>
        </nav>

        <nav
          aria-label="Social media"
          className="flex flex-wrap items-center justify-center gap-4 text-slate-300"
        >
          <a
            href="https://www.facebook.com/cbmbrotherscbm"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="rounded transition-colors hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            <Facebook size={22} aria-hidden="true" />
          </a>
          <a
            href="https://x.com/CBMBrothers"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter"
            className="rounded transition-colors hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            <Twitter size={22} aria-hidden="true" />
          </a>
          <a
            href="https://www.instagram.com/cbmbrothers/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="rounded transition-colors hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            <Instagram size={22} aria-hidden="true" />
          </a>
          <a
            href="https://www.youtube.com/@CBMTVUG"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
            className="rounded transition-colors hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            <Youtube size={22} aria-hidden="true" />
          </a>
        </nav>

        <p className="text-xs leading-5 text-slate-400 sm:text-sm">
          Copyright &copy; {new Date().getFullYear()} CBM TV – A product of CBM
          Group. All rights reserved.
        </p>
      </div>
    </footer>
  );
};
