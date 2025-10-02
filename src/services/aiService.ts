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
  // Primary model (fast but sometimes unavailable)
  private static readonly HF_ENDPOINT_PRIMARY = 'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1';
  // Fallback model (more reliable)
  private static readonly HF_ENDPOINT_FALLBACK = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
  // Alternative fallback
  private static readonly HF_ENDPOINT_BACKUP = 'https://api-inference.huggingface.co/models/meta-llama/Llama-2-7b-chat-hf';
  
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
      
      // Try primary model first
      try {
        const response = await this.callHuggingFace(prompt, this.HF_ENDPOINT_PRIMARY);
        return this.parseAIResponse(response, format);
      } catch (primaryError) {
        console.warn('Primary model failed, trying fallback model...', primaryError);
        
        // Try fallback model
        try {
          const response = await this.callHuggingFace(prompt, this.HF_ENDPOINT_FALLBACK);
          return this.parseAIResponse(response, format);
        } catch (fallbackError) {
          console.warn('Fallback model also failed, trying backup model...', fallbackError);
          
          // Try backup model
          const response = await this.callHuggingFace(prompt, this.HF_ENDPOINT_BACKUP);
          return this.parseAIResponse(response, format);
        }
      }
    } catch (error) {
      console.error('All AI models failed, using pattern-based fallback:', error);
      return this.fallbackExtraction(text, format);
    }
  }

  private static buildPrompt(text: string, format: string): string {
    return `<s>[INST] Create flashcards from this text.

TEXT:
${text.substring(0, 2500)}

Create exactly 15 flashcards in JSON format. Each flashcard should have:
- front: A question or prompt
- back: The answer
- tags: Array of relevant topics
- difficulty: "easy", "medium", or "hard"

Output ONLY this JSON structure, nothing else:

{
  "cards": [
    {"front": "What is myopia?", "back": "A refractive error where distant objects appear blurry", "tags": ["refraction"], "difficulty": "easy"}
  ],
  "concepts": ["myopia", "refraction"],
  "medicalTerms": ["myopia"],
  "summary": "Overview of the content"
}

Generate 15 flashcards now:
[/INST]

{
  "cards": [`;
  }

  private static async callHuggingFace(prompt: string, endpoint?: string): Promise<string> {
    if (!this.apiKey) throw new Error('API key not set');

    const modelEndpoint = endpoint || this.HF_ENDPOINT_PRIMARY;
    console.log('Calling Hugging Face model:', modelEndpoint);

    const response = await fetch(modelEndpoint, {
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
      if (response.status === 404) {
        throw new Error('Model not found or unavailable. Trying alternative model...');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API token. Please check your Hugging Face token in Settings.');
      }
      
      const error = await response.json().catch(() => ({}));
      throw new Error(`Hugging Face API error (${response.status}): ${error.error || response.statusText}`);
    }

    const data = await response.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      return data[0]?.generated_text || '';
    } else if (data.generated_text) {
      return data.generated_text;
    } else if (data[0]?.generated_text) {
      return data[0].generated_text;
    }
    
    console.warn('Unexpected response format:', data);
    throw new Error('Unexpected response format from Hugging Face');
  }

  private static parseAIResponse(response: string, format: string): ExtractionResult {
    try {
      console.log('Parsing AI response...');
      console.log('Raw AI response (first 500 chars):', response.substring(0, 500));
      
      // The model might complete the JSON we started, so prepend if needed
      let fullResponse = response;
      if (!response.trim().startsWith('{')) {
        // Add back the opening we provided in the prompt
        fullResponse = '{\n  "cards": [' + response;
      }
      
      // Find the complete JSON object
      let jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      
      // If still no match, try to extract just the cards array
      if (!jsonMatch) {
        console.log('Trying to extract cards array directly...');
        const cardsMatch = response.match(/\[[\s\S]*\]/);
        if (cardsMatch) {
          // Wrap in proper JSON structure
          fullResponse = `{"cards": ${cardsMatch[0]}, "concepts": [], "medicalTerms": [], "summary": "Generated from text"}`;
          jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        }
      }
      
      if (!jsonMatch) {
        console.error('No JSON found in AI response after all attempts');
        throw new Error('No JSON found in response');
      }

      console.log('Extracted JSON (first 300 chars):', jsonMatch[0].substring(0, 300));
      
      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Attempted to parse:', jsonMatch[0].substring(0, 500));
        throw new Error('Invalid JSON format from AI');
      }
      
      console.log('Parsed object keys:', Object.keys(parsed));
      console.log('Number of cards in response:', parsed.cards?.length || 0);
      
      const cards: FlashCard[] = (parsed.cards || []).map((card: any, index: number) => ({
        id: `card-${Date.now()}-${index}`,
        front: card.front || '',
        back: card.back || '',
        type: format,
        tags: Array.isArray(card.tags) ? card.tags : [],
        context: card.context,
        difficulty: card.difficulty || 'medium'
      })).filter((card: FlashCard) => card.front && card.back);

      console.log(`Successfully parsed ${cards.length} valid cards from AI response`);

      // If AI didn't return cards, throw error to trigger fallback
      if (cards.length === 0) {
        console.warn('AI returned empty card list, triggering fallback');
        throw new Error('AI returned empty card list');
      }

      return {
        cards,
        concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
        summary: parsed.summary || 'No summary available',
        medicalTerms: Array.isArray(parsed.medicalTerms) ? parsed.medicalTerms : []
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Will use fallback extraction instead');
      throw error; // Re-throw to trigger fallback
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

    // Better patterns for different content structures
    const definitionPattern = /^([A-Z][^:—-]{2,50})[:—-]\s*(.+)$/;
    const bulletPattern = /^[•\-*]\s*(.+)$/;
    const numberedPattern = /^\d+\.\s*(.+)$/;
    const comparisonPattern = /(.+)\s+vs\.?\s+(.+)/i;
    const causeEffectPattern = /(.+)\s+(causes?|leads? to|results? in)\s+(.+)/i;

    lines.forEach((line, index) => {
      if (line.length < 15 || cards.length >= 25) return;

      // Pattern 1: Clear definitions (Term: Definition)
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
            // Create a better question
            const questionTypes = [
              `What is ${cleanTerm}?`,
              `How would you define ${cleanTerm}?`,
              `Explain ${cleanTerm}.`
            ];
            cards.push({
              id: `card-${Date.now()}-${index}`,
              front: questionTypes[index % 3],
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

      // Pattern 2: Comparisons (A vs B)
      const compMatch = line.match(comparisonPattern);
      if (compMatch) {
        const [, concept1, concept2] = compMatch;
        cards.push({
          id: `card-${Date.now()}-${index}`,
          front: format === 'cloze'
            ? `Compare: {{c1::${concept1.trim()}}} vs {{c2::${concept2.trim()}}}`
            : `What are the key differences between ${concept1.trim()} and ${concept2.trim()}?`,
          back: line,
          type: format,
          tags: [this.extractTag(concept1)],
          difficulty: 'medium'
        });
        return;
      }

      // Pattern 3: Cause and effect
      const causeMatch = line.match(causeEffectPattern);
      if (causeMatch) {
        const [, cause, relation, effect] = causeMatch;
        cards.push({
          id: `card-${Date.now()}-${index}`,
          front: format === 'cloze'
            ? `${cause.trim()} ${relation} {{c1::${effect.trim()}}}`
            : `What does ${cause.trim()} cause or lead to?`,
          back: effect.trim(),
          type: format,
          tags: [this.extractTag(cause)],
          difficulty: 'medium'
        });
        return;
      }

      // Pattern 4: Bullet points and numbered lists
      const bulletMatch = line.match(bulletPattern) || line.match(numberedPattern);
      const content = bulletMatch ? bulletMatch[1] : line;
      
      if (content.length > 20 && content.length < 300) {
        // Check for "is/are" statements (good for questions)
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

        // Generic fallback: create question from content
        const words = content.split(' ');
        if (words.length > 8) {
          // Extract the subject (first few words)
          const subject = words.slice(0, Math.min(4, Math.floor(words.length / 3))).join(' ');
          
          cards.push({
            id: `card-${Date.now()}-${index}`,
            front: format === 'cloze'
              ? content.replace(words.slice(-3).join(' '), `{{c1::${words.slice(-3).join(' ')}}}`)
              : `Explain: ${subject}...`,
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