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
  
  // --- New Constants for Backoff ---
  private static readonly MAX_RETRIES = 5;
  private static readonly INITIAL_DELAY_MS = 1000; // 1 second

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
      
      // For large documents, process in chunks
      const chunks = this.intelligentChunk(text);
      console.log(`Processing document in ${chunks.length} chunks`);
      
      if (chunks.length === 1) {
        // Single chunk - process normally
        const prompt = this.buildPrompt(chunks[0], format);
        const response = await this.callOpenAI(prompt, apiKey);
        return this.parseAIResponse(response, format);
      } else {
        // Multiple chunks - process each and combine
        const allResults: ExtractionResult[] = [];
        
        for (let i = 0; i < chunks.length; i++) {
          console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
          const prompt = this.buildPrompt(chunks[i], format, i + 1, chunks.length);
          const response = await this.callOpenAI(prompt, apiKey);
          const result = this.parseAIResponse(response, format);
          allResults.push(result);
          
          // Small delay (500ms) is still helpful between chunks even with backoff in callOpenAI
          // The delay prevents hitting the rate limit from a batch of sequential requests.
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Combine results
        return this.combineResults(allResults);
      }
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

  private static intelligentChunk(text: string): string[] {
    // If text is short enough, return as single chunk
    if (text.length <= 6000) {
      return [text];
    }

    const chunks: string[] = [];
    const sections = text.split(/\n\n+/); // Split by double newlines (paragraphs/sections)
    let currentChunk = '';
    
    for (const section of sections) {
      // If adding this section would exceed chunk size and we have content
      if (currentChunk.length + section.length > 6000 && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = section;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + section;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // If we still have no chunks or only one very large chunk, split by character count
    if (chunks.length === 0 || (chunks.length === 1 && chunks[0].length > 6000)) {
      chunks.length = 0;
      const chunkSize = 6000;
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
      }
    }
    
    return chunks;
  }

  private static combineResults(results: ExtractionResult[]): ExtractionResult {
    const allCards: FlashCard[] = [];
    const allConcepts = new Set<string>();
    const allTerms = new Set<string>();
    const summaries: string[] = [];
    
    results.forEach(result => {
      allCards.push(...result.cards);
      result.concepts.forEach(c => allConcepts.add(c));
      result.medicalTerms.forEach(t => allTerms.add(t));
      if (result.summary) summaries.push(result.summary);
    });
    
    // Remove duplicate cards (same front text)
    const uniqueCards = allCards.filter((card, index, self) => 
      index === self.findIndex(c => c.front === card.front)
    );
    
    return {
      cards: uniqueCards,
      concepts: Array.from(allConcepts),
      medicalTerms: Array.from(allTerms),
      summary: summaries.length > 0 ? summaries.join(' ') : 'Combined content from multiple sections'
    };
  }

  private static buildPrompt(text: string, format: string, chunkNum?: number, totalChunks?: number): string {
    const chunkInfo = chunkNum && totalChunks ? ` (Part ${chunkNum} of ${totalChunks})` : '';
    const cardCount = totalChunks && totalChunks > 1 ? Math.ceil(30 / totalChunks) : 25;
    
    // Detect if content is primarily French
    const isFrench = /[àâäæçéèêëïîôùûüÿœ]/i.test(text) || 
                       /\b(le|la|les|un|une|des|est|sont|et|ou|dans|pour|avec)\b/i.test(text);
    
    if (format === 'cloze') {
      return `Create ${cardCount} cloze deletion flashcards from this ${isFrench ? 'French' : 'English'} medical/optometry content${chunkInfo}.

${isFrench ? 'IMPORTANT: The source content is in FRENCH. You MUST create all flashcards in FRENCH.' : 'IMPORTANT: The source content is in ENGLISH. You MUST create all flashcards in ENGLISH.'}

CONTENT:
${text.substring(0, 6000)}

CLOZE DELETION RULES:
- Use {{c1::text}} to mark what should be hidden
- Hide KEY concepts, numbers, definitions - not trivial words
- Each card tests ONE concept
- Include enough context
- For lists/sequences, create multiple cards
- **MAINTAIN THE SAME LANGUAGE AS THE SOURCE (${isFrench ? 'FRENCH' : 'ENGLISH'})**

QUALITY STANDARDS:
✓ Test understanding, not just memorization
✓ Clear and unambiguous
✓ One concept per card
✓ All cards in ${isFrench ? 'French' : 'English'}

${isFrench ? `EXAMPLES (French medical content - USE THIS STYLE):
- "L'hypermétropie moyenne du nouveau-né est de {{c1::+2.00 dioptries}}."
- "Le phénomène d'emmétropisation se produit de la naissance jusqu'à {{c1::7-8 ans}}."
- "Les faibles myopies ont tendance à {{c1::s'améliorer ou devenir myopes}}."
- "La cycloplégie élimine l'aspect de {{c1::l'accommodation}}."
- "La rétinoscopie Indra Mohindra nécessite de soustraire {{c1::1.25D}}."` : `EXAMPLES (English medical content):
- "The average hyperopia in newborns is {{c1::+2.00 diopters}}."
- "The emmetropization phenomenon occurs from birth until {{c1::7-8 years}}."
- "Low myopias tend to {{c1::improve or become myopic}}."
- "Cycloplegia eliminates the aspect of {{c1::accommodation}}."
- "Indra Mohindra retinoscopy requires subtracting {{c1::1.25D}}."`}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "cards": [
    {
      "front": "${isFrench ? 'Énoncé avec {{c1::texte caché}}' : 'Statement with {{c1::hidden text}}'}",
      "back": "${isFrench ? 'La réponse cachée' : 'The hidden answer'}",
      "tags": ["topic1", "topic2"],
      "difficulty": "medium"
    }
  ],
  "concepts": ["concept1", "concept2"],
  "medicalTerms": ["term1", "term2"],
  "summary": "${isFrench ? 'Aperçu bref du contenu' : 'Brief overview'}"
}`;
    } else {
      return `Create ${cardCount} high-quality flashcards from this ${isFrench ? 'French' : 'English'} medical/optometry content${chunkInfo}.

${isFrench ? 'IMPORTANT: The source content is in FRENCH. You MUST create all flashcards in FRENCH.' : 'IMPORTANT: The source content is in ENGLISH. You MUST create all flashcards in ENGLISH.'}

CONTENT:
${text.substring(0, 6000)}

QUESTION DESIGN:
1. Test UNDERSTANDING, not recognition
2. Ask "Why?", "How?", "Compare", "Explain", "What happens if?"
3. Be specific and clear
4. One concept per card
5. **USE ${isFrench ? 'FRENCH' : 'ENGLISH'} for ALL questions and answers**

${isFrench ? `GOOD EXAMPLES (French medical - USE THIS STYLE):
✓ "Quelle est l'hypermétropie moyenne du nouveau-né?"
✓ "Comment évolue l'astigmatisme durant la première année?"
✓ "Pourquoi les fortes amétropies restent-elles stables?"
✓ "Quelle est la différence entre hypermétropie latente et manifeste?"
✓ "Quel est le facteur d'ajustement pour la rétinoscopie Indra Mohindra?"
✓ "À quel âge se termine le phénomène d'emmétropisation?"

BAD EXAMPLES:
✗ "What is myopia?" (WRONG LANGUAGE - must be French!)
✗ "Qu'est-ce que c'est?" (too vague)` : `GOOD EXAMPLES (English):
✓ "What causes distant objects to appear blurry in myopia?"
✓ "How does myopia differ from hyperopia?"
✓ "Why does the lens need to change shape?"
✓ "What is the difference between latent and manifest hyperopia?"
✓ "What adjustment factor is used in Mohindra retinoscopy?"
✓ "At what age does emmetropization complete?"

BAD EXAMPLES:
✗ "Quelle est la myopie?" (WRONG LANGUAGE - must be English!)
✗ "What is it?" (too vague)`}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "cards": [
    {
      "front": "${isFrench ? 'Question claire en français' : 'Clear English question'}",
      "back": "${isFrench ? 'Réponse détaillée en français avec contexte' : 'Detailed English answer with context'}",
      "tags": ["topic1", "topic2"],
      "difficulty": "medium"
    }
  ],
  "concepts": ["concept1", "concept2"],
  "medicalTerms": ["term1", "term2"],
  "summary": "${isFrench ? 'Aperçu bref du contenu' : 'Brief overview'}"
}`;
    }
  }

  // --- MODIFIED: Implements Exponential Backoff for 429 errors ---
  private static async callOpenAI(prompt: string, apiKey: string): Promise<string> {
    console.log('Calling OpenAI API...');
    
    // Loop for retries with Exponential Backoff
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
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
                content: 'You are an expert medical educator creating high-quality Anki flashcards for optometry students. You understand both French and English medical terminology perfectly. CRITICAL: You MUST maintain the same language as the source material - if the source is in French, ALL cards must be in French; if English, ALL cards must be in English. You always respond with valid JSON only, with no markdown formatting or code blocks - just pure JSON.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: 4000, 
            response_format: { type: "json_object" }
          })
        });

        // SUCCESS: Request went through
        if (response.ok) {
          const data = await response.json();
          return data.choices[0].message.content;
        }

        // FAILURE: Handle specific error codes
        if (response.status === 401) {
          // 401: Invalid API Key - Fatal error, do not retry
          throw new Error('Invalid API key. Please check your OpenAI API key in Settings.');
        }

        if (response.status === 429) {
          // 429: Rate Limit Exceeded - Check if we have more retries
          if (attempt < this.MAX_RETRIES - 1) {
            // Calculate exponential backoff delay
            const delay = this.INITIAL_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
            console.warn(`Rate limit hit (429). Retrying in ${Math.round(delay / 100) / 10} seconds (Attempt ${attempt + 1}/${this.MAX_RETRIES}).`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Go to the next attempt
          } else {
            // Last attempt failed
            throw new Error('Rate limit exceeded after multiple retries. Please wait and try again later.');
          }
        }

        // Other HTTP errors (5xx, 400, 403, etc.) - Throw a generic error and stop retrying
        const error = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error (${response.status}): ${error.error?.message || response.statusText}`);

      } catch (error) {
        // If the error is a rate limit error but we haven't reached max retries, the 'continue' handles it.
        // For other errors (401, parsing, network), we throw immediately.
        // If it's the last retry and the 429 was thrown, it will fall through here.
        if (error instanceof Error && error.message.includes('Rate limit exceeded') && attempt < this.MAX_RETRIES - 1) {
           // Should be handled by the 'continue' inside the try block, but as a safeguard:
           continue; 
        }
        throw error; // Re-throw any non-recoverable error
      }
    }
    
    // Should be unreachable if MAX_RETRIES > 0, but as a final safety catch:
    throw new Error('Failed to call OpenAI API after all retries.');
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

    // Enhanced patterns for French and English medical content
    const definitionPattern = /^([A-ZÀ-Ö][^:—-]{2,50})[:—-]\s*(.+)$/;
    const bulletPattern = /^[•\-*]\s*(.+)$/;
    const numberedPattern = /^\d+[\.)]\s*(.+)$/;
    const headerPattern = /^([A-ZÀ-Ö][A-ZÀ-Öa-zà-ö\s]{3,50})$/;
    
    let currentSection = 'general';
    let previousLine = '';

    lines.forEach((line, index) => {
      if (line.length < 15 || cards.length >= 40) return;

      // Detect section headers
      const headerMatch = line.match(headerPattern);
      if (headerMatch && line.length < 80 && !line.includes('.')) {
        currentSection = this.extractTag(line);
        return;
      }

      // Pattern 1: Definition-style (Term: Definition)
      const defMatch = line.match(definitionPattern);
      if (defMatch) {
        const [, term, definition] = defMatch;
        const cleanTerm = term.trim();
        const cleanDef = definition.trim();
        
        if (cleanDef.length > 10 && cleanDef.length < 500) {
          if (format === 'cloze') {
            cards.push({
              id: `card-${Date.now()}-${index}`,
              front: `${cleanTerm}: {{c1::${cleanDef}}}`,
              back: cleanDef,
              type: format,
              tags: [currentSection, this.extractTag(cleanTerm)],
              difficulty: 'medium'
            });
          } else {
            // Create better questions
            const question = this.generateQuestion(cleanTerm, cleanDef);
            cards.push({
              id: `card-${Date.now()}-${index}`,
              front: question,
              back: cleanDef,
              type: format,
              tags: [currentSection, this.extractTag(cleanTerm)],
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

      // Pattern 2: Bullet points and numbered lists
      const bulletMatch = line.match(bulletPattern) || line.match(numberedPattern);
      const content = bulletMatch ? bulletMatch[1] : line;
      
      if (content.length > 20 && content.length < 400) {
        // Look for key medical/numerical information
        const hasNumber = /\d+[.,]?\d*\s*(D|dioptries|dioptrie|%|mm|cm|ans|mois|semaines)/i.test(content);
        const hasKeyTerm = /myopie|hypermétropie|astigmatisme|réfraction|accommodation|cycloplégie/i.test(content);
        
        if (hasNumber || hasKeyTerm || content.includes(' est ') || content.includes(' sont ')) {
          if (format === 'cloze') {
            // For cloze, hide the most important part
            let clozeContent = content;
            
            // Hide numbers with units
            clozeContent = clozeContent.replace(
              /(\d+[.,]?\d*\s*(?:D|dioptries?|%|mm|cm|ans?|mois|semaines?))/i,
              '{{c1::$1}}'
            );
            
            // If no number was found, hide key terms
            if (!clozeContent.includes('{{c1::')) {
              const keyTermMatch = content.match(/(myopie|hypermétropie|astigmatisme|réfraction|accommodation|cycloplégie|emmétropisation)/i);
              if (keyTermMatch) {
                clozeContent = content.replace(keyTermMatch[0], `{{c1::${keyTermMatch[0]}}}`);
              }
            }
            
            if (clozeContent.includes('{{c1::')) {
              cards.push({
                id: `card-${Date.now()}-${index}`,
                front: clozeContent,
                back: content.match(/{{c1::(.+?)}}/)?.[1] || content,
                type: format,
                tags: [currentSection, this.extractTag(content)],
                difficulty: hasNumber ? 'hard' : 'medium'
              });
            }
          } else {
            // For basic cards, create a question
            const question = this.generateQuestionFromStatement(content, previousLine);
            if (question) {
              cards.push({
                id: `card-${Date.now()}-${index}`,
                front: question,
                back: content,
                type: format,
                tags: [currentSection, this.extractTag(content)],
                difficulty: hasNumber ? 'medium' : 'easy'
              });
            }
          }
        }
      }
      
      previousLine = line;
    });

    const summary = lines.slice(0, 3).join(' ').substring(0, 250) + '...';
    
    console.log(`Fallback extraction generated ${cards.length} cards`);
    
    return {
      cards: cards.slice(0, 40),
      concepts: Array.from(conceptsSet).slice(0, 20),
      summary,
      medicalTerms: Array.from(medicalTermsSet).slice(0, 15)
    };
  }

  private static generateQuestion(term: string, definition: string): string {
    // French patterns
    if (/^[A-ZÀ-Ö]/.test(term) && (definition.includes('est') || definition.includes('sont'))) {
      return `Qu'est-ce que ${term.toLowerCase()}?`;
    }
    
    // Check for specific question types
    if (definition.match(/\d+/)) {
      return `Quelle est la valeur de ${term.toLowerCase()}?`;
    }
    
    // English patterns
    return `What is ${term}?`;
  }

  private static generateQuestionFromStatement(statement: string, context: string): string | null {
    // Try to convert statement into a question
    
    // Pattern: "X est Y" -> "Qu'est-ce que X?"
    const isMatch = statement.match(/^(.+?)\s+(?:est|sont)\s+(.+)$/i);
    if (isMatch) {
      const subject = isMatch[1].trim();
      if (subject.length < 60) {
        return `Qu'est-ce que ${subject.toLowerCase()}?`;
      }
    }
    
    // Pattern: Contains number -> Ask about the number
    const numberMatch = statement.match(/(\d+[.,]?\d*)\s*(D|dioptries?|%|mm|cm|ans?|mois|semaines?)/i);
    if (numberMatch) {
      // Try to extract what the number refers to
      const before = statement.substring(0, statement.indexOf(numberMatch[0])).trim();
      if (before.length > 5 && before.length < 100) {
        return `Quelle est la valeur de ${before.toLowerCase()}?`;
      }
    }
    
    // Pattern: "Les X ont tendance à Y" -> "Que se passe-t-il avec les X?"
    const tendencyMatch = statement.match(/les?\s+(.+?)\s+(?:ont tendance à|a tendance à)\s+(.+)/i);
    if (tendencyMatch) {
      return `Comment évoluent ${tendencyMatch[1]}?`;
    }
    
    // Default: if statement is short enough, ask to explain it
    if (statement.length < 150 && statement.length > 30) {
      const firstWords = statement.split(' ').slice(0, 5).join(' ');
      return `Expliquez: ${firstWords}...`;
    }
    
    return null;
  }

  private static extractTag(text: string): string {
    const words = text.split(' ');
    const firstWord = words[0].replace(/[^a-zA-ZÀ-ÿ]/g, '');
    
    const commonTerms = ['retina', 'cornea', 'lens', 'vision', 'anatomy', 'physiology', 'myopie', 'hypermétropie', 'astigmatisme', 'réfraction'];
    const lowerText = text.toLowerCase();
    
    for (const term of commonTerms) {
      if (lowerText.includes(term)) {
        return term;
      }
    }
    
    return firstWord.toLowerCase() || 'general';
  }

  private static isMedicalTerm(text: string): boolean {
    const medicalPatterns = /ophthalm|retina|cornea|medical|clinical|diagnosis|treatment|symptom|disease|condition|myopie|hypermétropie|dioptrie/i;
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