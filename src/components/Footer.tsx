import Image from "next/image";
import Link from "next/link";
import {
  Facebook,
  Instagram,
  MessageCircle,
  Music,
  Twitter,
  Youtube,
} from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-white/5 px-4 py-8 text-center sm:py-10">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3">
        <Link
          href="/"
          aria-label="CBM TV home"
          className="relative block h-14 w-32 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
        >
          <Image
            src="/images/cbm logo (1).png"
            alt="CBM TV"
            fill
            sizes="128px"
            className="object-cover"
          />
        </Link>

        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm leading-6 sm:text-base"
        >
          {/* These pages have no destinations yet; avoid linking them to '#'. */}
          <span className="text-slate-300">Privacy Policy</span>
          <span className="text-slate-300">Terms of Use</span>
          <a
            href="https://cbmbrothers.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded text-sky-300 transition-colors hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            Advertise
          </a>
          <span className="text-slate-300">Contact Us</span>
          <span className="text-slate-300">Help</span>
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
          <span role="img" aria-label="WhatsApp" className="text-slate-400">
            <MessageCircle size={22} aria-hidden="true" />
          </span>
          <span role="img" aria-label="TikTok" className="text-slate-400">
            <Music size={22} aria-hidden="true" />
          </span>
        </nav>

        <p className="text-xs leading-5 text-slate-400 sm:text-sm">
          Copyright &copy; {new Date().getFullYear()} CBM TV – A product of CBM
          Group. All rights reserved.
        </p>
      </div>
    </footer>
  );
};
