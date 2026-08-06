import type { jsPDF } from "jspdf"

/**
 * Loads the logo PNG and adds it to a jsPDF document.
 * The logo is loaded from the public folder at runtime.
 */
let cachedLogoBase64: string | null = null

async function getLogoBase64(): Promise<string> {
  if (cachedLogoBase64) return cachedLogoBase64
  const response = await fetch("/logo.png")
  const blob = await response.blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      cachedLogoBase64 = reader.result as string
      resolve(cachedLogoBase64)
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Adds the brand logo to a jsPDF document at the specified position.
 * Must be called with `await` since it loads the image asynchronously on first use.
 */
export async function addLogoToPdf(doc: jsPDF, x: number, y: number, width: number, height: number) {
  try {
    const dataUrl = await getLogoBase64()
    doc.addImage(dataUrl, "PNG", x, y, width, height)
  } catch {
    // Fallback: draw orange circle with P
    doc.setFillColor(245, 130, 13)
    doc.circle(x + width / 2, y + height / 2, width / 2, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(width * 0.6)
    doc.setTextColor(255, 255, 255)
    doc.text("P", x + width * 0.28, y + height * 0.65)
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
  }
}

/**
 * Synchronous fallback — draws an orange circle with "P" when
 * async loading isn't practical (called from non-async contexts).
 */
export function drawLogoOnPdf(doc: jsPDF, centerX: number, centerY: number, radius: number) {
  doc.setFillColor(245, 130, 13)
  doc.circle(centerX, centerY, radius, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(radius * 1.6)
  doc.setTextColor(255, 255, 255)
  doc.text("P", centerX - radius * 0.35, centerY + radius * 0.45)
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
}
