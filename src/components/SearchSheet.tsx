"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Searchbar } from "./Searchbar";

export const SearchSheet = () => {
  const [open, setOpen] = useState(false);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger className="header-account" aria-label="Search catalogue"><Search size={22} /><span className="hidden lg:inline">Search</span></SheetTrigger>
    <SheetContent side="top" className="search-sheet border-none bg-neutral-950 px-5 pb-8 pt-6 text-white sm:px-10">
      <div className="mx-auto w-full max-w-2xl">
        <SheetHeader className="px-0 pt-0"><SheetTitle className="text-xl">Search CBM TV</SheetTitle><SheetDescription className="text-white/60">Find movies, series and more.</SheetDescription></SheetHeader>
        <Searchbar onNavigate={() => setOpen(false)} />
      </div>
    </SheetContent>
  </Sheet>;
};
