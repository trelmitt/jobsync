import JSZip from "jszip";

// Paragraph-level view of a resume .docx. Tailoring only ever rewrites the one
// summary paragraph and permutes bullets inside a group (a role's run of list
// paragraphs) — the layout, and every fact outside the summary, is untouched.
//
// ponytail: regex over <w:p>, not an XML parser — fine for resumes without
// text boxes (a text box nests a <w:p> inside a <w:p>). Parse properly if one
// ever needs to be supported.
const PARAGRAPH = /<w:p[ >][\s\S]*?<\/w:p>/g;
const TEXT_RUN = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
const SUMMARY_HEADING = /^(professional\s+)?(summary|profile)$/i;
// Bullet order there is conventional (chronological), not a relevance call.
const FIXED_ORDER_HEADING = /education|certification/i;

export interface DocxStructure {
  texts: string[];
  summaryIndex: number | null;
  // Paragraph indices; each group is a consecutive run of list paragraphs.
  groups: number[][];
}

export interface DocxEdits {
  summary?: string;
  // orders[g] is a permutation of 0..groups[g].length-1.
  orders?: number[][];
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const encode = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const paragraphText = (p: string) =>
  decode(Array.from(p.matchAll(TEXT_RUN), (m) => m[1]).join(""));

const isHeading = (text: string) =>
  text.length > 0 && text.length <= 40 && /^[A-Z][A-Z &/]+$/.test(text);

const isListParagraph = (p: string) =>
  p.includes("<w:numPr>") || /<w:pStyle w:val="List[^"]*"/.test(p);

export function readStructure(xml: string): DocxStructure {
  const paragraphs = xml.match(PARAGRAPH) ?? [];
  const texts = paragraphs.map(paragraphText);
  let summaryIndex: number | null = null;
  const groups: number[][] = [];
  let heading = "";
  let run: number[] = [];

  const closeRun = () => {
    if (run.length > 1 && !FIXED_ORDER_HEADING.test(heading)) groups.push(run);
    run = [];
  };

  paragraphs.forEach((p, i) => {
    const text = texts[i].trim();
    if (isListParagraph(p)) {
      run.push(i);
      return;
    }
    closeRun();
    if (isHeading(text)) {
      heading = text;
    } else if (summaryIndex === null && text && SUMMARY_HEADING.test(heading)) {
      summaryIndex = i;
    }
  });
  closeRun();

  return { texts, summaryIndex, groups };
}

function replaceParagraphText(p: string, text: string): string {
  let first = true;
  return p.replace(TEXT_RUN, () => {
    if (!first) return '<w:t xml:space="preserve"></w:t>';
    first = false;
    return `<w:t xml:space="preserve">${encode(text)}</w:t>`;
  });
}

export function applyEdits(xml: string, structure: DocxStructure, edits: DocxEdits): string {
  const paragraphs = xml.match(PARAGRAPH) ?? [];
  const out = [...paragraphs];

  if (edits.summary && structure.summaryIndex !== null) {
    out[structure.summaryIndex] = replaceParagraphText(
      paragraphs[structure.summaryIndex],
      edits.summary,
    );
  }
  edits.orders?.forEach((order, g) => {
    const group = structure.groups[g];
    order.forEach((from, to) => {
      out[group[to]] = paragraphs[group[from]];
    });
  });

  let i = 0;
  return xml.replace(PARAGRAPH, () => out[i++]);
}

const numbersIn = (s: string) =>
  new Set(Array.from(s.matchAll(/\d+(?:[.,]\d+)*/g), (m) => m[0].replace(/,/g, "")));

// Facts are locked, so a rewrite may only recombine the resume's own words:
// any new content word ("co-marketing", a job title he never held) is how a
// small model smuggles in a claim. Naive stemming keeps plurals/tenses legal.
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "");
const contentWords = (s: string) =>
  Array.from(s.toLowerCase().matchAll(/[a-z][a-z'-]{3,}/g), (m) => m[0]);

const isPermutation = (order: unknown, n: number): order is number[] =>
  Array.isArray(order) &&
  order.length === n &&
  [...order].sort((a, b) => a - b).every((v, i) => v === i);

// The model's output is untrusted: anything that could change a fact is
// dropped (the original stays), and the reason is kept for the reviewer.
export function validateEdits(
  raw: unknown,
  structure: DocxStructure,
): { edits: DocxEdits; rejected: string[] } {
  const rejected: string[] = [];
  const obj = (raw && typeof raw === "object" ? raw : {}) as {
    summary?: unknown;
    orders?: unknown;
  };
  const edits: DocxEdits = {};

  const rawOrders = Array.isArray(obj.orders) ? obj.orders : [];
  edits.orders = structure.groups.map((group, g) => {
    if (isPermutation(rawOrders[g], group.length)) return rawOrders[g] as number[];
    if (rawOrders[g] !== undefined) rejected.push(`bullet group ${g + 1}: not a reorder of its bullets`);
    return group.map((_, i) => i);
  });

  if (structure.summaryIndex !== null && typeof obj.summary === "string") {
    const original = structure.texts[structure.summaryIndex];
    const summary = obj.summary.trim();
    const resumeText = structure.texts.join("\n");
    const known = numbersIn(resumeText);
    const invented = [...numbersIn(summary)].filter((n) => !known.has(n));
    const vocab = new Set(contentWords(resumeText).map(stem));
    const newWords = [...new Set(contentWords(summary).filter((w) => !vocab.has(stem(w))))];
    if (summary.length < original.length * 0.5 || summary.length > original.length * 1.6) {
      rejected.push("summary: length too far from the original");
    } else if (invented.length > 0) {
      rejected.push(`summary: introduced numbers not on the resume (${invented.join(", ")})`);
    } else if (newWords.length > 0) {
      rejected.push(`summary: introduced words not on the resume (${newWords.join(", ")})`);
    } else {
      edits.summary = summary;
    }
  }

  return { edits, rejected };
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
