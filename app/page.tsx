import Link from 'next/link'
import { Button } from '@/components/ui/button'
// Card and Badge imports removed: not used in this file
import DashboardPreview from '@/components/DashboardPreview'
import TranscriptionMockup from '@/components/TranscriptionMockup'
import SummaryMockup from '@/components/SummaryMockup'
import LearningMockup from '@/components/LearningMockup'
import HeroFileUpload from '@/components/HeroFileUpload'
import Menubar from '@/components/layout/Menubar'
import Footer from '@/components/layout/Footer'
import AnimatedText from '@/components/AnimatedText'

export default function Home() {
  return (
    <main className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '40px 40px',
            color: 'hsl(var(--foreground))'
          }}
        />
      </div>

      <Menubar />

      {/* Hero Section - Two Column Layout */}
      <section className="relative overflow-x-hidden overflow-y-visible bg-background">
        {/* Subtle decorative lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-border/30 to-transparent" />
          <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-border/30 to-transparent" />
        </div>

        <div className="container max-w-7xl mx-auto px-4 pt-40 pb-24 md:pt-48 md:pb-32 lg:pt-56 lg:pb-40">
          {/* Version Badge */}
          <div className="mb-16">
            <Link
              href="/library"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 hover:border-border transition-colors text-xs font-normal text-muted-foreground hover:text-foreground"
            >
              FrogBytes v2.0
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-12 relative z-20">
              <div className="space-y-8">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight leading-[1.15] text-foreground">
                  Transform lectures into comprehensive study materials for{' '}
                  <AnimatedText words={['students', 'teachers']} />
                </h1>

                <p className="text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
                  Automatic transcription, intelligent summaries, and
                  interactive <br />
                  learning tools designed for modern students and educators.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="h-11 px-8 font-normal">
                  <Link href="/register">Start free trial</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 px-8 font-normal"
                >
                  <Link href="/library">Browse library</Link>
                </Button>
              </div>

              {/* Small text under buttons */}
              <p className="text-xs text-muted-foreground">
                Free trial available. No credit card required.
              </p>
            </div>

            {/* Right Column - 3D Dashboard Preview - Midday.ai style */}
            <div className="hidden lg:block relative h-[600px] overflow-visible">
              <DashboardPreview />
            </div>
          </div>

          {/* Stats Section removed */}
        </div>

        {/* Subtle bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-muted/10 to-transparent" />
      </section>

      {/* How It Works (moved above Try it now) */}
      <section className="relative py-32 px-4 overflow-hidden -mt-32 pt-48">
        {/* Gradual background fade - starts very transparent to let dashboard shadow show through */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent from-0% via-transparent via-60% to-background to-100% pointer-events-none" />

        {/* Subtle pattern background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.06] dark:opacity-[0.08]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 2px, transparent 0)`,
              backgroundSize: '40px 40px',
              color: 'hsl(var(--foreground))'
            }}
          />
        </div>

        {/* Radial glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-muted/20 rounded-full blur-3xl pointer-events-none" />

        <div className="container max-w-5xl relative z-20">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal text-foreground tracking-tight">
              How it works
            </h2>
            <p className="text-sm text-muted-foreground">
              Four simple steps from lecture to mastery
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-20">
            {[
              {
                step: '01',
                title: 'Upload',
                description:
                  'Upload audio or video files up to 500MB. Supports MP3, MP4, WAV, and more.'
              },
              {
                step: '02',
                title: 'Transcribe',
                description:
                  'AI automatically transcribes your lecture with speaker identification and timestamps.'
              },
              {
                step: '03',
                title: 'Summarize',
                description:
                  'Generate intelligent summaries, flashcards, and key concept highlights instantly.'
              },
              {
                step: '04',
                title: 'Learn',
                description:
                  'Study with interactive tools, take quizzes, and export materials for offline review.'
              }
            ].map((item, index) => (
              <div key={index} className="group space-y-5 relative z-20">
                {/* Subtle glow on hover */}
                <div className="absolute -inset-4 bg-muted/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl pointer-events-none" />

                <div className="relative z-30">
                  <div className="relative inline-block mb-4">
                    <div className="text-xs font-mono text-muted-foreground/50 relative z-10">
                      {item.step}
                    </div>
                    {/* Shadow under the step number */}
                    <div className="absolute -bottom-2 left-0 right-0 h-4 bg-gradient-to-b from-muted/50 via-muted/20 to-transparent blur-md" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-base font-normal text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Upload Section (Try it now) - improved light-mode visibility */}
      <section className="relative py-32 px-4 bg-gradient-to-b from-muted/10 via-background to-background">
        {/* Subtle pattern background - offset to prevent overlap with How It Works */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.06] dark:opacity-[0.08]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 2px, transparent 0)`,
              backgroundSize: '40px 40px',
              backgroundPosition: '20px 20px',
              color: 'hsl(var(--foreground))'
            }}
          />
        </div>

        {/* Subtle decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-muted/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-muted/20 blur-3xl" />
        </div>

        <div className="container max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal text-foreground tracking-tight">
              Try it now
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Upload your lecture file and experience automatic transcription,
              intelligent summaries, and study material generation.
            </p>
          </div>
          {/* Upload box with enhanced styling to ensure visibility in light mode */}
          <div className="max-w-2xl mx-auto">
            <div className="relative z-10 bg-card border border-border p-6 rounded-lg shadow-lg">
              <HeroFileUpload />
            </div>
          </div>{' '}
          <div className="text-center text-xs text-muted-foreground mt-6">
            No account required to try. Sign up after to save your materials.
          </div>
        </div>
      </section>

      {/* Testimonials Section removed */}

      {/* Duplicate How It Works removed (kept the moved section above Try it now) */}

      {/* Feature Showcase Sections */}
      <section className="relative py-32 px-4 bg-background">
        <div className="container max-w-7xl relative z-10">
          <div className="text-center mb-20 space-y-4">
            <h3 className="text-2xl md:text-3xl font-normal text-foreground tracking-tight">
              Powerful features for modern learning
            </h3>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Everything you need to transform lectures into effective study
              materials
            </p>
          </div>

          {/* Feature 1: AI Transcription */}
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
            <div className="relative h-[500px]">
              <TranscriptionMockup />
            </div>
            <div className="space-y-6">
              <h3 className="text-2xl md:text-3xl font-normal text-foreground tracking-tight">
                AI-Powered Transcription
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                Upload audio or video lectures and receive highly accurate
                transcriptions with precise timestamps. Our AI handles multiple
                speakers, diverse accents, and technical terminology.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { text: 'Fast processing' },
                  { text: 'High accuracy' },
                  { text: 'Multi-language' },
                  { text: 'Speaker detection' }
                ].map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm text-foreground">
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 2: Smart Summaries */}
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
            <div className="space-y-6 lg:order-1">
              <h3 className="text-2xl md:text-3xl font-normal text-foreground tracking-tight">
                Intelligent Summaries & Study Materials
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                AI generates comprehensive summaries, extracts key concepts,
                creates flashcards, and builds custom quizzes. Transform hours
                of lectures into digestible study materials instantly.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { text: 'Key concepts' },
                  { text: 'Flashcards' },
                  { text: 'Custom quizzes' },
                  { text: 'Smart highlights' }
                ].map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm text-foreground">
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative h-[500px] lg:order-2">
              <SummaryMockup />
            </div>
          </div>

          {/* Feature 3: Interactive Learning */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative h-[500px]">
              <LearningMockup />
            </div>
            <div className="space-y-6">
              <h3 className="text-2xl md:text-3xl font-normal text-foreground tracking-tight">
                Interactive Learning Tools
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                Study with interactive flashcards, take AI-generated quizzes,
                and export beautifully formatted PDFs. Access text-to-speech for
                studying on the go.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { text: 'Text-to-speech' },
                  { text: 'PDF export' },
                  { text: 'Cloud backup' },
                  { text: 'Mobile access' }
                ].map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm text-foreground">
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section removed */}

      {/* CTA Section */}
      <section className="relative py-40 px-4 bg-gradient-to-b from-background to-muted/10 overflow-hidden">
        {/* Layered glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-muted/30 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-muted/20 rounded-full blur-2xl" />
        </div>

        {/* Subtle vignette effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/40" />
        </div>

        {/* Subtle dot pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.04]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
              backgroundSize: '20px 20px',
              color: 'hsl(var(--foreground))'
            }}
          />
        </div>

        <div className="container max-w-3xl text-center relative z-10">
          <div className="space-y-12">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-normal leading-tight text-foreground tracking-tight">
                Ready to study smarter?
              </h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
                Log in to access your library or start for free to explore
                automatic transcription and AI-powered study tools.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button
                asChild
                variant="outline"
                className="w-full sm:w-auto min-w-[180px] h-11 px-8 font-normal"
              >
                <Link href="/login">Log in</Link>
              </Button>
              <Button
                asChild
                className="w-full sm:w-auto min-w-[180px] h-11 px-8 font-normal"
              >
                <Link href="/register">Start for free</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Completely free to use • No credit card required
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
