// src/services/pdfService.ts
import * as pdfjsLib from "pdfjs-dist";

// Configure worker to use local file copied by vite-plugin-static-copy
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

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
      console.log('Starting PDF extraction for:', file.name);
      const arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer loaded, size:', arrayBuffer.byteLength);
      
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useSystemFonts: true,
      });

      console.log('Loading PDF document...');
      const pdf = await loadingTask.promise;
      console.log('PDF loaded successfully, total pages:', pdf.numPages);

      const pageCount = pdf.numPages;
      const pages: { number: number; text: string }[] = [];

      // Process pages in batches to avoid memory issues
      const batchSize = 5;
      for (let batch = 0; batch < Math.ceil(pageCount / batchSize); batch++) {
        const startPage = batch * batchSize + 1;
        const endPage = Math.min((batch + 1) * batchSize, pageCount);
        
        console.log(`Processing batch ${batch + 1}: pages ${startPage}-${endPage}`);
        
        for (let i = startPage; i <= endPage; i++) {
          try {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            
            // Extract text with better formatting
            const pageText = content.items
              .map((item: any) => {
                if ('str' in item && item.str && item.str.trim()) {
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
              console.log(`✓ Page ${i}: ${pageText.length} characters extracted`);
            } else {
              console.warn(`⚠ Page ${i}: No readable text found`);
              pages.push({ number: i, text: `[Page ${i} - No readable text found]` });
            }
            
            // Clean up page resources
            page.cleanup();
          } catch (pageError) {
            console.error(`✗ Error processing page ${i}:`, pageError);
            pages.push({ number: i, text: `[Page ${i} - Error reading page]` });
          }
        }
      }

      // Clean up the PDF document
      await pdf.cleanup();
      pdf.destroy();

      console.log('✓ PDF extraction complete:', pages.length, 'pages processed');
      
      // Check if we got any readable content
      const totalTextLength = pages.reduce((sum, p) => sum + p.text.length, 0);
      if (totalTextLength < 50) {
        throw new Error('PDF appears to contain very little readable text. It may be image-based or scanned.');
      }
      
      return { 
        title: file.name.replace('.pdf', ''), 
        pageCount, 
        pages 
      };
    } catch (error) {
      console.error('PDF extraction error:', error);
      
      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('workerSrc') || error.message.includes('worker')) {
          throw new Error('PDF worker not loaded. Please refresh the page and try again.');
        } else if (error.message.includes('Invalid PDF')) {
          throw new Error('This file appears to be corrupted or is not a valid PDF.');
        } else if (error.message.includes('password')) {
          throw new Error('This PDF is password-protected. Please use an unprotected PDF.');
        } else if (error.message.includes('little readable text')) {
          throw new Error(error.message);
        } else {
          throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
      }
      
      throw new Error('Failed to extract text from PDF. Please try a different file.');
    }
  },
};