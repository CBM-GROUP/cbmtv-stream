import { getContentById } from "@/services/content";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import ProgramDetail from "@/components/ProgramDetail";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const program = await getContentById(params.id);
    return {
      title: `CBM TV | ${program.data.title}`,
      description: program.data.description,
    };
  } catch (error) {
    return {
      title: "CBM TV | Program not found",
      description: "The requested program could not be found.",
    };
  }
}

export default async function ProgramDetailPage({
  params,
}: {
  params: { id: string };
}) {
  try {
    const awaitedParams = await params;
    const program = await getContentById(awaitedParams.id);

    if (!program) {
      notFound();
    }

    return <ProgramDetail program={program.data} />;
  } catch (error) {
    notFound();
  }
}
