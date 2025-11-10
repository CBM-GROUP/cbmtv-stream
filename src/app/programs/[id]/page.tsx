import { getContentById } from "@/services/content";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import ProgramDetail from "@/components/ProgramDetail";

type Props = {
  params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = params;
  try {
    const response = await getContentById(id);
    const program = response.data;
    return {
      title: `CBM TV | ${program.title}`,
      description: program.description,
    };
  } catch (error) {
    console.error("Error fetching program for metadata:", error);
    return {
      title: "CBM TV | Program",
      description: "Program not found.",
    };
  }
}

export default async function ProgramDetailPage({ params }: Props) {
  const { id } = params;
  let program = null;
  try {
    const response = await getContentById(id);
    program = response.data;
  } catch (error) {
    console.error("Error fetching program:", error);
    notFound();
  }

  if (!program) {
    notFound();
  }

  return <ProgramDetail program={program} />;
}
