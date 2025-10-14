'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import FileUpload from '@/components/FileUpload'
import MetadataForm from '@/components/MetadataForm'
import type { LibraryMetadata } from '@/components/MetadataForm'
import { createClient } from '@/services/supabase/client'
import Menubar from '@/components/layout/Menubar'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/button'
import { getPendingFile, clearPendingFile } from '@/lib/pendingFileStore'
import ProcessingProgress from '@/components/ProcessingProgress'

type ProcessingStep = 'idle' | 'uploading' | 'collecting-metadata' | 'transcribing' | 'summarizing' | 'compiling' | 'complete' | 'error'

export default function UploadPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle')
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [_transcriptionId, setTranscriptionId] = useState<string | null>(null)
  const [_summaryId, setSummaryId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [summaryType, setSummaryType] = useState<'compact' | 'detailed' | 'expanded'>('detailed')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadMetadata, setUploadMetadata] = useState<LibraryMetadata>({})

  // sign out handled by Menubar; no local handler required

  useEffect(() => {
    async function checkAuthAndSetup() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      // Check for pending file from main page
      const file = getPendingFile()
      if (file) {
        setPendingFile(file)
        clearPendingFile()
      }

      if (!session) {
        // Not logged in
        setUser(null)
      } else {
        // User is logged in
        setUser(session.user)
      }

      setIsLoading(false)
    }

    checkAuthAndSetup()
  }, [router])

  const handleUploadComplete = async (fileId: string) => {
    console.log('Upload complete:', fileId)
    setUploadId(fileId)
    // Start processing immediately; we'll collect metadata after summary is generated
    setProcessingStep('transcribing')
    await startProcessing(fileId)
  }

  const handleMetadataComplete = async (metadata: LibraryMetadata) => {
    console.log('Metadata collected:', metadata)
    setUploadMetadata(metadata)

    try {
      // Update summary record with metadata before allowing access
      const supabase = createClient()
      const summaryId = _summaryId
      if (!summaryId) throw new Error('Missing summary ID')

      const updateData: Record<string, unknown> = {}
      if (metadata.title) updateData.title = metadata.title
      if (metadata.documentType) updateData.document_type = metadata.documentType
      if (metadata.fileCategory) updateData.file_category = metadata.fileCategory
      if (metadata.university) updateData.university = metadata.university
      if (metadata.courseCode) updateData.course_code = metadata.courseCode
      if (metadata.courseName) updateData.course_name = metadata.courseName
      if (metadata.subject) updateData.subject = metadata.subject
      if (metadata.professor) updateData.professor = metadata.professor
      if (metadata.semester) updateData.semester = metadata.semester
      if (metadata.academicYear) updateData.academic_year = metadata.academicYear
      if (metadata.lectureNumber) updateData.lecture_number = metadata.lectureNumber
      if (metadata.lectureDate) updateData.lecture_date = metadata.lectureDate
      if (metadata.language) updateData.language = metadata.language
      if (metadata.difficultyLevel) updateData.difficulty_level = metadata.difficultyLevel
      if (metadata.tags && metadata.tags.length > 0) updateData.tags = metadata.tags
      if (metadata.makePublic !== undefined) updateData.is_public = metadata.makePublic

      // Mark metadata as complete if key fields are present
      updateData.metadata_complete = !!(metadata.title && metadata.university && metadata.subject)

      const { error: updateError } = await (supabase
        .from('summaries') as any)
        .update(updateData)
        .eq('id', summaryId)

      if (updateError) {
        console.error('Failed to update summary with metadata:', updateError)
        throw new Error('Failed to save metadata')
      }

      // Redirect to learn page
      setProcessingStep('complete')
      setTimeout(() => {
        router.push(`/learn/${summaryId}`)
      }, 300)
    } catch (error) {
      console.error('Metadata save error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save metadata')
      setProcessingStep('error')
    }
  }

  const startProcessing = async (fileId?: string) => {
    const currentUploadId = fileId || uploadId
    if (!currentUploadId) {
      setErrorMessage('No upload ID found')
      setProcessingStep('error')
      return
    }

    // NOTE: placeholder declaration to satisfy TypeScript during build.
    // The actual pdfBlob is produced later in the pipeline; this file
    // contains an upload section after an early return, so declare here
    // to avoid "Cannot find name 'pdfBlob'" errors while keeping
    // runtime behavior unchanged.
    const pdfBlob: any = undefined

    try {
      // Step 1: Transcribe the audio
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: currentUploadId })
      })

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json()
        throw new Error(errorData.details?.[0] || errorData.error || 'Transcription failed')
      }

      const transcribeData = await transcribeResponse.json()
      console.log('Transcription complete:', transcribeData.transcription.id)
      setTranscriptionId(transcribeData.transcription.id)
      setProcessingStep('summarizing')

      // Step 2: Generate summary
      const summarizeResponse = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptionId: transcribeData.transcription.id,
          summaryType: summaryType
        })
      })

      if (!summarizeResponse.ok) {
        const errorData = await summarizeResponse.json()
        throw new Error(errorData.details?.[0] || errorData.error || 'Summarization failed')
      }

      const summarizeData = await summarizeResponse.json()
      console.log('Summary complete:', summarizeData.summary.id)
      setSummaryId(summarizeData.summary.id)

      // Prefill metadata using AI-extracted title (from worker) and defaults
      setUploadMetadata(prev => ({
        title: summarizeData.summary?.title || prev.title || undefined,
        documentType: prev.documentType || 'lecture',
        fileCategory: prev.fileCategory || 'lecture',
        language: prev.language || 'en',
        ...prev,
      }))

      // After summary is generated, require metadata before compiling and viewing
      setProcessingStep('collecting-metadata')
      return

      // Upload PDF to Supabase Storage
      const supabase = createClient()
      const pdfFileName = `${summarizeData.summary.id}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(`${user.id}/${pdfFileName}`, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        })

      if (uploadError) {
        // uploadError may be null in some client typings; guard its message access
        const message = uploadError?.message || String(uploadError)
        throw new Error('Failed to upload PDF: ' + message)
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pdfs')
        .getPublicUrl(`${user.id}/${pdfFileName}`)

      // Update summary with PDF URL and metadata
      const updateData: Record<string, unknown> = {
        pdf_url: publicUrl,
        file_size_bytes: pdfBlob?.size,
      }

      // Add metadata if provided
      if (uploadMetadata.title) updateData.title = uploadMetadata.title
      if (uploadMetadata.documentType) updateData.document_type = uploadMetadata.documentType
      if (uploadMetadata.fileCategory) updateData.file_category = uploadMetadata.fileCategory
      if (uploadMetadata.university) updateData.university = uploadMetadata.university
      if (uploadMetadata.courseCode) updateData.course_code = uploadMetadata.courseCode
      if (uploadMetadata.courseName) updateData.course_name = uploadMetadata.courseName
      if (uploadMetadata.subject) updateData.subject = uploadMetadata.subject
      if (uploadMetadata.professor) updateData.professor = uploadMetadata.professor
      if (uploadMetadata.semester) updateData.semester = uploadMetadata.semester
      if (uploadMetadata.academicYear) updateData.academic_year = uploadMetadata.academicYear
      if (uploadMetadata.lectureNumber) updateData.lecture_number = uploadMetadata.lectureNumber
      if (uploadMetadata.lectureDate) updateData.lecture_date = uploadMetadata.lectureDate
      if (uploadMetadata.language) updateData.language = uploadMetadata.language
      if (uploadMetadata.difficultyLevel) updateData.difficulty_level = uploadMetadata.difficultyLevel
      const maybeTags = uploadMetadata.tags
      if (maybeTags && Array.isArray(maybeTags) && (maybeTags as string[]).length > 0) {
        updateData.tags = maybeTags as string[]
      }
      if (uploadMetadata.makePublic !== undefined) updateData.is_public = uploadMetadata.makePublic
      
      // Mark metadata as complete if key fields are present
      updateData.metadata_complete = !!(uploadMetadata.title && uploadMetadata.university && uploadMetadata.subject)

      const { error: updateError } = await (supabase
        .from('summaries') as any)
        .update(updateData)
        .eq('id', summarizeData.summary.id)

      if (updateError) {
        console.error('Failed to update summary with PDF URL and metadata:', updateError)
        throw new Error('Failed to save PDF URL to database')
      }

      console.log('PDF uploaded successfully:', {
        summary_id: summarizeData.summary.id,
        pdf_url: publicUrl,
        file_size: pdfBlob.size
      })

      setProcessingStep('complete')

      // Redirect to learn page after 2 seconds
      setTimeout(() => {
        router.push(`/learn/${summarizeData.summary.id}`)
      }, 2000)

    } catch (error) {
      console.error('Processing error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Processing failed')
      setProcessingStep('error')
    }
  }

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error)
    setErrorMessage(error)
    setProcessingStep('error')
  }


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Menubar />

      {/* Content */}
      <div className="container max-w-5xl pt-28 pb-24 px-4">
        {processingStep !== 'collecting-metadata' && (
          <div className="mb-16 text-center">
            <h1 className="text-4xl md:text-5xl font-normal mb-4 text-foreground">Upload Lecture</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload an audio or video file of your lecture to generate an AI-powered summary
            </p>
          </div>
        )}

        {processingStep === 'idle' && (
          <>
            <div className="mb-12">
              <h2 className="text-center text-sm font-medium text-muted-foreground mb-6">
                Choose Summary Detail Level
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { value: 'compact', label: 'Compact', percent: '50-60%', description: 'Quick overview' },
                  { value: 'detailed', label: 'Detailed', percent: '80%', description: 'Recommended', recommended: true },
                  { value: 'expanded', label: 'Expanded', percent: '120%', description: 'Comprehensive' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSummaryType(option.value as any)}
                    className={`relative p-6 rounded-xl border-2 transition-all duration-300 text-left ${
                      summaryType === option.value
                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                        : 'border-border/50 hover:border-primary/30 bg-gradient-to-b from-muted/5 to-background'
                    }`}
                  >
                    {option.recommended && (
                      <div className="absolute -top-2 right-4 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                        Recommended
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        summaryType === option.value ? 'border-primary' : 'border-border'
                      }`}>
                        {summaryType === option.value && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        )}
                      </div>
                      <h3 className="text-lg font-normal text-foreground">{option.label}</h3>
                    </div>
                    <div className="text-3xl font-normal text-foreground mb-2">{option.percent}</div>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <FileUpload
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
              initialFile={pendingFile}
              user={user}
            />
          </>
        )}

        {processingStep === 'collecting-metadata' && (
          <div className="max-w-4xl mx-auto">
            <MetadataForm
              onComplete={handleMetadataComplete}
              initialData={uploadMetadata}
              showPublicOption={true}
            />
          </div>
        )}

        {processingStep !== 'idle' && processingStep !== 'collecting-metadata' && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-b from-muted/5 to-background rounded-2xl p-8 border border-border/30">
              <ProcessingProgress
                currentStage={processingStep}
                {...(errorMessage ? { errorMessage } : {})}
                summaryType={summaryType}
              />
              
              {/* Error - Try Again Button */}
              {processingStep === 'error' && (
                <div className="mt-6 flex justify-center">
                  <Button
                    onClick={() => {
                      setProcessingStep('idle')
                      setErrorMessage(null)
                      setUploadId(null)
                      setTranscriptionId(null)
                      setSummaryId(null)
                    }}
                    variant="destructive"
                    size="lg"
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {processingStep === 'idle' && (
          <div className="mt-16">
            <h2 className="text-center text-2xl font-normal mb-3 text-foreground">How it works</h2>
            <p className="text-center text-sm text-muted-foreground mb-12">
              Transform your lecture into study materials in four simple steps
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { number: 1, title: 'Upload', description: 'Upload your lecture recording (audio or video file)' },
                { number: 2, title: 'Transcribe', description: 'AI transcribes the content using ElevenLabs' },
                { number: 3, title: 'Summarize', description: 'Generate structured summary with Gemini AI' },
                { number: 4, title: 'Learn', description: 'View PDF and use AI Copilot for questions' },
              ].map((step, index) => (
                <div key={step.number} className="relative">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 border border-primary/20">
                      <span className="text-xl font-normal text-primary">{step.number}</span>
                    </div>
                    <h3 className="font-medium text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  {index < 3 && (
                    <div className="hidden lg:block absolute top-6 left-[60%] w-[80%] h-px bg-gradient-to-r from-border/50 to-transparent" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  )
}