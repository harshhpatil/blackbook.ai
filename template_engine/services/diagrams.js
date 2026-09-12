import { GoogleGenAI } from '@google/genai';
import { Resvg } from '@resvg/resvg-js';
import { safeJsonParse } from './safeJson.js';
import { getCachedResult, setCachedResult } from './cache.js';
import { recordGeminiFailure, recordGeminiSuccess } from './geminiStatus.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

import { getClient } from './gemini.js';

const DIAGRAM_SYSTEM_INSTRUCTION = `You are an Elite Academic System Architect, Senior Software Engineer, and Technical Thesis Author.
Your task is to analyze project notes, research papers, or project descriptions and generate publication-grade, formal engineering diagrams matching standard University Engineering Final Year Black Books.

You MUST synthesize the exact 6 standard engineering report diagrams:

1. "fig_5_1_dfd0": Fig 5.1 DFD Level 0 (Context Diagram)
   - Must show External Entities (e.g. Admin, Teacher, Student) interacting with the central system process "0.0 [Project Name] - System" and the Database data store.
   - Flowchart/Graph format: flow arrows showing data flows like "Manage Users", "Conduct Attendance", "Reports, Data", "Attendance Records".

2. "fig_5_2_dfd1": Fig 5.2 DFD Level 1 (Data Flow Diagram Level 1)
   - Expands the system into primary functional processes (e.g. "1.0 Data Collection / Registration", "2.0 Core Processing Engine", "3.0 Report Generation").
   - External entities on left, processes in middle, and numbered Data Stores on right: "D1 Registered Master", "D2 Embeddings / Model Weights", "D3 Records / Logs".

3. "fig_5_3_dfd2": Fig 5.3 DFD Level 2 (Detailed Functional DFD)
   - Breaks down internal sub-processes: e.g. "2.1 Encoding / Signal Preprocessing", "2.2 Recognition & Matching", "2.3 Report & Analytics Generation".
   - Connects specific sub-processes to data stores D2, D3, D4.

4. "fig_5_4_block_diagram": Fig 5.4 Block Diagram (Complete System Block Architecture)
   - Professional multi-tier block diagram with subgraphs:
     - "subgraph USERS" (Admin, Teacher, Student)
     - "subgraph INPUT" (Hardware Sensors/Cameras, User Inputs, Config)
     - "subgraph PROCESSING" (Step 1 Detection, Step 2 Preprocessing, Step 3 Feature Encoding, Step 4 Classification/Recognition, Step 5 Database Marking)
     - "subgraph DATA_STORAGE" (Master Database, Model Embeddings, Analytics DB)
     - "subgraph OUTPUT" (Dashboard, Real-time Alerts, Reports & CSV Export)
   - Shows clear interconnecting arrows between layers.

5. "fig_5_5_activity_diagram": Fig 5.5 Activity Diagram (UML Workflow Flowchart)
   - Shows control flow: Start -> Login with Credentials -> Decision {"Valid Credentials?"} -> Role Checks -> Admin Workflow (Manage Users/Subjects) vs Teacher Workflow (Capture & Mark Attendance) vs Student Workflow (View Reports) -> Generate Reports -> End.

6. "fig_5_6_use_case": Fig 5.6 Use Case Diagram (UML Use Case)
   - Shows "System Boundary: [Project Name]" with oval use case nodes: (["Manage Users"]), (["Manage Subjects / Settings"]), (["Start Processing / Session"]), (["Capture Image / Sensor Stream"]), (["View Reports & Analytics"]).
   - Shows Actors connected with lines to their authorized use cases.

CRITICAL MERMAID SYNTAX RULES (MANDATORY TO AVOID PARSER CRASHES):
- EDGE LABELS: ALWAYS write arrow labels using pipe delimiters: NodeA -->|"Label Text"| NodeB or NodeA <-->|"Label Text"| NodeB.
- NEVER USE COLON AFTER ARROW! Never write "NodeA --> NodeB : Label" (this is invalid Mermaid syntax and will crash).
- NEVER use the keyword "actor" in flowcharts. Always define actors as standard nodes: Admin["👤 Admin"] or Teacher["🧑‍🏫 Teacher"].
- ALWAYS quote node labels containing spaces, parentheses, slashes, hyphens, or colons. E.g. p0(["0.0 AttenDex AI Attendance"]) or d1[("D1 Registered Students")].
- Use valid alphanumeric IDs for nodes (e.g. Admin, Teacher, Student, P1, P2, D1, D2, S1, S2, Start, End).
- Provide a formal 2-4 sentence academic description for each figure explaining its components and data flows.
- Return ONLY a valid JSON object matching the requested schema.`;

export function sanitizeMermaid(code) {
  if (!code || typeof code !== 'string') return '';

  let clean = code
    .replace(/^```mermaid\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```$/, '')
    .trim();

  // Ensure diagram type header exists
  if (
    !clean.startsWith('flowchart') &&
    !clean.startsWith('graph') &&
    !clean.startsWith('sequenceDiagram') &&
    !clean.startsWith('erDiagram') &&
    !clean.startsWith('classDiagram') &&
    !clean.startsWith('stateDiagram')
  ) {
    clean = `flowchart TD\n${clean}`;
  }

  const lines = clean.split('\n');
  const fixedLines = [];

  for (let rawLine of lines) {
    let l = rawLine.trim();
    if (!l) {
      fixedLines.push('');
      continue;
    }

    if (l.startsWith('%%')) {
      fixedLines.push(rawLine);
      continue;
    }

    // 1. Fix invalid "actor Name" lines in flowcharts
    if (
      l.match(/^actor\s+([\w\d_-]+)/i) &&
      !clean.includes('sequenceDiagram')
    ) {
      const match = l.match(/^actor\s+([\w\d_-]+)/i);
      l = `${match[1]}["👤 ${match[1]}"]`;
    }

    // 2. Fix duplicate node ID typos like "p2 p2 <--> D3" -> "p2 <--> D3"
    l = l.replace(/^([\w\d_-]+)\s+\1\s*(<-->|-->|---|-.->|==>|<--)/, '$1 $2');

    // 3. Fix invalid colon edge label syntax:
    // e.g. "p0 <--> D1 : "Patient Data, ECG"" -> "p0 <-->|"Patient Data, ECG"| D1"
    // e.g. "Admin --> p0 : Manage Users" -> "Admin -->|"Manage Users"| p0"
    const colonEdgeRegex =
      /^([\w\d_-]+)\s*(<-->|-->|---|-.->|==>|<--)\s*([\w\d_-]+)\s*:\s*["']?([^"'\n\r]+)["']?$/;
    const m = l.match(colonEdgeRegex);
    if (m) {
      const [, from, arrow, to, label] = m;
      l = `${from} ${arrow}|"${label.trim()}"| ${to}`;
    }

    // 4. Fix dangling colons at end of arrow lines: "p0 --> D1: "Data""
    l = l.replace(/:\s*["']([^"'\n\r]+)["']\s*$/, ' |"$1"|');

    // 5. Quote unquoted cylinder data store labels: DB[(Database Name)] -> DB[("Database Name")]
    l = l.replace(/\[\(\s*([^"'\(\)\[\]]+?)\s*\)\]/g, '[("$1")]');

    // 6. Quote unquoted stadium/rounded process labels: p0([Process Name]) -> p0(["Process Name"])
    l = l.replace(/\(\[\s*([^"'\(\)\[\]]+?)\s*\]\)/g, '(["$1"])');

    // Preserve original indentation
    const indent = rawLine.match(/^\s*/)[0];
    fixedLines.push(indent + l);
  }

  return fixedLines.join('\n');
}

async function callWithRetry(fn, operation, maxRetries = 3, delayMs = 1500) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      recordGeminiSuccess(result, operation);
      return result;
    } catch (err) {
      lastErr = err;
      recordGeminiFailure(err);
      const isRateLimit =
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED') ||
        err.status === 429;
      const isUnavailable =
        err.message?.includes('503') ||
        err.message?.includes('high demand') ||
        err.message?.includes('UNAVAILABLE') ||
        err.status === 503;

      if ((isRateLimit || isUnavailable) && attempt < maxRetries) {
        let wait = delayMs * attempt;
        const delayMatch =
          err.message?.match(/retry in ([\d\.]+)s/i) ||
          err.message?.match(/"retryDelay":\s*"(\d+)s"/i);
        if (delayMatch) {
          const secs = Math.min(10, Math.ceil(parseFloat(delayMatch[1])));
          wait = secs * 1000;
        }
        console.warn(
          `Gemini rate limit / busy (attempt ${attempt}/${maxRetries}), waiting ${Math.round(wait / 1000)}s...`
        );
        await new Promise((res) => setTimeout(res, wait));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function generateProjectDiagrams(rawText) {
  // Check cache first
  const cacheKey = `diagrams_${rawText}`;
  const cached = await getCachedResult('diagrams', cacheKey);
  if (cached) {
    return cached;
  }

  const ai = getClient();

  const prompt = `Analyze the following project information and synthesize the complete set of formal Black Book engineering diagrams matching the standard university report format.

PROJECT INFORMATION:
"""
${rawText}
"""

Return a JSON object with this exact structure:
{
  "fig_5_1_dfd0": {
    "title": "Fig 5.1 DFD Level 0",
    "caption": "Fig 5.1 DFD Level 0 (Context Diagram)",
    "description": "The DFD Level 0 diagram, also known as the context diagram, represents the overall functioning of the system as a single central process. It shows how primary external entities interact with the system boundary and the database.",
    "type": "dfd0",
    "mermaid": "flowchart TD\\n..."
  },
  "fig_5_2_dfd1": {
    "title": "Fig 5.2 DFD Level 1",
    "caption": "Fig 5.2 DFD Level 1",
    "description": "The DFD Level 1 diagram expands the basic system into major functional components and illustrates how data flows between external entities, core operational processes, and persistent data stores D1, D2, and D3.",
    "type": "dfd1",
    "mermaid": "flowchart TD\\n..."
  },
  "fig_5_3_dfd2": {
    "title": "Fig 5.3 DFD Level 2",
    "caption": "Fig 5.3 DFD Level 2",
    "description": "The DFD Level 2 diagram provides a detailed breakdown of internal sub-processes including data encoding, automated recognition and matching, and report generation, tracing data transactions to specific stores.",
    "type": "dfd2",
    "mermaid": "flowchart TD\\n..."
  },
  "fig_5_4_block_diagram": {
    "title": "Fig 5.4 Block Diagram",
    "caption": "Fig 5.4 Block Diagram (Overall System Architecture)",
    "description": "The block diagram represents the complete architecture of the system, showing user tiers, input streams, sequential processing pipeline stages, dual data storage, and output dashboard interfaces.",
    "type": "block_diagram",
    "mermaid": "graph TB\\n..."
  },
  "fig_5_5_activity_diagram": {
    "title": "Fig 5.5 Activity Diagram",
    "caption": "Fig 5.5 Activity Diagram",
    "description": "The activity diagram illustrates the operational workflow and decision-making logic of the system, from credential verification and role routing to automated execution and report compilation.",
    "type": "activity_diagram",
    "mermaid": "flowchart TD\\n..."
  },
  "fig_5_6_use_case": {
    "title": "Fig 5.6 Use Case Diagram",
    "caption": "Fig 5.6 Use Case Diagram",
    "description": "The use case diagram illustrates the functional boundaries of the system and the interactions between distinct actors and core system use cases.",
    "type": "use_case",
    "mermaid": "flowchart LR\\n..."
  }
}`;

  const response = await callWithRetry(
    () =>
      ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          systemInstruction: DIAGRAM_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.25,
        },
      }),
    'diagram_generation'
  );

  const parsed = safeJsonParse(response.text);

  const results = {};
  for (const [key, item] of Object.entries(parsed)) {
    if (item && item.mermaid) {
      results[key] = {
        key,
        title: item.title || `Fig ${key}`,
        caption: item.caption || item.title || `Fig ${key}`,
        description: item.description || '',
        type: item.type || key,
        mermaid: sanitizeMermaid(item.mermaid),
      };
    }
  }

  // Cache successful result
  await setCachedResult('diagrams', cacheKey, results);
  return results;
}

export async function refineSingleDiagram(
  currentMermaid,
  instruction,
  rawText = ''
) {
  const ai = getClient();
  const prompt = `CURRENT MERMAID DIAGRAM:
"""
${currentMermaid}
"""

USER REFINEMENT INSTRUCTION:
"""
${instruction}
"""

${rawText ? `OPTIONAL PROJECT CONTEXT:\n"""\n${rawText}\n"""` : ''}

Update the Mermaid diagram strictly according to the instruction while maintaining strict, valid Mermaid syntax. Return a JSON object with:
{
  "mermaid": "updated mermaid diagram code",
  "title": "Diagram Title",
  "caption": "Diagram Caption",
  "description": "Updated academic description paragraph"
}`;

  const response = await callWithRetry(
    () =>
      ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          systemInstruction: DIAGRAM_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      }),
    'diagram_refinement'
  );

  const parsed = safeJsonParse(response.text);

  return {
    mermaid: sanitizeMermaid(parsed.mermaid || currentMermaid),
    title: parsed.title || 'Refined Diagram',
    caption: parsed.caption || 'Fig: Refined Diagram',
    description: parsed.description || '',
  };
}

// Convert Mermaid diagram into a publication-ready PNG Buffer for Word/PDF embedding
export async function renderMermaidToPng(mermaidCode, title = 'Diagram') {
  const cleanCode = sanitizeMermaid(mermaidCode);

  // Strategy 1: mermaid.ink PNG endpoint (with high print quality)
  try {
    const jsonStr = JSON.stringify({
      code: cleanCode,
      mermaid: {
        theme: 'default',
        themeVariables: {
          fontSize: '14px',
          fontFamily: 'Arial, Helvetica, sans-serif',
          primaryColor: '#f8fafc',
          primaryBorderColor: '#0f172a',
          primaryTextColor: '#000000',
          lineColor: '#0f172a',
          secondaryColor: '#ffffff',
          tertiaryColor: '#f1f5f9',
          edgeLabelBackground: '#ffffff',
        },
      },
    });
    const b64 = Buffer.from(jsonStr).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`https://mermaid.ink/img/${b64}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf.length > 500) {
        return buf;
      }
    }
  } catch (err) {
    console.warn('Mermaid.ink PNG attempt:', err.message);
  }

  // Strategy 2: mermaid.ink SVG endpoint rasterized locally via @resvg/resvg-js
  try {
    const jsonStr = JSON.stringify({
      code: cleanCode,
      mermaid: {
        theme: 'default',
        themeVariables: {
          fontSize: '14px',
          fontFamily: 'Arial, Helvetica, sans-serif',
        },
      },
    });
    const b64 = Buffer.from(jsonStr).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`https://mermaid.ink/svg/${b64}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const svgText = await res.text();
      if (svgText.includes('<svg')) {
        const resvg = new Resvg(svgText, {
          fitTo: { mode: 'width', value: 950 },
          background: '#ffffff',
        });
        const pngData = resvg.render();
        return pngData.asPng();
      }
    }
  } catch (err) {
    console.warn('Mermaid.ink SVG attempt:', err.message);
  }

  // Strategy 3: Kroki API rendering
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('https://kroki.io/mermaid/png', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: cleanCode,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf.length > 500) {
        return buf;
      }
    }
  } catch (err) {
    console.warn('Kroki attempt:', err.message);
  }

  // Strategy 4: Fallback vector flowchart SVG rasterized locally
  const svg = generateVectorSvgFromMermaid(cleanCode, title);
  try {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 900 },
      background: '#ffffff',
    });
    const pngData = resvg.render();
    return pngData.asPng();
  } catch (err) {
    console.warn('Resvg fallback error:', err.message);
    return createFallbackPng(title);
  }
}

// Local vector SVG generator
function generateVectorSvgFromMermaid(mermaidCode, title) {
  const lines = mermaidCode
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith('%%') &&
        !l.startsWith('graph') &&
        !l.startsWith('flowchart') &&
        !l.startsWith('erDiagram')
    );

  const nodes = [];
  const links = [];

  for (const line of lines) {
    const parts = line.split(/-->|--o|\|--o\{|\-\->/);
    if (parts.length >= 2) {
      const from = cleanLabel(parts[0]);
      const to = cleanLabel(parts[1]);
      if (from && !nodes.includes(from)) nodes.push(from);
      if (to && !nodes.includes(to)) nodes.push(to);
      links.push({ from, to });
    } else {
      const label = cleanLabel(line);
      if (label && !nodes.includes(label)) nodes.push(label);
    }
  }

  if (nodes.length === 0) {
    nodes.push(
      'User Entities',
      'Input Interface',
      'Core Processing Engine',
      'Database Storage',
      'Output Reports'
    );
    links.push(
      { from: nodes[0], to: nodes[1] },
      { from: nodes[1], to: nodes[2] },
      { from: nodes[2], to: nodes[3] },
      { from: nodes[3], to: nodes[4] }
    );
  }

  const boxWidth = 210;
  const boxHeight = 70;
  const marginX = 40;
  const marginY = 45;
  const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(nodes.length))));
  const rows = Math.ceil(nodes.length / cols);
  const svgWidth = cols * (boxWidth + marginX) + marginX;
  const svgHeight = rows * (boxHeight + marginY) + 95;

  let elements = '';
  elements += `<rect width="${svgWidth}" height="${svgHeight}" fill="#ffffff" stroke="#0f172a" stroke-width="2" rx="6"/>`;
  elements += `<text x="${svgWidth / 2}" y="35" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="#000000" text-anchor="middle">${escapeXml(title)}</text>`;

  nodes.forEach((node, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x = marginX + c * (boxWidth + marginX);
    const y = 65 + r * (boxHeight + marginY);

    const isStartEnd = idx === 0 || idx === nodes.length - 1;
    const rx = isStartEnd ? 20 : 6;
    const bgFill = isStartEnd ? '#f0f4f8' : '#ffffff';
    const borderCol = '#000000';
    const textCol = '#000000';

    elements += `
      <g>
        <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${rx}" fill="${bgFill}" stroke="${borderCol}" stroke-width="1.8"/>
        <text x="${x + boxWidth / 2}" y="${y + boxHeight / 2 + 5}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="600" fill="${textCol}" text-anchor="middle">${escapeXml(truncate(node, 26))}</text>
      </g>
    `;
  });

  return `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#000000" />
      </marker>
    </defs>
    ${elements}
  </svg>`;
}

function cleanLabel(raw) {
  if (!raw) return '';
  let s = raw.trim();
  const match = s.match(/\["?(.*?)"?\]|\("?(.*?)"?\)|\{"?(.*?)"?\}|\|(.*?)\|/);
  if (match) {
    s = match[1] || match[2] || match[3] || match[4] || s;
  }
  return s.replace(/[\[\]\(\)\{\}"]/g, '').trim();
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function createFallbackPng(title) {
  const svg = `<svg width="600" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff" stroke="#000000" stroke-width="2"/>
    <text x="300" y="105" font-family="Arial" font-size="16" fill="#000000" text-anchor="middle" font-weight="bold">${escapeXml(title)}</text>
  </svg>`;
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 600 } });
  return resvg.render().asPng();
}
