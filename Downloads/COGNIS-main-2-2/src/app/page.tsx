import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
        COGNIS
      </h1>
      <p className="mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
        Create coding &amp; multiple-choice assessments and send candidates a
        link to complete them.
      </p>
      <Link
        href="/login"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        Recruiter Login
      </Link>
    </div>
  );
}
