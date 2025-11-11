"use client";
import { useState } from "react";
import { ProgramCard } from "./ProgramCard";

interface ProgramItem {
  id: string;
  src: string;
  alt: string;
  title: string;
  slug: string;
  genre?: string;
}

interface ProgramGridProps {
  programs: ProgramItem[];
  filters?: string[] | null;
}

export const ProgramGrid = ({ programs, filters = null }: ProgramGridProps) => {
  const [activeFilter, setActiveFilter] = useState("All");
  console.log(programs);

  const programFilters = new Set(filters);
  programFilters.add("All");

  const filteredPrograms =
    activeFilter === "All"
      ? programs
      : programs.filter(
          (program) => program.genre && program.genre.includes(activeFilter),
        );
  return (
    <>
      <div className="flex items-center space-x-10 px-4 sm:px-12 m-10 sm:my-20 overflow-x-auto py-2 mt-20">
        {filters &&
          [...programFilters].sort().map((filter, index) => (
            <span
              key={index}
              className={`text-sm whitespace-nowrap cursor-pointer capitalize ${
                activeFilter === filter
                  ? "text-[#ffd700] font-semibold"
                  : "text-white/60 font-normal"
              }`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </span>
          ))}
      </div>
      <section className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:gap-14 px-4 sm:px-12">
        {filteredPrograms &&
          filteredPrograms.map((program, index) => (
            <ProgramCard key={index} {...program} href={`/${program.slug}`} />
          ))}
      </section>
    </>
  );
};
