// src/services/aiService.ts
// Simplified to use Hugging Face only

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
  private static readonly HF_ENDPOINT = 'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1';
  private static apiKey: string | null = null;

  static setApiKey(key: string) {
    this.apiKey = key;
    console.log('Hugging Face API key set');
  }

  static hasApiKey(): boolean {
    return !!this.apiKey;
  }

  static async extractFlashcards(
    text: string,
    format: 'basic' | 'cloze' | 'image' = 'basic'
  ): Promise<ExtractionResult> {
    if (!text || text.trim().length === 0) {
      return { cards: [], concepts: [], summary: '', medicalTerms: [] };
    }

    // If no API key, use fallback extraction
    if (!this.apiKey) {
      console.log('No API key, using fallback extraction');
      return this.fallbackExtraction(text, format);
    }

    try {
      console.log('Using Hugging Face AI to extract flashcards...');
      const prompt = this.buildPrompt(text, format);
      const response = await this.callHuggingFace(prompt);
      return this.parseAIResponse(response, format);
    } catch (error) {
      console.error('AI extraction failed, using fallback:', error);
      return this.fallbackExtraction(text, format);
    }
  }

  private static buildPrompt(text: string, format: string): string {
    return `<s>[INST] You are an expert optometry educator creating Anki flashcards.

Create 15-20 ${format} flashcards from this optometry content:

${text.substring(0, 3000)}

Rules:
- Focus on key concepts, definitions, clinical info
- Make cards clear and testable
- Add relevant tags

Return ONLY valid JSON in this exact format:
{
  "cards": [
    {
      "front": "Question or prompt",
      "back": "Answer with context",
      "tags": ["topic1", "topic2"],
      "difficulty": "medium"
    }
  ],
  "concepts": ["concept1", "concept2"],
  "medicalTerms": ["term1", "term2"],
  "summary": "Brief overview"
}

Return ONLY the JSON, no other text.
[/INST]`;
  }

  private static async callHuggingFace(prompt: string): Promise<string> {
    if (!this.apiKey) throw new Error('API key not set');

    const response = await fetch(this.HF_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 2500,
          temperature: 0.3,
          top_p: 0.9,
          return_full_text: false
        }
      })
    });

    if (!response.ok) {
      if (response.status === 503) {
        throw new Error('Model is loading. Please wait 20 seconds and try again.');
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(`Hugging Face API error: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    return data[0]?.generated_text || data.generated_text || '';
  }

  private static parseAIResponse(response: string, format: string): ExtractionResult {
    try {
      console.log('Parsing AI response...');
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const cards: FlashCard[] = (parsed.cards || []).map((card: any, index: number) => ({
        id: `card-${Date.now()}-${index}`,
        front: card.front || '',
        back: card.back || '',
        type: format,
        tags: Array.isArray(card.tags) ? card.tags : [],
        context: card.context,
        difficulty: card.difficulty || 'medium'
      })).filter((card: FlashCard) => card.front && card.back);

      console.log(`Parsed ${cards.length} cards from AI response`);

      return {
        cards,
        concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
        summary: parsed.summary || 'No summary available',
        medicalTerms: Array.isArray(parsed.medicalTerms) ? parsed.medicalTerms : []
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
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
          cards.push({
            id: `card-${Date.now()}-${index}`,
            front: format === 'cloze' 
              ? `${cleanTerm}: {{c1::${cleanDef}}}` 
              : `What is ${cleanTerm}?`,
            back: cleanDef,
            type: format,
            tags: [this.extractTag(cleanTerm)],
            difficulty: 'medium'
          });
          conceptsSet.add(cleanTerm);
          if (this.isMedicalTerm(cleanTerm)) {
            medicalTermsSet.add(cleanTerm);
          }
        }
      } else {
        const bulletMatch = line.match(bulletPattern) || line.match(numberedPattern);
        const content = bulletMatch ? bulletMatch[1] : line;
        
        if (content.length > 20 && content.length < 200) {
          const words = content.split(' ');
          
          if (content.includes(' is ') || content.includes(' are ') || content.includes(' causes ')) {
            const parts = content.split(/ is | are | causes /);
            if (parts.length === 2) {
              cards.push({
                id: `card-${Date.now()}-${index}`,
                front: format === 'cloze' 
                  ? content.replace(parts[1], `{{c1::${parts[1]}}}`)
                  : `What does ${parts[0].trim()} refer to?`,
                back: content,
                type: format,
                tags: [this.extractTag(content)],
                difficulty: 'easy'
              });
            }
          } else if (words.length > 5) {
            const midpoint = Math.floor(words.length / 2);
            cards.push({
              id: `card-${Date.now()}-${index}`,
              front: words.slice(0, midpoint).join(' ') + '...',
              back: content,
              type: format,
              tags: [this.extractTag(content)],
              difficulty: 'easy'
            });
          }
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
    
    const optometryTerms = ['retina', 'cornea', 'lens', 'glaucoma', 'cataract', 'refraction', 'vision'];
    const lowerText = text.toLowerCase();
    
    for (const term of optometryTerms) {
      if (lowerText.includes(term)) {
        return term;
      }
    }
    
    return firstWord.toLowerCase() || 'general';
  }

  private static isMedicalTerm(text: string): boolean {
    const medicalPatterns = /ophthalm|retina|cornea|glaucoma|cataract|refract|myopi|hyperop|astigmat|presbyop|macula|optic|visual|acuity|anterior|posterior|vitreous|choroid|sclera|uvea|iris|pupil|lens|accommodation|convergence|strabismus|amblyopia|diplopia|nystagmus/i;
    return medicalPatterns.test(text);
  }

  static async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.apiKey) {
      return { success: false, message: 'No Hugging Face API key set. Using fallback mode.' };
    }

    try {
      const testText = 'Myopia: A refractive error where distant objects appear blurry due to the eye focusing images in front of the retina.';
      const result = await this.extractFlashcards(testText, 'basic');
      
      if (result.cards.length > 0) {
        return { success: true, message: `Connection successful! Generated ${result.cards.length} test card(s).` };
      } else {
        return { success: false, message: 'API responded but no cards were generated' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      };
    }
  }
}