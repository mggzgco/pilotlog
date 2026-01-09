import { requireUser } from "@/app/lib/auth/session";
import { ImportClient } from "@/app/(dashboard)/import/import-client";

export default async function ImportPage({
  searchParams
}: {
  searchParams?: { flightId?: string };
}) {
  await requireUser();

  const flightId = searchParams?.flightId ?? null;

  return <ImportClient flightId={flightId} />;
}
