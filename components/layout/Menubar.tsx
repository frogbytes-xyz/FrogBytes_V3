'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@supabase/supabase-js'
import LoginPromptDialog from '@/components/auth/LoginPromptDialog'

export default function Menubar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isActive = (path: string) => {
    if (path === '/') return pathname === path
    return pathname.startsWith(path)
  }

  const handleProtectedClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    if (!user) {
      setShowLoginPrompt(true)
    } else {
      router.push(path)
    }
  }

  return (
    <>
      <LoginPromptDialog
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
      />
      <header className="fixed top-0 left-0 right-0 z-40 pt-4 px-4">
        <nav
          className={`container max-w-5xl mx-auto transition-all duration-300 ${
            isScrolled
              ? 'bg-background/80 backdrop-blur-xl border border-border/60 shadow-lg'
              : 'bg-background/40 border border-border/40'
          } rounded-full px-6`}
        >
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 group-hover:bg-white/15 transition-all">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <span className="text-base font-medium tracking-tight text-foreground">
                FrogBytes
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              <Button
                onClick={e => handleProtectedClick(e, '/upload')}
                variant="ghost"
                size="sm"
                className={`text-xs h-8 px-3 ${isActive('/upload') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Upload
              </Button>
              <Button
                onClick={e => handleProtectedClick(e, '/dashboard')}
                variant="ghost"
                size="sm"
                className={`text-xs h-8 px-3 ${isActive('/dashboard') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Dashboard
              </Button>
              <Link href="/library">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs h-8 px-3 ${isActive('/library') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Library
                </Button>
              </Link>
              <Link href="/feedback">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs h-8 px-3 ${isActive('/feedback') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Feedback
                </Button>
              </Link>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {user ? (
                <div className="hidden md:flex items-center gap-2">
                  <Button
                    onClick={signOut}
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 px-3 text-muted-foreground hover:text-foreground"
                  >
                    Sign out
                  </Button>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link href="/login">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 px-3 text-muted-foreground hover:text-foreground"
                    >
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button
                      size="sm"
                      className="text-xs h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/50"
                    >
                      Get started
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <MobileMenu
                user={user}
                onSignOut={signOut}
                onProtectedClick={path =>
                  handleProtectedClick({} as React.MouseEvent, path)
                }
              />
            </div>
          </div>
        </nav>
      </header>
    </>
  )
}

function MobileMenu({
  user,
  onSignOut,
  onProtectedClick
}: {
  user: User | null
  onSignOut: () => void
  onProtectedClick: (path: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/') return pathname === path
    return pathname.startsWith(path)
  }

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-accent rounded-md transition-colors"
        aria-label="Toggle menu"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-16 left-0 right-0 bg-background border-b border-border shadow-lg z-50 p-4">
            <div className="flex flex-col gap-2">
              <Link href="/" onClick={() => setIsOpen(false)}>
                <Button
                  variant={
                    isActive('/') && pathname === '/' ? 'secondary' : 'ghost'
                  }
                  size="sm"
                  className="w-full justify-start"
                >
                  Home
                </Button>
              </Link>
              <Button
                onClick={() => {
                  onProtectedClick('/upload')
                  setIsOpen(false)
                }}
                variant={isActive('/upload') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
              >
                Upload
              </Button>
              <Button
                onClick={() => {
                  onProtectedClick('/dashboard')
                  setIsOpen(false)
                }}
                variant={isActive('/dashboard') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
              >
                Dashboard
              </Button>
              <Link href="/library" onClick={() => setIsOpen(false)}>
                <Button
                  variant={isActive('/library') ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                >
                  Library
                </Button>
              </Link>
              <Link href="/learn" onClick={() => setIsOpen(false)}>
                <Button
                  variant={isActive('/learn') ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                >
                  Learn
                </Button>
              </Link>
              <Link href="/feedback" onClick={() => setIsOpen(false)}>
                <Button
                  variant={isActive('/feedback') ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                >
                  Feedback
                </Button>
              </Link>
              <div className="border-t border-border my-2" />
              {user ? (
                <>
                  <div className="px-3 py-2 text-sm text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <Button
                    onClick={() => {
                      onSignOut()
                      setIsOpen(false)
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setIsOpen(false)}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                    >
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setIsOpen(false)}>
                    <Button size="sm" className="w-full justify-start">
                      Get started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
