import { useState, useCallback, useRef } from 'react'
import JSZip from 'jszip'
import { resizeAndEncode, ImageTooSmallError } from './imageProcessor'

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
    <div className="bg-bg min-h-100vh flex flex-col gap-8 pt-8 px-4 pb-16 max-w-215 my-0 mx-auto">
      <header className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight mb-1">⚡ Rapid Pic Resize</h1>
        <p className="text-muted text m-0">
          Bilder auf 1920&times;1080 skalieren &amp; als ZIP herunterladen
        </p>
      </header>

      <main>
        <section className="py-1 px-0">
          <h2 className="text-[0.9rem] font-bold uppercase tracking-wider text-muted mb-3.5">So funktioniert's</h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            <li className="flex items-start gap-2 text-sm leading-normal text-muted">
              <span className="shrink-0 w-6 text-center mt-0.5">📁</span>
              <span>Bilder per Drag&nbsp;&amp;&nbsp;Drop oder Klick hochladen - auch mehrere gleichzeitig (JPEG, PNG, WebP, AVIF&nbsp;…)</span>
            </li>
            <li className="flex items-start gap-2 text-sm leading-normal text-muted">
              <span className="shrink-0 w-6 text-center mt-0.5">📐</span>
              <span>Querformat-Bilder werden auf mindestens&nbsp;<strong>1920&times;1080&nbsp;px</strong> skaliert, Hochformat auf mindestens&nbsp;<strong>1080&times;1920&nbsp;px</strong> – ohne Hochskalierung kleiner Bilder</span>
            </li>
            <li className="flex items-start gap-2 text-sm leading-normal text-muted">
              <span className="shrink-0 w-6 text-center mt-0.5">⚠️</span>
              <span>Bilder, die die Mindestauflösung nicht erfüllen, werden <strong>übersprungen</strong> und nicht in die ZIP aufgenommen</span>
            </li>
            <li className="flex items-start gap-2 text-sm leading-normal text-muted">
              <span className="shrink-0 w-6 text-center mt-0.5">⬇️</span>
              <span>Alle verarbeiteten Bilder als einzelne <strong>ZIP-Datei</strong> herunterladen - alles läuft lokal im Browser, keine Daten verlassen deinen Computer</span>
            </li>
          </ul>
        </section>

        <div
          className="border-2 cursor-pointer rounded-2xl py-12 px-8 text-center hover:outline-none ransition-border-color transition-background duration-200 select-none border-dashed border-border bg-surface hover:bg-surface-hover hover:border-accent"
          onDragOver={(e) => {
            e.preventDefault()
          }}
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
            className="absolute w-0 h-0 opacity-0 overflow-hidden whitespace-nowrap"
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <div className="text-5xl leading-none mb-3">🖼️</div>
          <p className="text-lg leading-none mb-1.5">
            Bilder hier ablegen oder{' '}
            <span className="text-accent underline">klicken zum Auswählen</span>
          </p>
          <p className="text-sm text-muted m-0">
            SVG · PNG · JPEG · WebP · AVIF · BMP · GIF und weitere
          </p>
        </div>

        {totalCount > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-semibold flex items-center gap-2">
                {doneCount}/{totalCount} Bilder verarbeitet
                {skippedCount > 0 && (
                  <span className="text-xs text-orange-500 font-semibold bg-orange-950 border border-orange-900 rounded-4xl py-0.5 px-2">
                    {skippedCount} zu klein
                  </span>
                )}
                {isProcessing && (
                  <span className="inline-block w-4 h-4 border-2 border-border border-t-accent rounded-[50%] animate-spin" aria-label="Verarbeite…" />
                )}
              </span>
              <div className="flex gap-2 flex-wrap">
                {doneCount > 0 && (
                  <button
                    className="text-white bg-accent"
                    onClick={handleDownloadZip}
                    disabled={isZipping || isProcessing}
                  >
                    {isZipping
                      ? 'Erstelle ZIP…'
                      : `⬇ ZIP herunterladen (${doneCount})`}
                  </button>
                )}
                <button
                  className="text-text bg-surface border border-border"
                  onClick={handleClear}
                  disabled={isProcessing}
                >
                  Liste leeren
                </button>
              </div>
            </div>

            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {results.map((r) => (                
                <li key={r.id} className={`flex items-center gap-2 py-2 px-4 rounded-xl bg-surface border border-border text-sm transition-border-color duration-150 ${r.status === 'error' ? 'border-red-500' : r.status === 'skipped' ? 'border-orange-500' : r.status === 'done' ? 'border-green-500' : 'border-muted'}`}>
                  <span className="shrink-0">
                    {r.status === 'pending' && '⏳'}
                    {r.status === 'processing' && '⚙️'}
                    {r.status === 'done' && '✅'}
                    {r.status === 'error' && '❌'}
                    {r.status === 'skipped' && '⚠️'}
                  </span>
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap" title={r.outputName}>
                    {r.originalName}
                  </span>
                  <span className="shrink-0 flex items-center gap-1 text-muted text-sm">
                    <span>
                      {(r.originalSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                    {r.outputSize !== undefined && (
                      <span className="text-green-500 font-semibold">
                        → {(r.outputSize / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                    {r.error && (
                      <span className={r.status === 'skipped' ? 'text-orange-500 font-medium' : 'text-red-700'}>
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
