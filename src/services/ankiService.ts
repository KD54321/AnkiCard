// services/ankiService.ts
export interface FlashCard {
  front: string;
  back: string;
  imageData?: string; // Base64 image string
  imageName?: string; // optional name for image file

}

export class AnkiService {
  // Helper to call AnkiConnect
  private static async invoke(action: string, params: any = {}) {
    const response = await fetch("http://127.0.0.1:8765", {
      method: "POST",
      body: JSON.stringify({ action, version: 6, params }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  }

  // Create deck if it doesn’t exist
  static async createDeck(deckName: string) {
    return this.invoke("createDeck", { deck: deckName });
  }

  // Push notes (flashcards) to Anki
  static async addNotes(
    deckName: string,
    flashcards: FlashCard[],
    format: "basic" | "cloze"
  ) {
    const modelName = format === "cloze" ? "Cloze" : "Basic";

 const notes = flashcards.map((card) => {
      const fields: Record<string, string> = {
        Front: card.front,
        Back: card.back,
      };

      // If there is an image, add a placeholder to the back
      const fldsWithImage = { ...fields };
      if (card.imageData && card.imageName) {
        fldsWithImage.Back += `<br><img src="${card.imageName}" />`;
      }

      return {
        deckName,
        modelName,
        fields: fldsWithImage,
        options: { allowDuplicate: false },
        tags: ["Notes", "pdf-import"],
        audio: [],
        picture: card.imageData
          ? [
              {
                data: card.imageData,
                filename: card.imageName,
                fields: ["Back"], // attach to back field
              },
            ]
          : [],
      };
    });

    return this.invoke("addNotes", { notes });
  }
}