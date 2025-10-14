/**
 * PDF Compiler Service
 * Compiles LaTeX source to PDF using node-latex
 */

import latex from 'node-latex';
import { Readable } from 'stream';
import { prepareLatexDocument } from './template';

export interface CompileOptions {
  title?: string;
  inputs?: string[]; // Additional input files
  cmd?: string; // LaTeX compiler command (default: pdflatex)
  passes?: number; // Number of compilation passes (default: 1)
}

export interface CompilationResult {
  success: boolean;
  pdf?: Buffer;
  error?: string;
  logs?: string;
}

/**
 * Compile LaTeX source to PDF
 * @param latexContent - LaTeX content (with or without preamble)
 * @param options - Compilation options
 * @returns Promise with PDF buffer or error
 */
export async function compileToPDF(
  latexContent: string,
  options: CompileOptions = {}
): Promise<CompilationResult> {
  try {
    // Prepare full LaTeX document
    const fullDocument = prepareLatexDocument(latexContent, options.title);
    
    // Create readable stream from LaTeX content
    const input = Readable.from([fullDocument]);
    
    // Configure latex compiler options
    const latexOptions = {
      inputs: options.inputs ?? '',
      cmd: options.cmd || 'pdflatex',
      passes: options.passes || 1,
      errorLogs: '', // Will be populated on error
    };
    
    // Compile to PDF
    const pdfStream = latex(input, latexOptions);
    
    // Collect PDF chunks
    const chunks: Buffer[] = [];
    
  return new Promise((resolve) => {
      pdfStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      pdfStream.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve({
          success: true,
          pdf: pdfBuffer,
        });
      });
      
      pdfStream.on('error', (error: Error) => {
        resolve({
          success: false,
          error: error.message,
          logs: (error as any).logs || 'No logs available',
        });
      });
    });
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown compilation error',
    };
  }
}

/**
 * Check if LaTeX compiler is available
 * @returns true if pdflatex is available
 */
export async function isLatexAvailable(): Promise<boolean> {
  try {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      exec('which pdflatex', (error: Error | null) => {
        resolve(!error);
      });
    });
  } catch {
    return false;
  }
}
