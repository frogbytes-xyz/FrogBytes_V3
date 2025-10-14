/**
 * Fallback PDF Generator
 * Creates simple error PDFs when LaTeX compilation fails
 */

import { compileToPDF } from './compiler';

/**
 * Generate a fallback error PDF with compilation error details
 * @param errorMessage - Main error message
 * @param latexLogs - LaTeX compilation logs (optional)
 * @param originalLatex - Original LaTeX source (optional)
 * @returns PDF buffer or null if fallback also fails
 */
export async function generateErrorPDF(
  errorMessage: string,
  latexLogs?: string,
  originalLatex?: string
): Promise<Buffer | null> {
  // Create a simple LaTeX document with error information
  const errorLatex = `
\\section*{PDF Compilation Error}

\\textbf{Error:} ${escapeForLatex(errorMessage)}

${latexLogs ? `
\\subsection*{Compilation Logs}
\\begin{verbatim}
${truncateText(latexLogs, 2000)}
\\end{verbatim}
` : ''}

${originalLatex ? `
\\subsection*{Original LaTeX Source}
\\textit{(truncated to first 1000 characters)}
\\begin{verbatim}
${truncateText(originalLatex, 1000)}
\\end{verbatim}
` : ''}

\\vspace{1cm}

\\textit{Please check your LaTeX syntax and try again.}
\\\\
\\textit{Common issues: missing packages, undefined commands, mismatched braces.}
`;

  try {
    const result = await compileToPDF(errorLatex, {
      title: 'Compilation Error',
      passes: 1,
    });
    
    if (result.success && result.pdf) {
      return result.pdf;
    }
    
    // If even error PDF fails, return minimal text PDF
    return generateMinimalTextPDF(errorMessage);
    
  } catch {
    return generateMinimalTextPDF(errorMessage);
  }
}

/**
 * Generate minimal text-only PDF (ultra-simple LaTeX)
 * @param message - Error message to display
 * @returns PDF buffer or null
 */
async function generateMinimalTextPDF(message: string): Promise<Buffer | null> {
  const minimalLatex = `
\\documentclass{article}
\\begin{document}
\\Large
\\textbf{PDF Compilation Failed}

\\normalsize
\\vspace{0.5cm}

Error: ${escapeForLatex(message)}

\\vspace{1cm}

Please check your LaTeX syntax.
\\end{document}
`;

  try {
    const result = await compileToPDF(minimalLatex, { passes: 1 });
    return result.success && result.pdf ? result.pdf : null;
  } catch {
    return null;
  }
}

/**
 * Escape special LaTeX characters for safe inclusion in error messages
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeForLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}]/g, '\\$&')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Truncate text to maximum length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '\n... (truncated)';
}

/**
 * Create a user-friendly error response with fallback PDF
 * @param error - Error object from compilation
 * @param originalLatex - Original LaTeX source
 * @returns Object with error details and optional PDF
 */
export async function createErrorResponse(
  error: { message: string; logs?: string },
  originalLatex?: string
): Promise<{
  error: string;
  message: string;
  logs?: string;
  fallbackPdf?: Buffer;
}> {
  const fallbackPdf = await generateErrorPDF(
    error.message,
    error.logs,
    originalLatex
  );
  
  return {
    error: 'Compilation failed',
    message: error.message,
    logs: error.logs ?? 'No logs available',
    ...(fallbackPdf && { fallbackPdf }),
  };
}

/**
 * Check if error is due to missing LaTeX installation
 * @param error - Error message
 * @returns true if error indicates missing LaTeX
 */
export function isMissingLatexError(error: string): boolean {
  const missingPatterns = [
    'pdflatex not found',
    'command not found',
    'ENOENT',
    'spawn pdflatex',
  ];
  
  return missingPatterns.some(pattern => 
    error.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Extract meaningful error from LaTeX logs
 * @param logs - Full LaTeX logs
 * @returns Extracted error message
 */
export function extractLatexError(logs: string): string {
  // Look for common error patterns
  const errorPatterns = [
    /! (.+)/,  // Standard LaTeX error
    /Error: (.+)/i,
    /Undefined control sequence(.+)/i,
    /Missing (.+)/i,
  ];
  
  for (const pattern of errorPatterns) {
    const match = logs.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  // Return first 200 characters if no pattern matches
  return logs.substring(0, 200) + '...';
}
