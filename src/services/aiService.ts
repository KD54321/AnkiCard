import OpenAI from "openai";

// Default client using .env key
let client: OpenAI = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

// Optional user override
let overrideKey: string | null = null;

export const AIService = {
  // Set user override key
  setApiKey(key: string | null) {
    overrideKey = key;
    if (key) {
      client = new OpenAI({ apiKey: key });
    } else {
      // Revert to default .env key
      client = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY });
    }
  },

  async generateFlashcards(text: string): Promise<any> {
    if (!client) {
      return { error: "API key not set. Please configure in settings or .env" };
    }

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are an AI that generates high-quality Anki flashcards from study material. 
Return your response STRICTLY as valid JSON. Do not include explanations outside JSON. 

The JSON format must be:

{
  "cards": [
    {"front": "...", "back": "...", "tags": ["..."], "difficulty": "easy|medium|hard"}
  ],
  "concepts": ["..."],
  "medicalTerms": ["..."],
  "summary": "..."
}
`
          },
          {
            role: "user",
            content: `Create Anki flashcards from the following study material:\n\n${text}`
          },
        ],
        max_tokens: 800,
        temperature: 0.7,
      });

      const raw = response.choices[0].message?.content ?? "{}";

      try {
        return JSON.parse(raw);
      } catch {
        console.error("Invalid JSON from OpenAI:", raw);
        return { error: "Invalid JSON response", raw };
      }
    } catch (error) {
      console.error("Error in generateFlashcards:", error);
      return { error: "AI service error" };
    }
  }
};
