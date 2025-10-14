'use client'

import AICopilot from '@/components/AICopilot'

export default function TestCopilotPage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">AI Copilot Test Page</h1>
          <p className="text-muted-foreground">
            Test the markdown rendering by asking questions. Try asking for:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc ml-6">
            <li>Lists (ordered and unordered)</li>
            <li>Code snippets with syntax highlighting</li>
            <li>**Bold** and *italic* text</li>
            <li>Tables</li>
            <li>Headings and formatting</li>
          </ul>
        </div>

        <div className="border border-border rounded-lg shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 240px)' }}>
          <AICopilot
            documentContext="This is a test lecture about computer science fundamentals. Topics covered include: algorithms, data structures, complexity analysis, sorting algorithms, and graph theory."
            isFocusMode={true}
          />
        </div>
      </div>
    </div>
  )
}
