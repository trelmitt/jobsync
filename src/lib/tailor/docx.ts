import JSZip from "jszip";

// Paragraph-level view of a resume .docx. Tailoring only permutes bullets
// inside a group (a role's run of list paragraphs), so no wording, fact, or
// formatting ever changes — only which bullet a reader sees first.
//
// ponytail: regex over <w:p>, not an XML parser — fine for resumes without
// text boxes (a text box nests a <w:p> inside a <w:p>). Parse properly if one
// ever needs to be supported.
const PARAGRAPH = /<w:p[ >][\s\S]*?<\/w:p>/g;
const TEXT_RUN = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
// Known section labels in any case, so a title-case "Education" still ends
// the previous section; anything else short and all-caps counts too.
const SECTION_NAME =
  /^((professional|career|work)\s+)?(summary|profile|experience|education|skills|certifications?|achievements|key achievements|projects)$/i;
// Bullet order there is conventional (chronological), not a relevance call.
const FIXED_ORDER_HEADING = /education|certification/i;

export interface DocxStructure {
  texts: string[];
  // Paragraph indices; each group is a consecutive run of list paragraphs.
  groups: number[][];
}

// orders[g] is a permutation of 0..groups[g].length-1.
export type DocxOrders = number[][];

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const paragraphText = (p: string) =>
  decode(Array.from(p.matchAll(TEXT_RUN), (m) => m[1]).join(""));

const isHeading = (text: string) =>
  text.length > 0 && text.length <= 40 && (/^[A-Z][A-Z &/]+$/.test(text) || SECTION_NAME.test(text));

const listLevel = (p: string) => p.match(/<w:ilvl w:val="(\d+)"/)?.[1] ?? "0";

const isListParagraph = (p: string) =>
  p.includes("<w:numPr>") || /<w:pStyle w:val="List[^"]*"/.test(p);

export function readStructure(xml: string): DocxStructure {
  const paragraphs = xml.match(PARAGRAPH) ?? [];
  const texts = paragraphs.map(paragraphText);
  const groups: number[][] = [];
  let heading = "";
  let run: number[] = [];

  // Mixed levels mean sub-bullets: a reorder could move one away from the
  // bullet it belongs to, so those groups are never offered.
  const closeRun = () => {
    const oneLevel = new Set(run.map((i) => listLevel(paragraphs[i]))).size === 1;
    if (run.length > 1 && oneLevel && !FIXED_ORDER_HEADING.test(heading)) groups.push(run);
    run = [];
  };

  paragraphs.forEach((p, i) => {
    if (isListParagraph(p)) {
      run.push(i);
      return;
    }
    closeRun();
    const text = texts[i].trim();
    if (isHeading(text)) heading = text;
  });
  closeRun();

  return { texts, groups };
}

export function applyOrders(xml: string, structure: DocxStructure, orders: DocxOrders): string {
  const paragraphs = xml.match(PARAGRAPH) ?? [];
  const out = [...paragraphs];
  orders.forEach((order, g) => {
    const group = structure.groups[g];
    order.forEach((from, to) => {
      out[group[to]] = paragraphs[group[from]];
    });
  });

  let i = 0;
  return xml.replace(PARAGRAPH, () => out[i++]);
}

// The model only rates bullets (an 8B model can't reliably emit a
// permutation); the order is derived here, so it's always an exact reorder.
// Ties keep their original order. Anything malformed keeps every group as-is.
export function ordersFromScores(
  raw: unknown,
  structure: DocxStructure,
): { orders: DocxOrders; rejected: string[] } {
  const total = structure.groups.reduce((n, group) => n + group.length, 0);
  const scores = (raw && typeof raw === "object" ? (raw as { scores?: unknown }).scores : undefined);
  const valid =
    Array.isArray(scores) && scores.length === total && scores.every((v) => typeof v === "number");
  let offset = 0;
  const orders = structure.groups.map((group) => {
    const own = valid ? (scores as number[]).slice(offset, offset + group.length) : [];
    offset += group.length;
    const order = group.map((_, i) => i);
    return valid ? order.sort((a, b) => own[b] - own[a] || a - b) : order;
  });
  return {
    orders,
    rejected: valid || total === 0 ? [] : [`relevance scores missing or malformed (expected ${total}); kept the original order`],
  };
}

export async function loadDocumentXml(docx: Uint8Array): Promise<{ zip: JSZip; xml: string }> {
  const zip = await JSZip.loadAsync(docx);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("Not a Word document (no word/document.xml)");
  return { zip, xml: await entry.async("string") };
}

export async function writeDocumentXml(zip: JSZip, xml: string): Promise<Buffer> {
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
