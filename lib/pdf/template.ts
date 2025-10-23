/**
 * LaTeX Template Wrapper
 * Provides utilities to wrap content LaTeX with full document structure
 */

import fs from 'fs'
import path from 'path'

/**
 * Get the base LaTeX template
 */
export function getBaseTemplate(): string {
  const templatePath = path.join(process.cwd(), 'lib', 'pdf', 'template.tex')

  try {
    return fs.readFileSync(templatePath, 'utf-8')
  } catch (error) {
    // Fallback inline template if file not found
    return `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{xcolor}

\\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    filecolor=magenta,
    urlcolor=cyan,
}

\\begin{document}

% CONTENT_PLACEHOLDER

\\end{document}`
  }
}

/**
 * Wrap content LaTeX with full document structure
 * @param content - LaTeX content without preamble (just section/subsection/text)
 * @param title - Optional document title
 * @returns Complete LaTeX document ready for compilation
 */
export function wrapLatexContent(content: string, title?: string): string {
  const template = getBaseTemplate()

  // Add title if provided
  let contentWithTitle = content
  if (title) {
    contentWithTitle = `\\title{${escapeLatex(title)}}
\\author{FrogBytes Summary}
\\date{\\today}
\\maketitle

${content}`
  }

  // Replace placeholder with content
  const fullDocument = template.replace(
    '% CONTENT_PLACEHOLDER',
    contentWithTitle
  )

  return fullDocument
}

/**
 * Escape special LaTeX characters in text
 * @param text - Plain text to escape
 * @returns LaTeX-safe text
 */
export function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}]/g, '\\$&')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

/**
 * Check if content already has document structure
 * @param content - LaTeX content to check
 * @returns true if content has \begin{document}
 */
export function hasDocumentStructure(content: string): boolean {
  return (
    content.includes('\\begin{document}') || content.includes('\\documentclass')
  )
}

/**
 * Prepare LaTeX content for compilation
 * Wraps content if needed, otherwise returns as-is
 * @param content - Input LaTeX (with or without preamble)
 * @param title - Optional title
 * @returns Complete LaTeX document
 */
export function prepareLatexDocument(content: string, title?: string): string {
  // If already has document structure, return as-is
  if (hasDocumentStructure(content)) {
    return content
  }

  // Otherwise, wrap with template
  return wrapLatexContent(content, title)
}
