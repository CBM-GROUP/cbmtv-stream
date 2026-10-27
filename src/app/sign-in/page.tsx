import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { safeReturnTo } from "@/lib/auth-return";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return <section className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
    <div className="rounded-xl bg-white p-6 text-neutral-950 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">CBM TV</p>
      <h1 className="mt-2 text-3xl font-bold">Welcome back</h1>
      <p className="mt-3 mb-6 text-sm text-neutral-600">Sign in to start watching. Your selected title will be waiting.</p>
      <LoginForm returnTo={safeReturnTo(returnTo)} />
    </div>
    <Link href={safeReturnTo(returnTo).split("?")[0]} className="mt-6 block text-center text-sm text-white/65 hover:text-white">Continue browsing</Link>
  </section>;
}
