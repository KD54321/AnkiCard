import express from "express";
import OpenAI from "openai";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // safely read from .env
});

app.post("/api/flashcards", async (req, res) => {
  const { text } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an AI generating Anki flashcards. Return strictly JSON..."
        },
        { role: "user", content: text },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    res.json({ result: response.choices[0].message?.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI service error" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
