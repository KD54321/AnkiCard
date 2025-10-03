# AnkiCard Generator

AnkiCard Generator is a tool that helps you convert study notes into Anki flashcards.
It supports parsing text, extracting key concepts, and exporting structured cards in Anki-compatible format.

## Features

🔹 Convert notes into Q/A flashcards automatically

🔹 Export to JSON or send directly to AnkiConnect

🔹 Add tags, images, and difficulty levels

🔹 Designed for students & professionals preparing for exams

## Prereq
You will need to have *Anki Desktop* with *AnkiConnect* Add-on installed on your machine.
## Installation
git clone https://github.com/KD54321/AnkiCard.git

### Install dependencies
npm install

### Build the project
npm run build

## Project Structure
ankicard-generator/     
│── anki-extension/     # Chrome Extension that opens Open AI for better question generation
│── src/
│   ├── components/     # Core components (CardFormat, ContentPreview, PDFUploader)
│   ├── services/       # Core services (aiService, ankiService, extensionService, parserService)
│   ├── ui.ts           # UI Components
│── package.json
│── README.md
