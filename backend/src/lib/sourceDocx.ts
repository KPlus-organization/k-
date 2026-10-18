import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { xml2js, js2xml, type Element } from "xml-js";

type Paragraph = {
  text: string;
  sourceParagraph?: number;
  blankBefore?: number;
};
const child = (node: Element, name: string) =>
  node.elements?.find((item) => item.name === name);
const textContent = (node: Element): string =>
  node.type === "text"
    ? String(node.text ?? "")
    : (node.elements ?? []).map(textContent).join("");

/** Reuses the author's actual page settings, paragraph/run styles, fonts and theme.
 * Only the document body is replaced; UI explanations never participate in export.
 */
export async function fillSourceDocx(
  sourcePath: string,
  paragraphs: Paragraph[],
): Promise<Buffer> {
  const archive = await JSZip.loadAsync(await readFile(sourcePath));
  const document = xml2js(
    await archive.file("word/document.xml")!.async("string"),
  ) as Element;
  const body = child(child(document, "w:document")!, "w:body")!;
  const original = body.elements!.filter((item) => item.name === "w:p");
  const section = child(body, "w:sectPr")!;
  const output: Element[] = [];
  for (const paragraph of paragraphs) {
    const source = original[paragraph.sourceParagraph ?? -1];
    if (!source) throw new Error("Missing DOCX source paragraph mapping");
    if (paragraph.blankBefore !== undefined) {
      const blank = original[paragraph.blankBefore];
      if (!blank || textContent(blank).trim())
        throw new Error("Invalid spacer paragraph");
      output.push(structuredClone(blank));
    }
    if (textContent(source).trim() === paragraph.text.trim()) {
      output.push(structuredClone(source));
      continue;
    }
    const runs = source.elements?.filter((item) => item.name === "w:r") ?? [];
    // Red text and bold/italic bracketed instructions are authoring annotations.
    // Prefer the regular text run from the source for the filled paragraph.
    const regular =
      runs.find(
        (run) =>
          textContent(run).trim() &&
          !textContent(run).includes("[") &&
          !child(child(run, "w:rPr") ?? {}, "w:color") &&
          !child(child(run, "w:rPr") ?? {}, "w:i"),
      ) ?? runs[0];
    const runProperties = structuredClone(
      child(regular ?? {}, "w:rPr") ?? {
        type: "element",
        name: "w:rPr",
        elements: [],
      },
    );
    runProperties.elements = (runProperties.elements ?? []).filter(
      (item) => item.name !== "w:color" && item.name !== "w:highlight",
    );
    const content: Element[] = [];
    for (const [index, line] of paragraph.text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .entries()) {
      if (index) content.push({ type: "element", name: "w:br" });
      content.push({
        type: "element",
        name: "w:t",
        attributes: { "xml:space": "preserve" },
        elements: [{ type: "text", text: line }],
      });
    }
    const properties = child(source, "w:pPr");
    output.push({
      type: "element",
      name: "w:p",
      elements: [
        ...(properties ? [structuredClone(properties)] : []),
        { type: "element", name: "w:r", elements: [runProperties, ...content] },
      ],
    });
  }
  body.elements = [...output, section];
  archive.file("word/document.xml", js2xml(document));
  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
