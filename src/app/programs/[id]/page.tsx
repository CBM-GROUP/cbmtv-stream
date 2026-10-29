import { getContentById } from "@/services/content";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import ProgramDetail from "@/components/ProgramDetail";
import { cache } from "react";
import { isAxiosError } from "axios";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  try {
    const program = await getProgram(id);

    if (!program) {
      notFound();
    }

    if (program.data.status !== "approved") notFound();
    const query = await searchParams;
    const valid = (value: string | string[] | undefined) => typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
    const invalid = Boolean((query.episode && !valid(query.episode)) || (query.part && !valid(query.part)) || (query.episode && query.part));
    return <ProgramDetail key={program.data.id} program={program.data} requested={{ episode: valid(query.episode) ? Number(query.episode) : undefined, miniseries: valid(query.part) ? Number(query.part) : undefined, invalid }} />;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) notFound();
    throw error;
  }
}
