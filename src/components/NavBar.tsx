"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SearchSheet } from "./SearchSheet";

const links = [
  { href: "/", label: "Stream Bird" },
  { href: "/channels", label: "Channel Box" },
  { href: "/programs", label: "Trends" },
];

export const NavBar = () => {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return <header className={`site-header ${pathname === "/" ? "site-header-home" : ""} ${pathname === "/" && !scrolled ? "site-header-overlay" : "site-header-solid"}`}>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div className="site-header-inner">
      <Link href="/" aria-label="CBM TV home" className="flex h-full shrink-0 items-center rounded"><Image src="/images/cbm logo (1).png" width={500} height={500} className="brand-logo h-28 w-28 min-[360px]:h-32 min-[360px]:w-32 md:h-40 md:w-40" sizes="(min-width: 768px) 160px, (min-width: 360px) 128px, 112px" alt="CBM TV" priority /></Link>
      <nav className="ml-7 hidden items-center gap-6 text-sm font-medium md:flex" aria-label="Main navigation">
        {links.map((link) => <Link key={link.href} href={link.href} aria-current={link.href === pathname ? "page" : undefined} className="whitespace-nowrap text-white/80 hover:text-teal-300">{link.label}</Link>)}
      </nav>
      <div className="ml-auto flex items-center gap-1 sm:gap-3">
        <SearchSheet />
        {user ? <Popover><PopoverTrigger className="header-icon" aria-label="Account menu"><UserRound size={21} /></PopoverTrigger>
          <PopoverContent align="end" className="w-52 border-white/10 bg-neutral-900 text-white"><p className="truncate px-2 pb-3 text-sm text-white/60">{user.name}</p><Link href="/profile/edit" className="block rounded p-2 hover:bg-white/10">Profile</Link><button onClick={logout} className="flex w-full items-center gap-2 rounded p-2 text-left hover:bg-white/10"><LogOut size={16} />Sign out</button></PopoverContent>
        </Popover> : <Link href="/sign-in" className="rounded-md bg-teal-400 px-3 py-2 text-sm font-semibold whitespace-nowrap text-black hover:bg-teal-300 sm:px-5">Sign in</Link>}
        <div className="md:hidden"><Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger className="header-icon" aria-label="Open navigation"><Menu size={23} /></SheetTrigger>
          <SheetContent side="right" className="border-none bg-neutral-950 p-5 text-white">
            <SheetHeader className="px-0"><SheetTitle>CBM TV</SheetTitle><SheetDescription>Discover your next watch.</SheetDescription></SheetHeader>
            <nav className="flex flex-col gap-2" aria-label="Mobile navigation">{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-3 hover:bg-white/10">{link.label}</Link>)}</nav>
            {user && <Link href="/profile/edit" onClick={() => setMenuOpen(false)} className="px-3 py-3">Profile</Link>}
          </SheetContent>
        </Sheet></div>
      </div>
    </div>
  </header>;
};
