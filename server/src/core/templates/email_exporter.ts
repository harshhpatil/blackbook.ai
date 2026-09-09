import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mjml2html from 'mjml';
import { createLogger } from '../../core/lib/logger.ts'; // Assuming your logger path

const log = createLogger('email-compiler');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the absolute path to your templates directory to prevent path traversal
const TEMPLATES_DIR = path.join(__dirname, 'authentication_email_templates');

// In-memory cache to prevent reading from the disk on every single email send
const templateCache = new Map<
  string,
  { rawMjml: string; requiredVariables: string[] }
>();
 
/**
 * Compiles an MJML email template into HTML with strict variable validation and in-memory caching.
 *
 * @param filename - Name of the MJML template file (e.g., 'welcome.mjml').
 * @param variables - Variables required by the MJML template.
 * @returns Compiled HTML string.
 */
const compileTemplate = async (
  filename: string,
  variables: Record<string, string>
): Promise<string> => {
  try {
    // 1. Path Traversal Protection: Ensure the resolved path stays inside TEMPLATES_DIR
    const safeFilename = path.basename(filename);
    const templatePath = path.join(TEMPLATES_DIR, safeFilename);

    // 2. Fetch from Cache or Read from Disk
    if (!templateCache.has(safeFilename)) {
      const rawMjml = await fs.readFile(templatePath, 'utf-8');

      // Extract unique variables using a single pass matchAll
      const requiredVariables = [
        ...new Set(
          [...rawMjml.matchAll(/{{\s*([^{}\s]+)\s*}}/g)].map((m) => m[1])
        ),
      ];

      templateCache.set(safeFilename, { rawMjml, requiredVariables });
      log.info(`Template "${safeFilename}" loaded into memory cache.`);
    }

    const { rawMjml, requiredVariables: templateVariables } =
      templateCache.get(safeFilename)!;
    const providedVariables = Object.keys(variables);

    // 3. Strict Variable Validation
    const missingVariables = templateVariables.filter(
      (v) => !providedVariables.includes(v)
    );

    if (missingVariables.length > 0) {
      throw new Error(
        `Variable validation failed for "${safeFilename}": Missing: ${missingVariables.map((v) => `{{${v}}}`).join(', ')}`
      );
    }

    // 4. High-Speed Single Pass Replacement
    // Instead of looping over Object.keys and generating dynamic Regexes,
    // we find all {{ keys }} and instantly swap them using a replacer function.
    const injectedMjml = rawMjml.replace(
      /{{\s*([^{}\s]+)\s*}}/g,
      (_, key) => variables[key]
    );

    // 5. Synchronous MJML Compilation
    const { html, errors } = await mjml2html(injectedMjml, {
      validationLevel: 'soft', // Prevents compilation from throwing on minor CSS quirks
    });

    if (errors.length > 0) {
      log.warn({ errors }, `MJML compilation warnings in "${safeFilename}"`);
    }

    return html;
  } catch (error) {
    log.error({ err: error, filename }, `Failed to compile MJML template`);
    throw error;
  }
};

export default compileTemplate;
