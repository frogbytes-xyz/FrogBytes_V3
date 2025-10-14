"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface Transcription {
  id: string
  upload_id: string
  raw_text: string
  language: string
  word_count: number
  duration_seconds: number
  status: string
  error_message: string | null
  created_at: string
  uploads: {
    filename: string
    file_type: string
    file_size: number
    status: string
  }
}

export default function ClientPage() {
  const searchParams = useSearchParams()
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const uploadId = searchParams.get('uploadId')
  const transcriptionId = searchParams.get('id')

  useEffect(() => {
    fetchTranscriptions()
  }, [uploadId, transcriptionId])

  const fetchTranscriptions = async () => {
    setLoading(true)
    setError(null)
    
    try {
      let url = '/api/test/transcription'
      if (transcriptionId) {
        url += `?id=${transcriptionId}`
      } else if (uploadId) {
        url += `?uploadId=${uploadId}`
      }

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transcriptions')
      }

      setTranscriptions(Array.isArray(data.transcriptions) ? data.transcriptions : [data.transcriptions])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Debug Transcriptions</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">Loading transcriptions...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Debug Transcriptions</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Debug Transcriptions</h1>
          <p className="text-gray-600">
            {transcriptionId ? `Viewing transcription: ${transcriptionId}` :
             uploadId ? `Viewing transcriptions for upload: ${uploadId}` :
             'Viewing recent transcriptions'}
          </p>
          <button
            onClick={fetchTranscriptions}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>

        {transcriptions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">No transcriptions found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {transcriptions.map((t) => (
              <div key={t.id} className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
                  <div>
                    <h3 className="font-semibold text-gray-700">Transcription Details</h3>
                    <p className="text-sm text-gray-600">ID: {t.id}</p>
                    <p className="text-sm text-gray-600">Upload ID: {t.upload_id}</p>
                    <p className="text-sm text-gray-600">
                      Status: <span className={`font-semibold ${
                        t.status === 'completed' ? 'text-green-600' : 'text-red-600'
                      }`}>{t.status}</span>
                    </p>
                    <p className="text-sm text-gray-600">Created: {new Date(t.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700">Metadata</h3>
                    {t.uploads && (
                      <>
                        <p className="text-sm text-gray-600">File: {t.uploads.filename}</p>
                        <p className="text-sm text-gray-600">Type: {t.uploads.file_type}</p>
                        <p className="text-sm text-gray-600">Size: {(t.uploads.file_size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    )}
                    <p className="text-sm text-gray-600">Language: {t.language || 'N/A'}</p>
                    <p className="text-sm text-gray-600">Words: {t.word_count || 0}</p>
                    <p className="text-sm text-gray-600">Duration: {t.duration_seconds ? `${t.duration_seconds}s` : 'N/A'}</p>
                  </div>
                </div>

                {t.error_message && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                    <h4 className="font-semibold text-red-800 mb-1">Error</h4>
                    <p className="text-sm text-red-600">{t.error_message}</p>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Transcribed Text</h4>
                  <div className="bg-gray-50 rounded p-4 max-h-96 overflow-y-auto">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {t.raw_text || '(No text)'}
                    </p>
                  </div>
                  <div className="mt-2 text-right">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(t.raw_text)
                        alert('Copied to clipboard!')
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Copy text
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">📖 Usage</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• View specific transcription: <code>/debug/transcriptions?id=&lt;transcription_id&gt;</code></li>
            <li>• View by upload: <code>/debug/transcriptions?uploadId=&lt;upload_id&gt;</code></li>
            <li>• View recent: <code>/debug/transcriptions</code></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
