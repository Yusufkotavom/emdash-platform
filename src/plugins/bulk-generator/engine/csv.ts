export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Robust CSV parser supporting quotes, commas, and newlines.
 */
export function parseCsv(text: string): ParsedCsv {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  function parseRow(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  const rawHeaders = parseRow(lines[0]);
  const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, "").trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] !== undefined ? values[idx].replace(/^["']|["']$/g, "") : "";
    });
    rows.push(row);
  }

  return { headers, rows };
}
