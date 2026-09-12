// Phase 4: convert the filled DOCX to PDF using LibreOffice in headless mode.
// Ensures complete process isolation using dynamic profiles in /dev/shm (tmpfs)
// to prevent concurrency collisions, with guaranteed cleanup in a finally block.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

let _cachedSofficeBinary = null;
let _libreTested = false;

/**
 * Finds the soffice binary across common Linux, macOS, and Windows installation paths.
 */
async function getSofficeBinary() {
  if (_libreTested) {
    if (!_cachedSofficeBinary) {
      throw new Error('LibreOffice is not installed (skipping PDF conversion)');
    }
    return _cachedSofficeBinary;
  }

  const candidatePaths = [
    process.env.SOFFICE_PATH,
    process.env.LIBRE_OFFICE_EXE,
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/snap/bin/libreoffice',
    '/opt/libreoffice/program/soffice',
    '/opt/libreoffice7.6/program/soffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  ].filter(Boolean);

  for (const binPath of candidatePaths) {
    try {
      await fsp.access(binPath, fs.constants.X_OK);
      _cachedSofficeBinary = binPath;
      _libreTested = true;
      return binPath;
    } catch {
      // Continue searching next candidate
    }
  }

  // Fallback: try PATH resolution for 'soffice'
  try {
    await execFileAsync('soffice', ['--version'], { timeout: 5000 });
    _cachedSofficeBinary = 'soffice';
    _libreTested = true;
    return 'soffice';
  } catch {
    _cachedSofficeBinary = null;
    _libreTested = true;
    throw new Error('LibreOffice is not installed (skipping PDF conversion)');
  }
}

/**
 * Converts a DOCX buffer to PDF buffer.
 * - Writes temp files to /dev/shm (POSIX in-memory tmpfs) to maximize speed and minimize disk wear.
 * - Uses dynamic isolated profile (-env:UserInstallation=file:///dev/shm/...) per conversion to avoid locking collisions.
 * - Guarantees all temporary files are unlinked in a finally block.
 * - Enforces a 60-second timeout to avoid zombie processes.
 * 
 * @param {Buffer} docxBuf
 * @returns {Promise<Buffer>}
 */
export async function convertToPdf(docxBuf) {
  if (!Buffer.isBuffer(docxBuf) || docxBuf.length === 0) {
    throw new Error('Invalid DOCX buffer provided for PDF conversion');
  }

  const sofficeBin = await getSofficeBinary();

  // Prefer /dev/shm in-memory filesystem; fallback to os.tmpdir() if unavailable
  const baseDir = fs.existsSync('/dev/shm') ? '/dev/shm' : os.tmpdir();
  const runId = crypto.randomUUID();
  const workDir = await fsp.mkdtemp(path.join(baseDir, `docmorph-soffice-${runId}-`));
  const profileDir = path.join(workDir, 'profile');
  const inputDocxPath = path.join(workDir, 'document.docx');
  const outputPdfPath = path.join(workDir, 'document.pdf');

  try {
    await fsp.mkdir(profileDir, { recursive: true });
    await fsp.writeFile(inputDocxPath, docxBuf);

    // Profile URL format for LibreOffice UserInstallation
    const profileUrl = `file://${profileDir}`;

    const args = [
      `-env:UserInstallation=${profileUrl}`,
      '--headless',
      '--invisible',
      '--nodefault',
      '--nofirststartwizard',
      '--nolockcheck',
      '--nologo',
      '--norestore',
      '--convert-to',
      'pdf',
      '--outdir',
      workDir,
      inputDocxPath,
    ];

    await execFileAsync(sofficeBin, args, {
      timeout: 60000,
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        TMPDIR: baseDir,
      },
    });

    const pdfBuffer = await fsp.readFile(outputPdfPath);
    return pdfBuffer;
  } catch (err) {
    if (err.killed && err.signal === 'SIGTERM') {
      throw new Error('LibreOffice conversion timed out after 60s');
    }
    throw new Error(`LibreOffice PDF conversion failed: ${err.message || String(err)}`);
  } finally {
    // Guaranteed cleanup of temp working dir and isolated profile from /dev/shm
    try {
      await fsp.rm(workDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn('Temporary directory cleanup warning:', cleanupErr.message);
    }
  }
}
