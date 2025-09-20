export interface FlashCard {
  id: string;
  front: string;
  back: string;
  type: 'basic' | 'cloze' | 'image';
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface AIExtractionResult {
  cards: FlashCard[];
  concepts: string[];
  summary: string;
}

export class AIService {
  // Mock AI service - in production, this would call OpenAI/Claude/etc
  static async extractFlashcards(
    text: string, 
    format: 'basic' | 'cloze' | 'image' = 'basic'
  ): Promise<AIExtractionResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const cards = this.generateMockCards(text, format);
    const concepts = this.extractConcepts(text);
    const summary = this.generateSummary(text);
    
    return { cards, concepts, summary };
  }
  
  private static generateMockCards(text: string, format: string): FlashCard[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const cards: FlashCard[] = [];
    
    // Generate cards based on content
    for (let i = 0; i < Math.min(sentences.length, 10); i++) {
      const sentence = sentences[i].trim();
      if (sentence.length < 20) continue;
      
      const words = sentence.split(' ');
      if (words.length < 5) continue;
      
      let front: string, back: string;
      
      if (format === 'cloze') {
        // Create cloze deletion by hiding key terms
        const keyWordIndex = Math.floor(words.length / 2);
        const keyWord = words[keyWordIndex];
        front = sentence.replace(keyWord, '{{c1::' + keyWord + '}}');
        back = sentence;
      } else {
        // Basic format - question and answer
        front = `What is the main concept in: "${sentence.substring(0, 50)}..."?`;
        back = sentence;
      }
      
      cards.push({
        id: `card-${i}`,
        front,
        back,
        type: format as any,
        tags: ['auto-generated'],
        difficulty: 'medium'
      });
    }
    
    return cards;
  }
  
  private static extractConcepts(text: string): string[] {
    // Simple concept extraction - in production, use NLP
    const words = text.toLowerCase().split(/\W+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    
    const concepts = words
      .filter(word => word.length > 4 && !commonWords.has(word))
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    return Object.entries(concepts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }
  
  private static generateSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const firstSentences = sentences.slice(0, 3).join('. ');
    return firstSentences.length > 200 
      ? firstSentences.substring(0, 200) + '...'
      : firstSentences;
  }
}