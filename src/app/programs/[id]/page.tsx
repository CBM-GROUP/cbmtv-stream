import { getContentById } from "@/services/content";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import ProgramDetail from "@/components/ProgramDetail";

export async function generateMetadata({
  params,
}: {
  // Next 16: params is a Promise and must be awaited. Reading params.id
  // directly yields undefined, which fetched /api/content/undefined/ (404)
  // and made every program page fall back to the "not found" title.
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const program = await getContentById(id);
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
  params: Promise<{ id: string }>;
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
