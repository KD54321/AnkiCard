export interface FlashCard {
  id: string;
  front: string;
  back: string;
  type: 'basic' | 'cloze' | 'image';
  tags?: string[];
}

export class ParserService {
  /**
   * Offline method to extract flashcards from raw text
   */
  static async extractFlashcards(
    text: string,
    format: 'basic' | 'cloze' | 'image' = 'basic'
  ): Promise<{ cards: FlashCard[]; concepts: string[]; summary: string }> {
    if (!text || text.trim().length === 0) {
      return { cards: [], concepts: [], summary: '' };
    }

    const lines = text
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const cards: FlashCard[] = [];
    const conceptsSet = new Set<string>();

    lines.forEach((line, index) => {
      // Detect "Term: Definition" pattern
      if (line.includes(':')) {
        const [front, back] = line.split(':').map((s) => s.trim());
        if (front && back) {
          cards.push({
            id: `card-${index}`,
            front,
            back,
            type: format,
            tags: [front.split(' ')[0]] // simple tag from first word
          });
          conceptsSet.add(front.split(' ')[0]);
        }
      } else if (/^-/.test(line)) {
        // Bullet points
        const bulletText = line.replace(/^-/, '').trim();
        if (bulletText.length > 0) {
          cards.push({
            id: `card-${index}`,
            front: bulletText.split(' ').slice(0, 3).join(' ') + '...',
            back: bulletText,
            type: format,
            tags: []
          });
        }
      } else if (line.split(' ').length > 4) {
        // Fallback: split long sentences into front/back
        const words = line.split(' ');
        const front = words.slice(0, Math.ceil(words.length / 2)).join(' ') + '...';
        cards.push({
          id: `card-${index}`,
          front,
          back: line,
          type: format,
          tags: []
        });
        conceptsSet.add(words[0]);
      }
    });

    // Simple summary: first 3 lines joined
    const summary = lines.slice(0, 3).join(' ') + (lines.length > 3 ? '...' : '');
    const concepts = Array.from(conceptsSet).slice(0, 10);

    return { cards, concepts, summary };
  }
}
