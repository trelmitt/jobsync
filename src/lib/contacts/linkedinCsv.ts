import Papa from "papaparse";

export interface LinkedInConnection {
  name: string;
  firstName: string;
  url: string | null;
  email: string | null;
  company: string | null;
  position: string | null;
}

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

// LinkedIn's Connections.csv (Settings → Data privacy → Get a copy of your
// data) opens with a few "Notes:" lines before the real header row.
export function parseLinkedInConnections(csv: string): LinkedInConnection[] {
  const start = csv.search(/^First Name,/m);
  if (start < 0) return [];
  const { data } = Papa.parse<Record<string, string>>(csv.slice(start), {
    header: true,
    skipEmptyLines: true,
  });
  return data.flatMap((row) => {
    const firstName = clean(row["First Name"]) ?? "";
    const name = [firstName, clean(row["Last Name"])].filter(Boolean).join(" ");
    if (!name) return [];
    return [
      {
        name,
        firstName,
        url: clean(row["URL"]),
        email: clean(row["Email Address"]),
        company: clean(row["Company"]),
        position: clean(row["Position"]),
      },
    ];
  });
}
