/**
 * Footer Component for FrogBytes
 *
 * A comprehensive, responsive footer inspired by midday.ai's design with the following features:
 * - Clean, minimalist layout with organized link sections (Product, Company, Resources, Legal)
 * - Prominent FrogBytes branding with logo and description
 * - Social media links (GitHub, Twitter, LinkedIn, Discord)
 * - Newsletter subscription form
 * - Copyright and additional legal/utility links
 * - Signature "peeking" FrogBytes text emerging from bottom (midday.ai inspired)
 *
 * Design System Compliance:
 * - Uses existing FrogBytes color system (HSL CSS variables)
 * - Matches font family (Geist Sans) and typography scale
 * - Follows established spacing and border radius patterns
 * - Supports both light and dark modes seamlessly
 * - Includes subtle background patterns matching site aesthetic
 *
 * Accessibility:
 * - Semantic HTML structure
 * - ARIA labels for icon-only links
 * - Keyboard navigation support
 * - Proper heading hierarchy
 * - Focus states for all interactive elements
 *
 * Responsive Behavior:
 * - Desktop: 6-column grid layout with all content visible
 * - Tablet: 4-column grid with adjusted spacing
 * - Mobile: 2-column grid with stacked elements
 * - Newsletter form adapts to available width
 *
 * @example
 * ```tsx
 * import Footer from '@/components/layout/Footer'
 *
 * export default function Layout() {
 *   return (
 *     <div>
 *       <main>{children}</main>
 *       <Footer />
 *     </div>
 *   )
 * }
 * ```
 */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Footer() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const footerLinks = {
    product: [
      { label: 'Features', href: '/#features' },
      { label: 'Upload', href: '/upload' },
      { label: 'Library', href: '/library' },
      { label: 'Dashboard', href: '/dashboard' }
    ],
    company: [
      { label: 'About', href: '/about' },
      { label: 'Feedback', href: '/feedback' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' }
    ],
    resources: [
      { label: 'Documentation', href: '/docs' },
      { label: 'API', href: '/api' },
      { label: 'Support', href: '/support' },
      { label: 'Status', href: '/status' }
    ],
    legal: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Security', href: '/security' },
      { label: 'Cookies', href: '/cookies' }
    ]
  }

  const socialLinks = [
    {
      name: 'GitHub',
      href: 'https://github.com/frogbytes',
      icon: (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            clipRule="evenodd"
          />
        </svg>
      )
    },
    {
      name: 'Twitter',
      href: 'https://twitter.com/frogbytes',
      icon: (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      )
    },
    {
      name: 'LinkedIn',
      href: 'https://linkedin.com/company/frogbytes',
      icon: (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
            clipRule="evenodd"
          />
        </svg>
      )
    },
    {
      name: 'Discord',
      href: 'https://discord.gg/frogbytes',
      icon: (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      )
    }
  ]

  return (
    <footer className="relative bg-background border-t border-border">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.03] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '40px 40px',
            color: 'hsl(var(--foreground))'
          }}
        />
      </div>

      {/* Main Footer Content */}
      <div className="container max-w-7xl mx-auto px-4 pt-16 pb-32 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 lg:gap-12 mb-12">
          {/* Logo and Description Column */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-all">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <span className="text-lg font-medium tracking-tight text-foreground">
                FrogBytes
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Transform lectures into comprehensive study materials with
              AI-powered transcription and learning tools.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3 pt-2">
              {socialLinks.map(social => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={social.name}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map(link => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map(link => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Resources</h3>
            <ul className="space-y-2">
              {footerLinks.resources.map(link => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map(link => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}

        <div className="h-16" />
      </div>

      {/* Peeking FrogBytes Branding - Midday.ai inspired */}
      {/* This div extends beyond the footer's bottom edge, creating the "peeking" effect */}
      <div
        className="absolute bottom-0 left-0 right-0 overflow-hidden pointer-events-none z-0"
        style={{ height: '190px' }}
      >
        <div
          className={`absolute left-1/2 -translate-x-1/2 transition-transform duration-1000 ease-out ${
            isVisible ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ bottom: '-60%' }}
          aria-hidden="true"
        >
          <div className="text-[180px] md:text-[240px] lg:text-[300px] font-bold tracking-tighter text-foreground/[0.02] dark:text-foreground/[0.03] select-none whitespace-nowrap leading-none">
            FrogBytes
          </div>
        </div>
      </div>
    </footer>
  )
}
