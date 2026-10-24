import { getContentById } from "@/services/content";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import ProgramDetail from "@/components/ProgramDetail";
import { cache } from "react";

// Axios does not receive Next's automatic fetch deduplication. Metadata and
// the page both need this record, so share the request within one render.
const getProgram = cache(getContentById);

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
    const program = await getProgram(id);
    return {
      title: `CBM TV | ${program.data.title}`,
      description: program.data.description,
    };
  } catch {
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
    const program = await getProgram(awaitedParams.id);

    if (!program) {
      notFound();
    }

    return <ProgramDetail program={program.data} />;
  } catch {
    notFound();
  }
}
