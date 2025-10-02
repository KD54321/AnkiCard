// Browser-compatible AI service for flashcard generation
export interface FlashCard {
  front: string;
  back: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface AIResponse {
  cards: FlashCard[];
  concepts: string[];
  medicalTerms: string[];
  summary: string;
  error?: string;
}

export const AIService = {
  async generateFlashcards(text: string, format: 'basic' | 'cloze' | 'image' = 'basic'): Promise<AIResponse> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      console.warn('OpenAI API key not found, using mock data');
      return this.generateMockFlashcards(text, format);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(format)
            },
            {
              role: 'user',
              content: `Create ${format} flashcards from the following study material:\n\n${text.slice(0, 3000)}`
            }
          ],
          max_tokens: 1500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      try {
        const parsed = JSON.parse(content);
        return {
          cards: parsed.cards || [],
          concepts: parsed.concepts || [],
          medicalTerms: parsed.medicalTerms || [],
          summary: parsed.summary || 'Summary not available',
        };
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', content);
        return this.generateMockFlashcards(text, format);
      }

    } catch (error) {
      console.error('OpenAI API error:', error);
      console.log('Falling back to mock data');
      return this.generateMockFlashcards(text, format);
    }
  },

  getSystemPrompt(format: 'basic' | 'cloze' | 'image'): string {
    const basePrompt = `You are an AI that generates high-quality flashcards from study material. 
Return your response STRICTLY as valid JSON. Do not include explanations outside JSON.

The JSON format must be:
{
  "cards": [
    {"front": "...", "back": "...", "tags": ["..."], "difficulty": "easy|medium|hard"}
  ],
  "concepts": ["..."],
  "medicalTerms": ["..."],
  "summary": "..."
}`;

    switch (format) {
      case 'cloze':
        return basePrompt + `\n\nFor cloze deletion cards, format the front field like: "The {{c1::mitochondria}} is the powerhouse of the cell." and the back field should be empty or contain additional context.`;
      case 'image':
        return basePrompt + `\n\nFor image-based cards, include [IMAGE] placeholders in the front or back fields where relevant diagrams or images would be helpful.`;
      default:
        return basePrompt + `\n\nCreate traditional question-answer flashcards with clear, concise questions on the front and detailed answers on the back.`;
    }
  },

  generateMockFlashcards(text: string, format: 'basic' | 'cloze' | 'image' = 'basic'): AIResponse {
    const words = text.split(' ').slice(0, 100);
    const concepts = this.extractConcepts(words);
    
    const cards: FlashCard[] = concepts.slice(0, 8).map((concept, index) => {
      switch (format) {
        case 'cloze':
          return {
            front: `The {{c1::${concept}}} is an important concept in this material.`,
            back: `Additional context about ${concept} from the study material.`,
            tags: ['generated', 'cloze'],
            difficulty: index % 3 === 0 ? 'hard' : index % 2 === 0 ? 'medium' : 'easy'
          };
        case 'image':
          return {
            front: `What is ${concept}? [IMAGE: Diagram of ${concept}]`,
            back: `${concept} is a key concept discussed in the material. [Refer to diagram for visual representation]`,
            tags: ['generated', 'image-based'],
            difficulty: index % 3 === 0 ? 'hard' : index % 2 === 0 ? 'medium' : 'easy'
          };
        default:
          return {
            front: `What is ${concept}?`,
            back: `${concept} is a key concept from the study material that requires understanding and memorization.`,
            tags: ['generated', 'basic'],
            difficulty: index % 3 === 0 ? 'hard' : index % 2 === 0 ? 'medium' : 'easy'
          };
      }
    });

    return {
      cards,
      concepts: concepts.slice(0, 10),
      medicalTerms: concepts.filter(c => c.length > 6).slice(0, 5),
      summary: `This study material covers ${concepts.length} key concepts including ${concepts.slice(0, 3).join(', ')} and others. The content appears to be educational material suitable for flashcard generation.`
    };
  },

  extractConcepts(words: string[]): string[] {
    const concepts = words
      .filter(word => word.length > 4)
      .filter(word => /^[A-Z]/.test(word))
      .filter(word => !/^(The|This|That|With|From|When|Where|What|How|Why)$/.test(word))
      .slice(0, 15);
    
    return [...new Set(concepts)];
  }
};