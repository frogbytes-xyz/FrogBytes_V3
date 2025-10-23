/**
 * Streamlined Summary Prompts
 * Optimized for different user preferences and content preservation
 */

export type SummaryType = 'compact' | 'detailed' | 'expanded'

export interface UserPreferences {
  includeExamples: boolean
  includeCode: boolean
  includeMath: boolean
  includeDiagrams: boolean
  verbosityLevel: 'minimal' | 'standard' | 'comprehensive'
}

export const SUMMARY_PROMPTS: Record<SummaryType, string> = {
  compact: `Transform this lecture transcript into clean, structured LaTeX notes.

**REQUIREMENTS:**
- Preserve ALL content, examples, and details
- Remove only filler words (uh, um, so, well, you know)
- Fix speech recognition errors
- Structure logically with clear sections
- Use appropriate LaTeX formatting

**STRUCTURE:**
- \\section{} for main topics
- \\subsection{} for subtopics  
- \\textbf{} for key terms
- \\textit{} for examples
- Lists for enumerations

**LATEX PACKAGES AVAILABLE:**
- Math: \\begin{equation}, \\mathbb{R}, \\mathbf{x}, \\frac{a}{b}
- Code: \\begin{lstlisting}[language=Python], \\texttt{code}
- Physics: \\si{unit}, \\qty{value}{unit}, \\vec{v}
- Chemistry: \\ch{formula}
- Tables: \\begin{tabular}, \\toprule, \\midrule, \\bottomrule
- Lists: \\begin{itemize}, \\begin{enumerate}, \\begin{description}

Format as LaTeX content (no \\documentclass, \\begin{document}, \\end{document}).

TRANSCRIPT:
{text}

LATEX OUTPUT:`,

  detailed: `Transform this lecture transcript into comprehensive LaTeX notes with full detail.

**REQUIREMENTS:**
- Preserve ALL content, examples, and details
- Remove only filler words and irrelevant chatter
- Fix speech recognition errors
- Structure with clear hierarchy
- Include all explanations and context

**STRUCTURE:**
- \\section{} for main topics
- \\subsection{} for subtopics
- \\subsubsection{} for detailed breakdowns
- \\textbf{} for key terms and definitions
- \\textit{} for examples and applications
- Use \\begin{description} for detailed explanations

**LATEX PACKAGES AVAILABLE:**
- Math: \\begin{equation}, \\begin{align}, \\begin{theorem}, \\mathbb{R}, \\mathbf{x}
- Code: \\begin{algorithm}, \\begin{lstlisting}[language=Python], \\texttt{code}
- Physics: \\si{unit}, \\qty{value}{unit}, \\ket{state}, \\vec{v}
- Chemistry: \\ch{formula}, \\chemfig{structure}
- Tables: \\begin{tabular}, \\begin{longtable}, \\toprule, \\midrule, \\bottomrule
- Graphics: \\begin{tikzpicture}, \\begin{circuitikz}

Format as LaTeX content (no \\documentclass, \\begin{document}, \\end{document}).

TRANSCRIPT:
{text}

LATEX OUTPUT:`,

  expanded: `Transform this lecture transcript into comprehensive LaTeX notes with enhanced context and explanations.

**REQUIREMENTS:**
- Preserve ALL content, examples, and details
- Remove only filler words and irrelevant chatter
- Fix speech recognition errors
- Add clarifying context where helpful
- Structure with clear hierarchy and cross-references

**STRUCTURE:**
- \\section{} for main topics
- \\subsection{} for subtopics
- \\subsubsection{} for detailed breakdowns
- \\textbf{} for key terms and definitions
- \\textit{} for examples and applications
- Use \\begin{description} for detailed explanations
- Use \\begin{quote} for important insights

**LATEX PACKAGES AVAILABLE:**
- Math: \\begin{equation}, \\begin{align}, \\begin{theorem}, \\mathbb{R}, \\mathbf{x}
- Code: \\begin{algorithm}, \\begin{lstlisting}[language=Python], \\texttt{code}
- Physics: \\si{unit}, \\qty{value}{unit}, \\ket{state}, \\vec{v}
- Chemistry: \\ch{formula}, \\chemfig{structure}
- Tables: \\begin{tabular}, \\begin{longtable}, \\toprule, \\midrule, \\bottomrule
- Graphics: \\begin{tikzpicture}, \\begin{circuitikz}

Format as LaTeX content (no \\documentclass, \\begin{document}, \\end{document}).

TRANSCRIPT:
{text}

LATEX OUTPUT:`
}

/**
 * Generate personalized prompt based on user preferences
 */
export function generatePersonalizedPrompt(
  summaryType: SummaryType,
  preferences: UserPreferences
): string {
  const basePrompt = SUMMARY_PROMPTS[summaryType]

  let personalizedPrompt = basePrompt

  // Add user-specific instructions
  const additions: string[] = []

  if (!preferences.includeExamples) {
    additions.push('- Focus on concepts and theory, minimize examples')
  }

  if (!preferences.includeCode) {
    additions.push('- Avoid code blocks and algorithms')
  }

  if (!preferences.includeMath) {
    additions.push('- Minimize mathematical notation and equations')
  }

  if (!preferences.includeDiagrams) {
    additions.push('- Avoid TikZ diagrams and complex graphics')
  }

  if (preferences.verbosityLevel === 'minimal') {
    additions.push('- Use concise language and bullet points where possible')
  } else if (preferences.verbosityLevel === 'comprehensive') {
    additions.push('- Include detailed explanations and cross-references')
  }

  if (additions.length > 0) {
    personalizedPrompt += '\n\n**USER PREFERENCES:**\n' + additions.join('\n')
  }

  return personalizedPrompt
}
