// src/services/ankiService.ts
export interface FlashCard {
  front: string;
  back: string;
  tags?: string[];
  imageData?: string; // Base64 image string
  imageName?: string; // optional name for image file
}

export class AnkiService {
  private static readonly ANKI_CONNECT_URL = 'http://127.0.0.1:8765';

  // Helper to call AnkiConnect
  private static async invoke(action: string, params: any = {}) {
    console.log(`AnkiConnect: calling ${action}`, params);
    
    const response = await fetch(this.ANKI_CONNECT_URL, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action, 
        version: 6, 
        params 
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`AnkiConnect: ${action} response`, data);
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.result;
  }

  // Test connection to AnkiConnect
  static async testConnection(): Promise<boolean> {
    try {
      const version = await this.invoke("version");
      console.log('AnkiConnect version:', version);
      return true;
    } catch (error) {
      console.error('AnkiConnect connection failed:', error);
      return false;
    }
  }

  // Create deck if it doesn't exist
  static async createDeck(deckName: string) {
    try {
      // Check if deck already exists
      const deckNames = await this.invoke("deckNames");
      if (deckNames.includes(deckName)) {
        console.log(`Deck "${deckName}" already exists`);
        return deckName;
      }
      
      // Create new deck
      const result = await this.invoke("createDeck", { deck: deckName });
      console.log(`Created deck "${deckName}"`);
      return result;
    } catch (error) {
      console.error('Error creating deck:', error);
      throw error;
    }
  }

  // Push notes (flashcards) to Anki
  static async addNotes(
    deckName: string,
    flashcards: FlashCard[],
    format: "basic" | "cloze"
  ) {
    if (!flashcards || flashcards.length === 0) {
      throw new Error('No flashcards to add');
    }

    console.log(`Preparing to add ${flashcards.length} cards to deck "${deckName}" as ${format} cards`);
    console.log('Sample card:', flashcards[0]); // Debug log

    // First, get info about the deck
    try {
      const deckNames = await this.invoke("deckNames");
      console.log('Available decks:', deckNames);
      
      if (!deckNames.includes(deckName)) {
        console.log(`Deck "${deckName}" not found, creating it...`);
        await this.createDeck(deckName);
      }
    } catch (e) {
      console.warn('Could not verify deck:', e);
    }

    const notes = flashcards.map((card, index) => {
      // Add timestamp to make cards unique if needed
      const timestamp = Date.now();
      
      // For Basic cards
      if (format === "basic") {
        const note: any = {
          deckName: deckName,
          modelName: "Basic",
          fields: {
            Front: String(card.front || `Card ${index + 1} front`),
            Back: String(card.back || `Card ${index + 1} back`)
          },
          options: {
            allowDuplicate: true, // Allow duplicates for now to debug
            duplicateScope: "deck",
            duplicateScopeOptions: {
              deckName: deckName,
              checkChildren: false
            }
          },
          tags: Array.isArray(card.tags) && card.tags.length > 0 
            ? [...card.tags, "pdf-import"] 
            : ["pdf-import", `import-${timestamp}`]
        };

        console.log(`Card ${index + 1}:`, {
          deck: deckName,
          frontLength: note.fields.Front.length,
          backLength: note.fields.Back.length,
          front: note.fields.Front.substring(0, 100),
          back: note.fields.Back.substring(0, 100)
        });

        return note;
      } 
      // For Cloze cards
      else {
        return {
          deckName: deckName,
          modelName: "Cloze",
          fields: {
            Text: String(card.front),
            "Back Extra": String(card.back || "")
          },
          options: {
            allowDuplicate: true,
            duplicateScope: "deck"
          },
          tags: Array.isArray(card.tags) && card.tags.length > 0 
            ? [...card.tags, "pdf-import"] 
            : ["pdf-import", `import-${timestamp}`]
        };
      }
    });

    try {
      console.log('Sending notes to AnkiConnect...');
      console.log('Target deck:', deckName);
      console.log('Number of notes:', notes.length);
      console.log('First note structure:', JSON.stringify(notes[0], null, 2));
      
      const result = await this.invoke("addNotes", { notes });
      console.log('AnkiConnect addNotes raw result:', result);
      
      // Check for any null values (failed cards)
      if (Array.isArray(result)) {
        const failedIndices: number[] = [];
        const successIds: number[] = [];
        
        result.forEach((id: any, index: number) => {
          if (id === null) {
            failedIndices.push(index);
            console.error(`Card ${index + 1} FAILED:`, {
              front: flashcards[index].front.substring(0, 100),
              back: flashcards[index].back.substring(0, 100)
            });
          } else {
            successIds.push(id);
          }
        });
        
        const failedCount = failedIndices.length;
        const successCount = successIds.length;
        
        console.log(`Results: ${successCount} succeeded, ${failedCount} failed`);
        
        if (successCount > 0) {
          console.log(`✓ Successfully added ${successCount} cards with IDs:`, successIds);
        }
        
        if (failedCount > 0) {
          console.warn(`✗ ${failedCount} cards failed at indices:`, failedIndices);
        }
        
        if (successCount === 0) {
          throw new Error(`All ${flashcards.length} cards failed to add. Check the console for details about which cards failed.`);
        }
        
        return {
          success: successCount,
          failed: failedCount,
          ids: successIds
        };
      } else {
        throw new Error('Unexpected response format from AnkiConnect');
      }
    } catch (error) {
      console.error('Error adding notes to Anki:', error);
      
      // Check if it's a duplicate error
      if (error instanceof Error && error.message.includes('duplicate')) {
        // Try to find which cards exist
        console.log('Duplicate error detected. Checking existing cards...');
        throw new Error('Some cards already exist in Anki. Try changing the deck name or check your Anki collection.');
      }
      
      throw error;
    }
  }

  // Get list of deck names
  static async getDeckNames(): Promise<string[]> {
    return await this.invoke("deckNames");
  }

  // Check if Anki is running
  static async isAnkiRunning(): Promise<boolean> {
    try {
      await this.invoke("version");
      return true;
    } catch {
      return false;
    }
  }
}