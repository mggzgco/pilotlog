export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: "," | "\t";
};

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(text: string): "," | "\t" {
  const sample = text.slice(0, 2000);
  const commas = (sample.match(/,/g) ?? []).length;
  const tabs = (sample.match(/\t/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

// Minimal CSV/TSV parser good enough for LogTen exports (1 header row + values).
// Supports quoted values with escaped quotes ("").
export function parseCsv(text: string): ParsedCsv {
  const normalized = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = detectDelimiter(normalized);
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], delimiter };
  }

  const parseLine = (line: string) => {
    const out: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          const next = line[i + 1];
          if (next === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === delimiter) {
          out.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
    }
    out.push(current);
    return out.map((v) => v.trim());
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] ?? "";
    }
    rows.push(row);
  }
  return { headers, rows, delimiter };
}

export function toCsv(headers: string[], rows: Record<string, string>[], delimiter: "," | "\t" = ",") {
  const escape = (value: string) => {
    const needsQuotes = value.includes('"') || value.includes("\n") || value.includes(delimiter);
    const escaped = value.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };
  const headerLine = headers.map(escape).join(delimiter);
  const lines = rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(delimiter));
  return [headerLine, ...lines].join("\n");
}

