'use client'

import { useEffect, useState } from 'react'

interface ProcessingStage {
  id: string
  name: string
  description: string
  weight: number // Percentage of total progress
}

interface ProcessingProgressProps {
  currentStage: 'uploading' | 'transcribing' | 'summarizing' | 'compiling' | 'complete' | 'error'
  errorMessage?: string
  summaryType?: string
}

const STAGES: ProcessingStage[] = [
  { id: 'uploading', name: 'Uploading', description: 'Uploading your file to the server', weight: 10 },
  { id: 'transcribing', name: 'Transcribing', description: 'Converting speech to text using AI', weight: 40 },
  { id: 'summarizing', name: 'Summarizing', description: 'Generating structured summary with AI', weight: 35 },
  { id: 'compiling', name: 'Compiling PDF', description: 'Creating your final document', weight: 15 },
]

export default function ProcessingProgress({ 
  currentStage, 
  errorMessage,
  summaryType = 'detailed'
}: ProcessingProgressProps) {
  const [progress, setProgress] = useState(0)
  const [stageProgress, setStageProgress] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null)

  useEffect(() => {
    if (currentStage === 'error' || currentStage === 'complete') {
      setProgress(currentStage === 'complete' ? 100 : progress)
      setStageProgress(100)
      return
    }

    const currentStageIndex = STAGES.findIndex(s => s.id === currentStage)
    if (currentStageIndex === -1) return

    // Calculate base progress (completed stages)
    const completedWeight = STAGES
      .slice(0, currentStageIndex)
      .reduce((sum, stage) => sum + stage.weight, 0)

    // Animate stage progress
    const currentStageData = STAGES[currentStageIndex]
    if (!currentStageData) return
    const currentStageWeight = currentStageData.weight
    let localStageProgress = 0
    const stageInterval = setInterval(() => {
      localStageProgress += 2
      if (localStageProgress >= 100) {
        localStageProgress = 95 // Stop at 95% until actual completion
        clearInterval(stageInterval)
      }
      setStageProgress(localStageProgress)
      
      // Update overall progress
      const currentProgress = completedWeight + (currentStageWeight * localStageProgress / 100)
      setProgress(Math.min(currentProgress, 98))
      
      // Update estimated time
      const remainingProgress = 100 - currentProgress
      const secondsRemaining = Math.ceil(remainingProgress * 2) // ~2 seconds per percent
      if (secondsRemaining > 60) {
        setEstimatedTime(`~${Math.ceil(secondsRemaining / 60)} min remaining`)
      } else {
        setEstimatedTime(`~${secondsRemaining} sec remaining`)
      }
    }, 100)

    return () => clearInterval(stageInterval)
  }, [currentStage])

  const getCurrentStageIndex = () => {
    return STAGES.findIndex(s => s.id === currentStage)
  }

  const getStageStatus = (stageId: string) => {
    const stageIndex = STAGES.findIndex(s => s.id === stageId)
    const currentIndex = getCurrentStageIndex()
    
    if (currentStage === 'error') return 'error'
    if (stageIndex < currentIndex) return 'complete'
    if (stageIndex === currentIndex) return 'active'
    return 'pending'
  }

  return (
    <div className="w-full space-y-8">
      {/* Main Progress Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-medium text-foreground">
              {currentStage === 'complete' ? 'Processing Complete!' : 
               currentStage === 'error' ? 'Processing Failed' :
               STAGES.find(s => s.id === currentStage)?.name || 'Processing...'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {currentStage === 'error' ? errorMessage :
               currentStage === 'complete' ? 'Your document is ready' :
               STAGES.find(s => s.id === currentStage)?.description}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold text-primary">
              {Math.round(progress)}%
            </div>
            {estimatedTime && currentStage !== 'complete' && currentStage !== 'error' && (
              <div className="text-xs text-muted-foreground mt-1">
                {estimatedTime}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>

      {/* Stage Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAGES.map((stage, index) => {
          const status = getStageStatus(stage.id)
          const isActive = status === 'active'
          const isComplete = status === 'complete'
          const isError = status === 'error'
          
          return (
            <div 
              key={stage.id}
              className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${
                isActive ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' :
                isComplete ? 'border-primary/30 bg-primary/5' :
                isError ? 'border-destructive bg-destructive/5' :
                'border-border/50 bg-muted/5'
              }`}
            >
              {/* Stage Number/Icon */}
              <div className="flex items-start gap-3 mb-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                  isActive ? 'bg-primary text-primary-foreground animate-pulse' :
                  isComplete ? 'bg-primary text-primary-foreground' :
                  isError ? 'bg-destructive text-destructive-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {isComplete ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isError ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-sm mb-1 ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {stage.name}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {stage.id === 'summarizing' && summaryType ? 
                      `${summaryType.charAt(0).toUpperCase() + summaryType.slice(1)} summary` : 
                      stage.description}
                  </p>
                </div>
              </div>

              {/* Stage Progress Bar */}
              {isActive && (
                <div className="mt-3 space-y-1">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${stageProgress}%` }}
                    />
                  </div>
                  <div className="text-xs text-right text-muted-foreground">
                    {Math.round(stageProgress)}%
                  </div>
                </div>
              )}

              {/* Status Badge */}
              {isActive && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full shadow-md">
                  In Progress
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Additional Info */}
      {currentStage !== 'error' && currentStage !== 'complete' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Please keep this page open while we process your file...</span>
        </div>
      )}

      {currentStage === 'complete' && (
        <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg p-4 border border-primary/20">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Processing complete! Redirecting to your document...</span>
        </div>
      )}

      {currentStage === 'error' && errorMessage && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-4 border border-destructive/20">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium">Processing failed</p>
            <p className="text-xs text-destructive/80 mt-1">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}

