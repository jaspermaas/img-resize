import { useState, useCallback, useRef } from 'react'
import JSZip from 'jszip'
import { resizeAndEncode, ImageTooSmallError } from './imageProcessor'
import './App.css'

interface ImageResult {
  id: number
  originalName: string
  outputName: string
  status: 'pending' | 'processing' | 'done' | 'error' | 'skipped'
  originalSize: number
  outputSize?: number
  error?: string
  blob?: Blob
}

let idCounter = 0

export default function App() {
  const [results, setResults] = useState<ImageResult[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isZipping, setIsZipping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateResult = useCallback(
    (id: number, patch: Partial<ImageResult>) =>
      setResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    []
  )

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith('image/')
      )
      if (imageFiles.length === 0) return

      const newEntries: ImageResult[] = imageFiles.map((f) => ({
        id: ++idCounter,
        originalName: f.name,
        outputName: f.name.replace(/\.[^.]+$/, '') + '_resized.jpg',
        status: 'pending',
        originalSize: f.size,
      }))

      setResults((prev) => [...prev, ...newEntries])
      setIsProcessing(true)

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        const entry = newEntries[i]

        updateResult(entry.id, { status: 'processing' })

        try {
          const blob = await resizeAndEncode(file)
          updateResult(entry.id, {
            status: 'done',
            outputSize: blob.size,
            blob,
          })
        } catch (e: unknown) {
          if (e instanceof ImageTooSmallError) {
            updateResult(entry.id, {
              status: 'skipped',
              error: e.message,
            })
          } else {
            updateResult(entry.id, {
              status: 'error',
              error: e instanceof Error ? e.message : String(e),
            })
          }
        }
      }

      setIsProcessing(false)
    },
    [updateResult]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles]
  )

  const handleDownloadZip = async () => {
    const done = results.filter((r) => r.status === 'done' && r.blob)
    if (done.length === 0) return

    setIsZipping(true)
    const zip = new JSZip()
    done.forEach((r) => zip.file(r.outputName, r.blob!))
    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = 'resized_images.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setIsZipping(false)
  }

  const handleClear = () => {
    if (!isProcessing) setResults([])
  }

  const doneCount = results.filter((r) => r.status === 'done').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length
  const totalCount = results.length

  return (
    <div className="app">
      <header className="app-header">
        <h1>⚡ Rapid Pic Resize</h1>
        <p className="app-subtitle">
          Bilder auf max. 1920&times;1080 skalieren &amp; als ZIP herunterladen
        </p>
      </header>

      <main className="app-main">
        <section className="info-section">
          <h2 className="info-title">So funktioniert's</h2>
          <ul className="info-list">
            <li>
              <span className="info-icon">📁</span>
              <span>Bilder per Drag&nbsp;&amp;&nbsp;Drop oder Klick hochladen – auch mehrere gleichzeitig (JPEG, PNG, WebP, AVIF&nbsp;…)</span>
            </li>
            <li>
              <span className="info-icon">📐</span>
              <span>Querformat-Bilder werden auf mindestens&nbsp;<strong>1920&times;1080&nbsp;px</strong> skaliert, Hochformat auf mindestens&nbsp;<strong>1080&times;1920&nbsp;px</strong> – ohne Hochskalierung kleiner Bilder</span>
            </li>
            <li>
              <span className="info-icon">⚠️</span>
              <span>Bilder, die die Mindestauflösung nicht erfüllen, werden <strong>übersprungen</strong> und nicht in die ZIP aufgenommen</span>
            </li>
            <li>
              <span className="info-icon">⬇️</span>
              <span>Alle verarbeiteten Bilder als einzelne <strong>ZIP-Datei</strong> herunterladen – alles läuft lokal im Browser, keine Daten verlassen deinen Computer</span>
            </li>
          </ul>
        </section>

        <div
          className={`drop-zone${isDragging ? ' drop-zone--dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          aria-label="Bilder auswählen oder ablegen"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="visually-hidden"
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <div className="drop-zone__icon">🖼️</div>
          <p className="drop-zone__text">
            Bilder hier ablegen oder{' '}
            <span className="drop-zone__link">klicken zum Auswählen</span>
          </p>
          <p className="drop-zone__hint">
            SVG · PNG · JPEG · WebP · AVIF · BMP · GIF und weitere
          </p>
        </div>

        {totalCount > 0 && (
          <section className="results-section">
            <div className="results-toolbar">
              <span className="results-count">
                {doneCount}/{totalCount} Bilder verarbeitet
                {skippedCount > 0 && (
                  <span className="skipped-badge">
                    {skippedCount} zu klein
                  </span>
                )}
                {isProcessing && (
                  <span className="spinner" aria-label="Verarbeite…" />
                )}
              </span>
              <div className="results-actions">
                {doneCount > 0 && (
                  <button
                    className="btn btn--primary"
                    onClick={handleDownloadZip}
                    disabled={isZipping || isProcessing}
                  >
                    {isZipping
                      ? 'Erstelle ZIP…'
                      : `⬇ ZIP herunterladen (${doneCount})`}
                  </button>
                )}
                <button
                  className="btn btn--secondary"
                  onClick={handleClear}
                  disabled={isProcessing}
                >
                  Liste leeren
                </button>
              </div>
            </div>

            <ul className="file-list">
              {results.map((r) => (
                <li key={r.id} className={`file-item file-item--${r.status}`}>
                  <span className="file-item__icon">
                    {r.status === 'pending' && '⏳'}
                    {r.status === 'processing' && '⚙️'}
                    {r.status === 'done' && '✅'}
                    {r.status === 'error' && '❌'}
                    {r.status === 'skipped' && '⚠️'}
                  </span>
                  <span className="file-item__name" title={r.outputName}>
                    {r.originalName}
                  </span>
                  <span className="file-item__sizes">
                    <span className="size-original">
                      {(r.originalSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                    {r.outputSize !== undefined && (
                      <span className="size-output">
                        → {(r.outputSize / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                    {r.error && (
                      <span className={r.status === 'skipped' ? 'file-item__skipped' : 'file-item__error'}>
                        {r.error}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
