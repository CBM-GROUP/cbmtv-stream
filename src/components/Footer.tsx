"use client";

import {
  Facebook,
  Instagram,
  Youtube,
  Twitter,
  MessageCircle,
  Music,
} from "lucide-react";
import Image from "next/image";


export const Footer = () => {
  return (
    <footer
      className="footer bg-white/5 text-[#fff] text-center py-16 space-y-14 px-10"
    >
      {/* Privacy Section */}
      <div className="mx-auto  justify-center flex-col items-center space-y-2 sm:flex-row sm:space-x-5 sm:space-y-0 leading-loose font-light text-white/50">
        <a className="hover:text-white whitespace-nowrap" href="#">Privacy Policy</a>
        <a className="hover:text-white whitespace-nowrap" href="#">Terms of Use</a>
        <a className="hover:text-white" href="https://cbmbrothers.org/" target="_blank" rel="noopener noreferrer">Advertise</a>
        <a className="hover:text-white" href="#" >Contact Us</a>
      </div>

      {/* Social Media */}

      <div className="mx-auto flex items-center space-x-5 justify-center">
        <a href="https://www.facebook.com/cbmbrotherscbm" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Facebook size={24} /></a>
        <a href="https://x.com/CBMBrothers" target="_blank" rel="noopener noreferrer" aria-label="Twitter"><Twitter size={24} /></a>
        <a href="https://www.instagram.com/cbmbrothers/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram size={24} /></a>
        <a href="https://www.youtube.com/@CBMTVUG" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Youtube size={24} /></a>
        <a href="#" aria-label="WhatsApp"><MessageCircle size={24} /></a>
        <a href="#" aria-label="TikTok"><Music size={24} /></a>

      </div>



      {/* Logo */}
      <div className="mx-auto flex items-center space-x-5 justify-center">
        <Image
          src="/images/CBM TV Yellow Logo.png" // make sure this path is correct
          alt="CBM TV Logo"
          width={100}
          height={40}
        />
      </div>

      {/* CBM Brothers Product Text */}
      <p className="text-[#ccc]/50">
        Copyright &copy; {new Date().getFullYear()} CBM TV – A product of CBM Brothers. All rights reserved.
      </p>
    </footer>
  );
}
