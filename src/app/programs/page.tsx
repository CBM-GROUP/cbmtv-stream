import { CatalogueBrowser } from "@/components/CatalogueBrowser";
import { BROWSE_CATEGORIES } from "@/lib/catalogue";

export const metadata = { title: "CBM TV | Explore", description: "Discover movies, series and more on CBM TV." };

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  return <CatalogueBrowser category={category === "miniseries" ? "series" : BROWSE_CATEGORIES.find((item) => item.type === category)?.type} />;
}
