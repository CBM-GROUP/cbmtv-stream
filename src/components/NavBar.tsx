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
  { href: "/trends", label: "Trends" },
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
      <Link href="/" aria-label="CBM TV home" className="flex h-full shrink-0 items-center rounded"><Image src="/images/cbm logo (1).png" width={500} height={500} className="brand-logo h-28 w-28 md:h-36 md:w-36" sizes="(min-width: 768px) 144px, 112px" alt="CBM TV" priority /></Link>
      <nav className="ml-4 hidden items-center gap-1 text-sm font-medium md:flex lg:ml-8 lg:gap-3" aria-label="Main navigation">
        {links.map((link) => <Link key={link.href} href={link.href} aria-current={(link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)) ? "page" : undefined} className="main-nav-link">{link.label}</Link>)}
      </nav>
      <div className="ml-auto flex items-center gap-1 sm:gap-3">
        <SearchSheet />
        {user ? <Popover><PopoverTrigger className="header-account" aria-label="Profile menu" aria-current={pathname.startsWith("/profile") ? "page" : undefined}><UserRound size={21} /><span className="hidden lg:inline">Profile</span></PopoverTrigger>
          <PopoverContent align="end" className="w-52 border-white/10 bg-neutral-900 text-white"><p className="truncate px-2 pb-3 text-sm text-white/60">{user.name}</p><Link href="/profile/edit" className="flex min-h-11 items-center rounded p-2 hover:bg-white/10">Profile</Link><Link href="/saved" className="flex min-h-11 items-center rounded p-2 hover:bg-white/10">My List</Link><Link href="/continue-watching" className="flex min-h-11 items-center rounded p-2 hover:bg-white/10">Continue Watching</Link><button onClick={logout} className="flex min-h-11 w-full items-center gap-2 rounded p-2 text-left hover:bg-white/10"><LogOut size={16} />Sign out</button></PopoverContent>
        </Popover> : <Link href="/sign-in" aria-label="Profile — sign in" aria-current={pathname === "/sign-in" ? "page" : undefined} className="header-account"><UserRound size={21} /><span className="hidden sm:inline">Profile</span></Link>}
        <div className="md:hidden"><Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger className="header-icon" aria-label="Open navigation"><Menu size={23} /></SheetTrigger>
          <SheetContent side="right" className="navigation-sheet overflow-y-auto border-none bg-neutral-950 p-5 text-white">
            <SheetHeader className="px-0"><SheetTitle>CBM TV</SheetTitle><SheetDescription>Discover your next watch.</SheetDescription></SheetHeader>
            <nav className="flex flex-col gap-2" aria-label="Mobile navigation">{links.map((link) => <Link key={link.href} href={link.href} aria-current={(link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)) ? "page" : undefined} onClick={() => setMenuOpen(false)} className="main-nav-link">{link.label}</Link>)}
              <Link href={user ? "/profile/edit" : "/sign-in"} aria-current={pathname.startsWith("/profile") || pathname === "/sign-in" ? "page" : undefined} onClick={() => setMenuOpen(false)} className="main-nav-link">Profile{!user && <span className="ml-auto text-xs text-white/50">Sign in</span>}</Link>
            </nav>
          </SheetContent>
        </Sheet></div>
      </div>
    </div>
  </header>;
};
