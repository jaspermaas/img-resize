const LANDSCAPE_WIDTH = 1920
const LANDSCAPE_HEIGHT = 1080
const PORTRAIT_WIDTH = 1080
const PORTRAIT_HEIGHT = 1920

export class ImageTooSmallError extends Error {
  readonly width: number
  readonly height: number
  readonly requiredWidth: number
  readonly requiredHeight: number

  constructor(
    width: number,
    height: number,
    requiredWidth: number,
    requiredHeight: number
  ) {
    super(
      `Zu klein: ${width}\u00d7${height}\u202fpx (Minimum: ${requiredWidth}\u00d7${requiredHeight}\u202fpx)`
    )
    this.name = 'ImageTooSmallError'
    this.width = width
    this.height = height
    this.requiredWidth = requiredWidth
    this.requiredHeight = requiredHeight
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob returned null'))
      },
      type,
      quality
    )
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    img.src = src
  })
}

export async function resizeAndEncode(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)

    // Use portrait target for portrait images, landscape for everything else
    const isPortrait = img.naturalHeight > img.naturalWidth
    const targetWidth = isPortrait ? PORTRAIT_WIDTH : LANDSCAPE_WIDTH
    const targetHeight = isPortrait ? PORTRAIT_HEIGHT : LANDSCAPE_HEIGHT

    // Reject images that would need upscaling to meet the minimum
    if (img.naturalWidth < targetWidth || img.naturalHeight < targetHeight) {
      throw new ImageTooSmallError(
        img.naturalWidth,
        img.naturalHeight,
        targetWidth,
        targetHeight
      )
    }

    // Scale so that both dimensions meet the minimum target (cover mode)
    const scaleX = targetWidth / img.naturalWidth
    const scaleY = targetHeight / img.naturalHeight
    const scale = Math.max(scaleX, scaleY)

    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)

    // No compression – always use maximum quality
    return await canvasToBlob(canvas, 'image/jpeg', 1.0)
  } finally {
    URL.revokeObjectURL(url)
  }
}
