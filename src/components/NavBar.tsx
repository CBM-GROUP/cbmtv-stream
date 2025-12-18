"use client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { Menu, Power } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { LoginForm } from "./LoginForm";
import { Searchbar } from "./Searchbar";
import { Button } from "./ui/button";

export const NavBar = () => {
  const { user, login, logout } = useAuth();
  const links = [
    { href: "/", label: "Stream Bird" },
    { href: "/channels", label: "Channel Box" },
    { href: "/programs", label: "Trends" },
  ];

  useEffect(() => {
    // You can add any side effects related to user authentication heres
  }, [user]);

  return (
    <section className="sticky top-0 bg-background z-50 py-4">
      <header className="w-screen px-4 sm:px-10 flex items-center justify-between">
        <div className="flex items-center space-x-12">
          <Link href="/">
            <Image
              src="/images/cbm logo (1).png"
              width={500}
              height={500}
              className="h-14 w-32 object-cover object-center"
              alt="CMB TV Logo"
            />
          </Link>
          <nav className="hidden md:flex space-x-6 items-center text-sm">
            {links.map((link, index) => (
              <Link key={index} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex space-x-4 justify-end">
            <Searchbar />

            {user ? (
              <Popover>
                <PopoverTrigger>
                  <div className="flex items-center space-x-2">
                    {user.image ? (
                      <Image
                        src={user.image} // Use a default avatar if user.image is not available
                        width={40}
                        height={40}
                        alt="User Avatar"
                        className="rounded-lg cursor-pointer w-12 h-12 object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-cyan-600 overflow-hidden flex items-center justify-center text-white font-bold cursor-pointer">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48">
                  <Link
                    href="/profile/edit"
                    className="rounded-lg h-12 py-6 w-full text-black capitalize flex items-center space-x-3 text-sm px-4"
                  >
                    <span>Profile</span>
                  </Link>
                  <button
                    onClick={logout}
                    className="rounded-lg h-12 py-6 w-full text-black capitalize flex items-center space-x-3 text-sm px-4"
                  >
                    <Power size={16} />
                    <span>Logout</span>
                  </button>
                </PopoverContent>
              </Popover>
            ) : (
              <Sheet>
                <SheetTrigger asChild>
                  <Button className="rounded-lg bg-[#01BEA5] h-12 py-6 min-w-32 text-black capitalize">
                    Sign in
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="top"
                  className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-fit p-5 pb-14 rounded-xl shadow-[0_0_0_100vw_rgba(0,0,0,0.6)] bg-white px-8 sm:px-14 max-w-lg w-[calc(100%-20px)]"
                >
                  <SheetHeader className="px-0">
                    <SheetTitle className="text-black text-2xl">
                      Sign In
                    </SheetTitle>
                    <SheetDescription>
                      Enter your credentials to access your account.
                    </SheetDescription>
                  </SheetHeader>
                  <LoginForm />
                </SheetContent>
              </Sheet>
            )}
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="border-none p-4 h-full ">
                <SheetHeader>
                  <SheetTitle>
                    {/*<Image src="/images/CBM TV cyan Logo.png" width={200} height={200} className="h-10 w-auto" alt="CMB TV Logo" />*/}
                  </SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  <div className="mt-6 flex flex-col items-center space-y-4 h-full justify-between">
                    {user && (
                      <>
                        <div className="flex flex-col items-center justify-center space-y-4">
                          {user.image ? (
                            <Image
                              src={user.image} // Use a default avatar if user.image is not available
                              width={40}
                              height={40}
                              alt="User Avatar"
                              className="rounded-full cursor-pointer h-20 w-20 object-cover shrink-0 grow-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-cyan-600 overflow-hidden flex items-center justify-center text-white font-bold cursor-pointer">
                              {user.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-white">{user.name}</span>
                        </div>
                      </>
                    )}

                    <nav className="flex items-center text-center flex-col space-y-4">
                      {links.map((link, index) => (
                        <Link key={index} href={link.href} className="text-lg">
                          {link.label}
                        </Link>
                      ))}
                      {user && (
                        <Link
                          href="/profile/edit"
                          className="text-center text-lg"
                        >
                          Profile
                        </Link>
                      )}
                    </nav>
                    {user ? (
                      <Button
                        onClick={logout}
                        className="rounded-lg border border-white/20 h-12 py-6 w-full capitalize bg-transparent text-white"
                      >
                        Logout
                      </Button>
                    ) : (
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button className="rounded-lg border border-white/20 h-12 py-6 w-full capitalize bg-transparent text-white">
                            Sign in
                          </Button>
                        </SheetTrigger>
                        <SheetContent
                          side="top"
                          className="w-[calc(100%-20px)] sm:w-fit top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-fit p-5 pb-14 rounded-xl shadow-[0_0_0_100vw_rgba(0,0,0,0.6)] bg-white px-8 sm:px-14 max-w-lg"
                        >
                          <SheetHeader className="px-0">
                            <SheetTitle className="text-black text-2xl">
                              Sign In
                            </SheetTitle>
                            <SheetDescription>
                              Enter your credentials to access your account.
                            </SheetDescription>
                          </SheetHeader>
                          <LoginForm />
                        </SheetContent>
                      </Sheet>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <div className="px-4 mt-4 md:hidden">
        <Searchbar />
      </div>
    </section>
  );
};
