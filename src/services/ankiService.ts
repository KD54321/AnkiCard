import JSZip from 'jszip';
import { FlashCard } from './aiService';

export class AnkiService {
  static async generateAnkiPackage(cards: FlashCard[], deckName: string = 'Generated Deck'): Promise<Blob> {
    const zip = new JSZip();
    
    // Create collection.anki2 (SQLite database structure as text for simplicity)
    const collectionData = this.createCollectionData(cards, deckName);
    zip.file('collection.anki2', collectionData);
    
    // Create media files (empty for now)
    zip.file('media', '{}');
    
    // Generate the zip file
    const blob = await zip.generateAsync({ type: 'blob' });
    return blob;
  }
  
  private static createCollectionData(cards: FlashCard[], deckName: string): string {
    // This is a simplified version - real Anki packages use SQLite
    // For production, you'd want to use a proper Anki package generator
    const timestamp = Date.now();
    
    const ankiData = {
      version: 1,
      deckName,
      cards: cards.map((card, index) => ({
        id: timestamp + index,
        front: card.front,
        back: card.back,
        type: card.type,
        tags: card.tags?.join(' ') || '',
        created: timestamp
      }))
    };
    
    return JSON.stringify(ankiData, null, 2);
  }
  
  static downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}