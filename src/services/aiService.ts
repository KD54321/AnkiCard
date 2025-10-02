// src/services/aiService.ts - Complete OpenAI Implementation

export interface FlashCard {
  id: string;
  front: string;
  back: string;
  type: 'basic' | 'cloze' | 'image';
  tags?: string[];
  context?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface ExtractionResult {
  cards: FlashCard[];
  concepts: string[];
  summary: string;
  medicalTerms: string[];
}

export class AIService {
  private static readonly OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

  static getApiKey(): string | null {
    // Check session storage first, then environment variable
    return sessionStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || null;
  }

  static hasApiKey(): boolean {
    return !!this.getApiKey();
  }

  static isUsingCustomKey(): boolean {
    return !!sessionStorage.getItem('openai_api_key');
  }

  static isUsingEnvKey(): boolean {
    return !sessionStorage.getItem('openai_api_key') && !!import.meta.env.VITE_OPENAI_API_KEY;
  }

  static async generateFlashcards(
    text: string,
    format: 'basic' | 'cloze' | 'image' = 'basic'
  ): Promise<ExtractionResult> {
    if (!text || text.trim().length === 0) {
      return { cards: [], concepts: [], summary: '', medicalTerms: [] };
    }

    const apiKey = this.getApiKey();

    // If no API key, use fallback extraction
    if (!apiKey) {
      console.log('No API key, using fallback extraction');
      return this.fallbackExtraction(text, format);
    }

    try {
      console.log('Using OpenAI to generate flashcards...');
      const prompt = this.buildPrompt(text, format);
      const response = await this.callOpenAI(prompt, apiKey);
      return this.parseAIResponse(response, format);
    } catch (error) {
      console.error('OpenAI extraction failed, using fallback:', error);
      return this.fallbackExtraction(text, format);
    }
  }

  // Alias for backwards compatibility
  static async extractFlashcards(
    text: string,
    format: 'basic' | 'cloze' | 'image' = 'basic'
  ): Promise<ExtractionResult> {
    return this.generateFlashcards(text, format);
  }

  // Alias for regenerating with different format
  static async regenerateFlashcards(
    text: string,
    format: 'basic' | 'cloze' | 'image'
  ): Promise<ExtractionResult> {
    return this.generateFlashcards(text, format);
  }

  private static buildPrompt(text: string, format: string): string {
    if (format === 'cloze') {
      return `Create 15-20 cloze deletion flashcards from this content.

CONTENT:
${text.substring(0, 3000)}

CLOZE DELETION RULES:
- Use {{c1::text}} to mark what should be hidden
- Hide KEY concepts, not trivial words
- Each card tests ONE concept
- Include enough context

QUALITY STANDARDS:
✓ Test understanding, not just memorization
✓ Clear and unambiguous
✓ One concept per card

Return ONLY valid JSON:
{
  "cards": [
    {
      "front": "Myopia occurs when light focuses {{c1::in front of}} the retina.",
      "back": "in front of",
      "tags": ["refraction", "myopia"],
      "difficulty": "medium"
    }
  ],
  "concepts": ["myopia", "refraction"],
  "medicalTerms": ["myopia", "retina"],
  "summary": "Brief overview"
}`;
    } else {
      return `Create 15-20 high-quality flashcards from this content.

CONTENT:
${text.substring(0, 3000)}

QUESTION DESIGN:
1. Test UNDERSTANDING, not recognition
2. Ask "Why?", "How?", "Compare", "Explain"
3. Be specific and clear
4. One concept per card

GOOD EXAMPLES:
✓ "What causes distant objects to appear blurry in myopia?"
✓ "How does myopia differ from hyperopia?"
✓ "Why does the lens need to change shape?"

BAD EXAMPLES:
✗ "What is myopia?" (too vague)
✗ "Name something" (too broad)
✗ "Is myopia bad?" (yes/no)

Return ONLY valid JSON:
{
  "cards": [
    {
      "front": "What causes distant objects to appear blurry in myopia?",
      "back": "The eye focuses light in front of the retina instead of on it.",
      "tags": ["refraction", "myopia"],
      "difficulty": "medium"
    }
  ],
  "concepts": ["myopia", "refraction"],
  "medicalTerms": ["myopia", "retina"],
  "summary": "Brief overview"
}`;
    }
  }

  private static async callOpenAI(prompt: string, apiKey: string): Promise<string> {
    console.log('Calling OpenAI API...');

    const response = await fetch(this.OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educator creating high-quality Anki flashcards. You always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your OpenAI API key in Settings.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error (${response.status}): ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private static parseAIResponse(response: string, format: string): ExtractionResult {
    try {
      console.log('Parsing OpenAI response...');
      const parsed = JSON.parse(response);
      
      const cards: FlashCard[] = (parsed.cards || []).map((card: any, index: number) => ({
        id: `card-${Date.now()}-${index}`,
        front: card.front || '',
        back: card.back || '',
        type: format,
        tags: Array.isArray(card.tags) ? card.tags : [],
        context: card.context,
        difficulty: card.difficulty || 'medium'
      })).filter((card: FlashCard) => card.front && card.back);

      console.log(`Parsed ${cards.length} cards from OpenAI response`);

      return {
        cards,
        concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
        summary: parsed.summary || 'No summary available',
        medicalTerms: Array.isArray(parsed.medicalTerms) ? parsed.medicalTerms : []
      };
    } catch (error) {
      console.error('Failed to parse OpenAI response:', error);
      throw new Error('Failed to parse AI response. Please try again.');
    }
  }

  private static fallbackExtraction(
    text: string,
    format: 'basic' | 'cloze' | 'image'
  ): ExtractionResult {
    console.log('Using fallback pattern-based extraction');
    const lines = text
      .split(/\n/)
      .map(l => l.trim())
      .filter(l => l.length > 10);

    const cards: FlashCard[] = [];
    const conceptsSet = new Set<string>();
    const medicalTermsSet = new Set<string>();

    const definitionPattern = /^([A-Z][^:—-]{2,50})[:—-]\s*(.+)$/;
    const bulletPattern = /^[•\-*]\s*(.+)$/;
    const numberedPattern = /^\d+\.\s*(.+)$/;

    lines.forEach((line, index) => {
      if (line.length < 15 || cards.length >= 25) return;

      const defMatch = line.match(definitionPattern);
      if (defMatch) {
        const [, term, definition] = defMatch;
        const cleanTerm = term.trim();
        const cleanDef = definition.trim();
        
        if (cleanDef.length > 10) {
          if (format === 'cloze') {
            cards.push({
              id: `card-${Date.now()}-${index}`,
              front: `${cleanTerm}: {{c1::${cleanDef}}}`,
              back: cleanDef,
              type: format,
              tags: [this.extractTag(cleanTerm)],
              difficulty: 'medium'
            });
          } else {
            cards.push({
              id: `card-${Date.now()}-${index}`,
              front: `What is ${cleanTerm}?`,
              back: cleanDef,
              type: format,
              tags: [this.extractTag(cleanTerm)],
              difficulty: 'easy'
            });
          }
          conceptsSet.add(cleanTerm);
          if (this.isMedicalTerm(cleanTerm)) {
            medicalTermsSet.add(cleanTerm);
          }
        }
        return;
      }

      const bulletMatch = line.match(bulletPattern) || line.match(numberedPattern);
      const content = bulletMatch ? bulletMatch[1] : line;
      
      if (content.length > 20 && content.length < 300) {
        if (content.includes(' is ') || content.includes(' are ')) {
          const parts = content.split(/ is | are /);
          if (parts.length === 2 && parts[0].length > 3 && parts[1].length > 5) {
            cards.push({
              id: `card-${Date.now()}-${index}`,
              front: format === 'cloze' 
                ? content.replace(parts[1], `{{c1::${parts[1]}}}`)
                : `What can you tell me about ${parts[0].trim()}?`,
              back: parts[1].trim(),
              type: format,
              tags: [this.extractTag(content)],
              difficulty: 'easy'
            });
            return;
          }
        }

        const words = content.split(' ');
        if (words.length > 8) {
          const subject = words.slice(0, Math.min(4, Math.floor(words.length / 3))).join(' ');
          
          cards.push({
            id: `card-${Date.now()}-${index}`,
            front: `Explain: ${subject}...`,
            back: content,
            type: format,
            tags: [this.extractTag(content)],
            difficulty: 'easy'
          });
        }
      }
    });

    const summary = lines.slice(0, 3).join(' ').substring(0, 250) + '...';
    
    console.log(`Fallback extraction generated ${cards.length} cards`);
    
    return {
      cards: cards.slice(0, 25),
      concepts: Array.from(conceptsSet).slice(0, 15),
      summary,
      medicalTerms: Array.from(medicalTermsSet).slice(0, 10)
    };
  }

  private static extractTag(text: string): string {
    const words = text.split(' ');
    const firstWord = words[0].replace(/[^a-zA-Z]/g, '');
    
    const commonTerms = ['retina', 'cornea', 'lens', 'vision', 'anatomy', 'physiology'];
    const lowerText = text.toLowerCase();
    
    for (const term of commonTerms) {
      if (lowerText.includes(term)) {
        return term;
      }
    }
    
    return firstWord.toLowerCase() || 'general';
  }

  private static isMedicalTerm(text: string): boolean {
    const medicalPatterns = /ophthalm|retina|cornea|medical|clinical|diagnosis|treatment|symptom|disease|condition/i;
    return medicalPatterns.test(text);
  }

  static async testConnection(): Promise<{ success: boolean; message: string }> {
    const apiKey = this.getApiKey();
    
    if (!apiKey) {
      return { success: false, message: 'No OpenAI API key set. Using fallback mode.' };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        return { success: true, message: 'OpenAI API connection successful!' };
      } else {
        return { success: false, message: `API test failed: ${response.status} ${response.statusText}` };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      };
    }
  }
}