import JSZip from "jszip";
import {
  applyEdits,
  loadDocumentXml,
  readStructure,
  validateEdits,
  writeDocumentXml,
} from "@/lib/tailor/docx";

const p = (text: string, list = false) =>
  `<w:p>${list ? '<w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr>' : ""}` +
  `<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

const SUMMARY = "Seller of AI infrastructure with a 120% quota year and 8 reps led.";
const xml =
  "<w:document><w:body>" +
  [
    p("TREVOR ELMITT"),
    p("SUMMARY"),
    p(SUMMARY),
    p("PROFESSIONAL EXPERIENCE"),
    p("Acme   2020"),
    p("A1", true),
    p("A2", true),
    p("A3", true),
    p("EDUCATION"),
    p("E1", true),
    p("E2", true),
  ].join("") +
  "<w:sectPr/></w:body></w:document>";

describe("tailor docx", () => {
  it("finds the summary and the reorderable bullet groups, not education", () => {
    const s = readStructure(xml);
    expect(s.summaryIndex).toBe(2);
    expect(s.groups).toEqual([[5, 6, 7]]);
  });

  it("rewrites only the summary and permutes bullets inside their group", () => {
    const s = readStructure(xml);
    const out = applyEdits(xml, s, { summary: "Infra & AI seller.", orders: [[2, 0, 1]] });
    const texts = readStructure(out).texts;
    expect(texts[2]).toBe("Infra & AI seller.");
    expect(texts.slice(5, 8)).toEqual(["A3", "A1", "A2"]);
    expect(texts.slice(9)).toEqual(["E1", "E2"]);
    expect(out).toContain("Infra &amp; AI seller.");
    expect(out).toContain("<w:sectPr/>");
  });

  it("keeps the original wherever the model's edits could change a fact", () => {
    const s = readStructure(xml);
    const ok = validateEdits({ summary: "AI infrastructure seller: 120% quota year, 8 reps.", orders: [[1, 2, 0]] }, s);
    expect(ok.rejected).toEqual([]);
    expect(ok.edits.orders).toEqual([[1, 2, 0]]);
    expect(ok.edits.summary).toBeDefined();

    const bad = validateEdits({ summary: "AI infrastructure seller with a 200% quota year, 9 reps.", orders: [[0, 0, 1]] }, s);
    expect(bad.edits.summary).toBeUndefined();
    expect(bad.edits.orders).toEqual([[0, 1, 2]]);
    expect(bad.rejected).toEqual([
      "bullet group 1: not a reorder of its bullets",
      "summary: introduced numbers not on the resume (200, 9)",
    ]);

    const claim = validateEdits({ summary: "Seller of AI infrastructure with co-marketing wins led." }, s);
    expect(claim.edits.summary).toBeUndefined();
    expect(claim.rejected).toEqual(["summary: introduced words not on the resume (co-marketing, wins)"]);

    expect(validateEdits(null, s).edits).toEqual({ orders: [[0, 1, 2]] });
  });

  it("round-trips through the zip without touching other parts", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", xml);
    zip.file("word/styles.xml", "<styles/>");
    const docx = await zip.generateAsync({ type: "uint8array" });

    const loaded = await loadDocumentXml(docx);
    const s = readStructure(loaded.xml);
    const out = await writeDocumentXml(loaded.zip, applyEdits(loaded.xml, s, { orders: [[2, 1, 0]] }));

    const again = await JSZip.loadAsync(out);
    expect(await again.file("word/styles.xml")!.async("string")).toBe("<styles/>");
    const texts = readStructure(await again.file("word/document.xml")!.async("string")).texts;
    expect(texts.slice(5, 8)).toEqual(["A3", "A2", "A1"]);
  });
});
