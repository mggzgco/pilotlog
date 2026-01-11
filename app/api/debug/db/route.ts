import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";

function pickDbInfo(urlString: string | undefined) {
  if (!urlString) return null;
  try {
    const url = new URL(urlString);
    return {
      host: url.hostname,
      port: url.port || undefined,
      database: url.pathname?.replace(/^\//, "") || undefined
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table") ?? "ReceiptDocument";
  const column = searchParams.get("column") ?? "flightId";

  // Keep it very limited to avoid turning this into a general SQL probe.
  const allowedTables = new Set(["ReceiptDocument", "Cost", "Flight", "Person"]);
  const allowedColumns = new Set(["flightId", "amountCents", "id", "userId", "costItemId"]);

  if (!allowedTables.has(table) || !allowedColumns.has(column)) {
    return NextResponse.json(
      { error: "Unsupported table/column for debug." },
      { status: 400 }
    );
  }

  const dbUrl = pickDbInfo(process.env.DATABASE_URL);

  const [dbNameRows, schemaRows, colRows] = await Promise.all([
    prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database() AS current_database`,
    prisma.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`,
    prisma.$queryRaw<
      Array<{ column_name: string; data_type: string; is_nullable: string }>
    >`SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table}
      ORDER BY ordinal_position ASC`
  ]);

  const hasColumn = colRows.some((c) => c.column_name === column);

  return NextResponse.json({
    databaseUrl: dbUrl,
    currentDatabase: dbNameRows[0]?.current_database ?? null,
    currentSchema: schemaRows[0]?.schema ?? null,
    table,
    expectedColumn: column,
    hasColumn,
    columns: colRows
  });
}

