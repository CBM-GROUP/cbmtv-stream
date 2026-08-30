import { ProgramCard } from "@/components/ProgramCard";
import { listContent } from "@/services/content";
import type { Program, ProgramCardItem } from "@/types";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CBM TV | Programs",
  description: "Browse all the programs available on CBM TV.",
};

export default async function ProgramsPage() {
  let programs: ProgramCardItem[] = [];
  try {
    const response = await listContent();
    if (response && Array.isArray(response)) {
      programs = response.map((program: Program) => ({
        id: program.id,
        src: program.thumbnail,
        title: program.title,
        alt: program.title,
        slug: `programs/${program.id}`,
      }));
    }
  } catch (error) {
    console.error("Error fetching programs:", error);
  }

  return (
    <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-10 px-4 sm:px-12 mt-10 mb-24">
      {programs.map((program: ProgramCardItem, index: number) => (
        <ProgramCard
          href={`/programs/${program.id}`}
          key={index}
          {...program}
        />
      ))}
    </section>
  );
}
