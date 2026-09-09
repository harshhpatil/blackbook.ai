import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import mammoth from "mammoth";

// Reads ANY .docx template and returns the list of {{field}} placeholder names
export async function extractPlaceholders(templatePath) {
  const { value: text } = await mammoth.extractRawText({ path: templatePath });
  const matches = [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)];
  const fieldNames = [...new Set(matches.map((m) => m[1]))];
  return fieldNames;
}

export function fillTemplate(templatePath, textData, diagramsMap = {}, outputFilename) {
  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);

  // 1. Inject diagrams directly into DOCX OpenXML structure if diagrams are provided
  if (diagramsMap && Object.keys(diagramsMap).length > 0) {
    prepareAndInjectDiagrams(zip, diagramsMap);
  }

  // 2. Render text placeholders using docxtemplater
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });

  doc.render(textData);

  const buf = doc.getZip().generate({ type: "nodebuffer" });
  const outputsDir = path.join(path.dirname(templatePath), "..", "outputs");
  if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

  const outPath = path.join(outputsDir, outputFilename);
  fs.writeFileSync(outPath, buf);
  return outPath;
}

function prepareAndInjectDiagrams(zip, diagramsMap) {
  let docXml = zip.file("word/document.xml")?.asText();
  if (!docXml) return;

  // Build the complete Chapter 5 Figures section if explicit individual tags are not in the template
  const standardFiguresKeys = [
    "fig_5_1_dfd0",
    "fig_5_2_dfd1",
    "fig_5_3_dfd2",
    "fig_5_4_block_diagram",
    "fig_5_5_activity_diagram",
    "fig_5_6_use_case",
  ];

  const hasAnyExplicitFigTag = standardFiguresKeys.some((k) => docXml.includes(`{{${k}}}`));

  if (!hasAnyExplicitFigTag && docXml.includes("{{ch5_1_architecture}}")) {
    let figuresXmlSnippet = "{{ch5_1_architecture}}";
    for (const key of standardFiguresKeys) {
      if (diagramsMap[key]) {
        figuresXmlSnippet += `\n\n{{${key}}}`;
      }
    }
    docXml = docXml.replace("{{ch5_1_architecture}}", figuresXmlSnippet);
  }

  // Also support legacy/generic tags
  if (!docXml.includes("{{fig_architecture}}") && diagramsMap.fig_architecture && docXml.includes("{{ch5_1_architecture}}")) {
    docXml = docXml.replace("{{ch5_1_architecture}}", "{{ch5_1_architecture}}\n\n{{fig_architecture}}");
  }

  zip.file("word/document.xml", docXml);

  // Inject image drawings & media relationships
  injectImagesIntoDocx(zip, diagramsMap);
}

function injectImagesIntoDocx(zip, diagramsMap) {
  let docXml = zip.file("word/document.xml").asText();
  let relsXml =
    zip.file("word/_rels/document.xml.rels")?.asText() ||
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
  let contentTypesXml = zip.file("[Content_Types].xml")?.asText() || "";

  if (!contentTypesXml.includes('Extension="png"')) {
    contentTypesXml = contentTypesXml.replace(
      "</Types>",
      '  <Default Extension="png" ContentType="image/png"/>\n</Types>'
    );
    zip.file("[Content_Types].xml", contentTypesXml);
  }

  const rIdMatches = [...relsXml.matchAll(/Id="rId(\d+)"/g)];
  let maxRId = rIdMatches.reduce((max, m) => Math.max(max, parseInt(m[1], 10)), 20);

  const existingMedia = Object.keys(zip.files).filter((k) => k.startsWith("word/media/"));
  let imgIndex = existingMedia.length + 1;

  for (const [key, diagram] of Object.entries(diagramsMap)) {
    const placeholder = `{{${key}}}`;
    if (!docXml.includes(placeholder)) continue;
    if (!diagram.buffer) continue;

    const rId = `rIdImg${maxRId++}`;
    const mediaName = `figure_${key}_${imgIndex++}.png`;
    const mediaPath = `word/media/${mediaName}`;

    // Add PNG to word/media/
    zip.file(mediaPath, diagram.buffer);

    // Add relationship
    const relTag = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/>`;
    relsXml = relsXml.replace("</Relationships>", `  ${relTag}\n</Relationships>`);

    // Dimensions: 580px width x 300px height
    const widthPx = diagram.widthPx || 580;
    const heightPx = diagram.heightPx || 300;
    const cx = Math.round(widthPx * 9525);
    const cy = Math.round(heightPx * 9525);

    const titleText = diagram.title || diagram.caption || `Figure: ${key}`;
    const descriptionText = diagram.description || "";

    // Exact formal styling matching the university black book layout
    const captionXml = `
<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
    <w:spacing w:before="80" w:after="80"/>
  </w:pPr>
  <w:r>
    <w:rPr><w:b/><w:i/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr>
    <w:t>${escapeXml(titleText)}</w:t>
  </w:r>
</w:p>`;

    const descXml = descriptionText
      ? `
<w:p>
  <w:pPr>
    <w:jc w:val="both"/>
    <w:spacing w:before="60" w:after="160"/>
    <w:ind w:firstLine="360"/>
  </w:pPr>
  <w:r>
    <w:rPr><w:sz w:val="24"/><w:color w:val="000000"/></w:rPr>
    <w:t>${escapeXml(descriptionText)}</w:t>
  </w:r>
</w:p>`
      : "";

    const drawingXml = `</w:t></w:r></w:p>
<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
    <w:spacing w:before="180" w:after="80"/>
  </w:pPr>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:docPr id="${maxRId + 100}" name="${escapeXml(key)}"/>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="${maxRId + 100}" name="${escapeXml(key)}"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>
${captionXml}
${descXml}
<w:p><w:r><w:t>`;

    docXml = docXml.replaceAll(placeholder, drawingXml);
  }

  zip.file("word/document.xml", docXml);
  zip.file("word/_rels/document.xml.rels", relsXml);
}

function escapeXml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}
