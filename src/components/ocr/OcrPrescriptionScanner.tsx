'use client'

import { useState, useCallback, useEffect } from 'react'
import { createWorker } from 'tesseract.js'
import { saveOCRResult } from '@/lib/offline-db'

/**
 * OCR PRESCRIPTION / DOCUMENT SCANNER
 * Client-side OCR via Tesseract.js — runs entirely in the browser, works offline,
 * supports English + Hindi (Devanagari). Ideal for scanning prescriptions,
 * lab reports, invoices, and ID cards without sending PHI to any external API.
 *
 * Usage:
 *   <OcrPrescriptionScanner
 *     source="prescription"
 *     patientId={patient.id}
 *     onComplete={(ocr) => console.log(ocr.extractedText)}
 *   />
 */

interface OcrPrescriptionScannerProps {
  source?: 'prescription' | 'labReport' | 'invoice' | 'idCard'
  patientId?: string
  onComplete?: (result: {
    extractedText: string
    parsedFields: any
    fileName: string
  }) => void
  className?: string
}

export function OcrPrescriptionScanner({
  source = 'prescription',
  patientId,
  onComplete,
  className,
}: OcrPrescriptionScannerProps) {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'recognizing' | 'done' | 'error'
  >('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{
    extractedText: string
    parsedFields: any
    fileName: string
  } | null>(null)
  const [error, setError] = useState('')

  // Load Tesseract worker once (English + Hindi)
  useEffect(() => {
    let worker: any = null
    let cancelled = false

    ;(async () => {
      try {
        setStatus('loading')
        worker = createWorker('eng+hin')
        worker.on('progress', (p: any) => {
          if (cancelled) return
          setProgress(Math.round((p.progress || 0) * 100))
        })
        await worker.load()
        await worker.loadLanguage('eng+hin')
        await worker.initialize('eng+hin')
        if (!cancelled) setStatus('idle')
      } catch (err: any) {
        if (cancelled) return
        setStatus('error')
        setError(err.message || 'OCR worker failed to load')
      }
      return () => {
        cancelled = true
        if (worker) worker.terminate()
      }
    })()
    return () => {
      cancelled = true
      if (worker) worker.terminate()
    }
  }, [])

  const recognize = useCallback(
    async (file: File) => {
      // In a real module the worker is held in a ref; here we reload per scan
      // to keep the component self-contained. For production, hoist the worker.
      const worker: any = await createWorker('eng+hin')
      try {
        setStatus('recognizing')
        setProgress(0)
        setError('')

        worker.on('progress', (p: any) => setProgress(Math.round((p.progress || 0) * 100)))

        await worker.load()
        await worker.loadLanguage('eng+hin')
        await worker.initialize('eng+hin')

        const { data } = await worker.recognize(file)
        const text = data.text || ''

        // Basic field extraction (prescription-oriented)
        const parsedFields = extractPrescriptionFields(text)

        const out = {
          extractedText: text,
          parsedFields,
          fileName: file.name,
        }
        setResult(out)
        setStatus('done')
        setProgress(100)

        // Persist to offline DB (queued for sync)
        await saveOCRResult({
          id: `ocr-${Date.now()}`,
          source,
          fileName: file.name,
          extractedText: text,
          parsedFields,
          patientId,
          synced: 0,
        })

        onComplete?.(out)

        await worker.terminate()
      } catch (err: any) {
        setStatus('error')
        setError(err.message || 'OCR failed')
        try {
          await worker.terminate()
        } catch {}
      }
    },
    [source, patientId, onComplete]
  )

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Please upload an image (jpg/png) or PDF.')
      return
    }
    recognize(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    recognize(file)
  }

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
        status === 'recognizing'
          ? 'border-teal-500 bg-teal-50/50 dark:border-teal-400 dark:bg-teal-900/20'
          : status === 'done'
            ? 'border-emerald-500 bg-emerald-50/50 dark:border-emerald-400 dark:bg-emerald-900/20'
            : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
      } ${className || ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        if (e.dataTransfer.types.includes('Files'))
          e.currentTarget.classList.add('border-teal-500', 'bg-teal-50/30')
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.currentTarget.classList.remove('border-teal-500', 'bg-teal-50/30')
      }}
      onDrop={handleDrop}
    >
      <input type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />

      {status === 'recognizing' && (
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="relative">
            <svg className="w-12 h-12 text-teal-600 dark:text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              <path d="M2 21l10-5 10 5" />
            </svg>
            <div className="absolute -inset-0.5 rounded-full border-2 border-teal-500 animate-spin"></div>
          </div>
          <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
            Scanning document… {progress}%
          </p>
        </div>
      )}

      {status === 'done' && result && (
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            OCR complete — {result.extractedText.length} chars extracted
          </p>
          <button
            onClick={() => {
              const blob = new Blob([result.extractedText], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${result.fileName.replace(/\.[^/.]+$/, '')}-ocr.txt`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
          >
            Download extracted text
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}

      {(status === 'idle' || status === 'error') && (
        <div className="flex flex-col items-center gap-2">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Drop or upload a prescription / report image
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Works offline · English + Hindi · PHI stays on this device
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Lightweight field extraction from OCR text.
 * Recognizes common prescription patterns (Rx, dosage, frequency, days).
 */
function extractPrescriptionFields(text: string): any {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const medicines: any[] = []
  let diagnosis: string | null = null

  const rxLine = lines.find((l) => /diagnos|rx|advice|impression/i.test(l))
  if (rxLine) diagnosis = rxLine.replace(/^(diagnos|rx|advice|impression)[:\-]\s*/i, '').trim()

  // Very naive medicine line capture: lines containing a digit + mg/ml/tab
  const medRegex = /(\d+)\s*(mg|ml|g|tab|capsule|tablet)/i
  for (const line of lines) {
    if (medRegex.test(line) && line.length > 3) {
      medicines.push({ raw: line })
    }
  }

  return {
    diagnosis,
    medicines,
    medicineCount: medicines.length,
    rawLineCount: lines.length,
  }
}
