import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { LogTenSyncClient } from "@/app/(dashboard)/logbook/sync/logten/sync-client";

export default function LogTenSyncPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">LogTen Sync</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Compare FlightTraks to a LogTen export file, then import/export missing entries.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/logbook">Back to logbook</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Sync</p>
        </CardHeader>
        <CardContent>
          <LogTenSyncClient />
          <p className="mt-4 text-xs text-slate-500">
            Note: LogTen does not expose a public sync API; this flow uses export/import files. See LogTen guides at{" "}
            <Link className="underline" href="https://support.logten.com/en/collections/13713784-user-guides">
              User Guides
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

