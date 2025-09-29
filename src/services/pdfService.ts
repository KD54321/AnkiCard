import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";

// Configure worker (browser build)
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export const PDFService = {
  validateFile(file: File) {
    if (!file.name.endsWith(".pdf")) return { valid: false, error: "File must be a PDF" };
    if (file.size > 10 * 1024 * 1024) return { valid: false, error: "File size exceeds 10MB" };
    return { valid: true };
  },

  async extractText(
    file: File
  ): Promise<{ title: string; pageCount: number; pages: { number: number; text: string }[] }> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pageCount = pdf.numPages;
    const pages: { number: number; text: string }[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ").trim();

      if (pageText && pageText.length > 5) {
        pages.push({ number: i, text: pageText });
      } else {
        // Fallback to OCR
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/png");

        const ocrResult = await Tesseract.recognize(dataUrl, "eng");
        pages.push({ number: i, text: ocrResult.data.text.trim() });
      }
    }

    return { title: file.name, pageCount, pages };
  },
};
