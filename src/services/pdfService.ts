import * as pdfjsLib from "pdfjs-dist";

// Configure worker for browser environment
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const PDFService = {
  validateFile(file: File) {
    if (!file) return { valid: false, error: "No file provided" };
    if (!file.name.toLowerCase().endsWith(".pdf")) return { valid: false, error: "File must be a PDF" };
    if (file.size > 10 * 1024 * 1024) return { valid: false, error: "File size exceeds 10MB limit" };
    if (file.size === 0) return { valid: false, error: "File appears to be empty" };
    return { valid: true };
  },

  async extractText(
    file: File
  ): Promise<{ title: string; pageCount: number; pages: { number: number; text: string }[] }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useSystemFonts: true 
      }).promise;

      const pageCount = pdf.numPages;
      const pages: { number: number; text: string }[] = [];

      for (let i = 1; i <= pageCount; i++) {
        try {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          
          // Extract text with better formatting
          const pageText = content.items
            .map((item: any) => {
              if (item.str && item.str.trim()) {
                return item.str;
              }
              return '';
            })
            .filter(text => text.length > 0)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (pageText && pageText.length > 10) {
            pages.push({ number: i, text: pageText });
          } else {
            // Add placeholder for empty pages
            pages.push({ number: i, text: `[Page ${i} - No readable text found]` });
          }
        } catch (pageError) {
          console.warn(`Error processing page ${i}:`, pageError);
          pages.push({ number: i, text: `[Page ${i} - Error reading page]` });
        }
      }

      // Clean up the PDF document
      pdf.destroy();

      return { 
        title: file.name.replace('.pdf', ''), 
        pageCount, 
        pages 
      };
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};