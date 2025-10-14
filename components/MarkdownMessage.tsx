'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface MarkdownMessageProps {
  content: string
  className?: string
}

export default function MarkdownMessage({ content, className = '' }: MarkdownMessageProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Headings
          h1: ({ children, ...props }) => (
            <h1 className="text-xl font-bold mt-6 mb-4 text-foreground" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-lg font-bold mt-5 mb-3 text-foreground" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-base font-semibold mt-4 mb-2 text-foreground" {...props}>
              {children}
            </h3>
          ),

          // Paragraphs
          p: ({ children, ...props }) => (
            <p className="mb-4 last:mb-0 leading-relaxed text-foreground" {...props}>
              {children}
            </p>
          ),

          // Lists
          ul: ({ children, ...props }) => (
            <ul className="mb-4 ml-6 list-disc space-y-2 text-foreground" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="mb-4 ml-6 list-decimal space-y-2 text-foreground" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-relaxed" {...props}>
              {children}
            </li>
          ),

          // Code
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs border border-border"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code
                className={`block p-4 rounded-lg bg-muted border border-border font-mono text-xs overflow-x-auto ${className || ''}`}
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ children, ...props }) => (
            <pre className="mb-4 overflow-x-auto" {...props}>
              {children}
            </pre>
          ),

          // Links
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              className="text-primary hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),

          // Blockquotes
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="pl-4 border-l-4 border-primary/30 italic text-muted-foreground mb-4"
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Tables
          table: ({ children, ...props }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="min-w-full border-collapse border border-border" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-muted" {...props}>
              {children}
            </thead>
          ),
          th: ({ children, ...props }) => (
            <th className="border border-border px-4 py-2 text-left font-semibold" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-border px-4 py-2" {...props}>
              {children}
            </td>
          ),

          // Horizontal rule
          hr: (props) => (
            <hr className="my-6 border-border" {...props} />
          ),

          // Strong and emphasis
          strong: ({ children, ...props }) => (
            <strong className="font-bold text-foreground" {...props}>
              {children}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em className="italic" {...props}>
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
