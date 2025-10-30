document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('textInput');
  const cardFormat = document.getElementById('cardFormat');
  const generateBtn = document.getElementById('generateBtn');
  const copyBtn = document.getElementById('copyBtn');
  const clearBtn = document.getElementById('clearBtn');
  const charCount = document.getElementById('charCount');
  const statusDiv = document.getElementById('status');

  // Load saved data
  chrome.storage.local.get(['pdfText', 'cardFormat'], (result) => {
    if (result.pdfText) {
      textInput.value = result.pdfText;
      updateCharCount();
    }
    if (result.cardFormat) {
      cardFormat.value = result.cardFormat;
    }
  });

  textInput.addEventListener('input', () => {
    updateCharCount();
    chrome.storage.local.set({ pdfText: textInput.value });
  });

  cardFormat.addEventListener('change', () => {
    chrome.storage.local.set({ cardFormat: cardFormat.value });
  });

  function updateCharCount() {
    const count = textInput.value.length;
    charCount.textContent = `${count.toLocaleString()} characters`;
  }

  function updateStatus(icon, text, type = 'info') {
    statusDiv.className = `status status-${type}`;
    statusDiv.innerHTML = `
      <div class="status-icon">${icon}</div>
      <div class="status-text">${text}</div>
    `;
  }

  // Copy prompt only
  copyBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text) {
      updateStatus('⚠️', 'Please enter some text first', 'warning');
      return;
    }

    const prompt = generatePrompt(text, cardFormat.value);
    navigator.clipboard.writeText(prompt).then(() => {
      updateStatus('✅', 'Prompt copied! Open ChatGPT and paste it', 'success');
    });
  });

  // Generate in ChatGPT
  generateBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    
    if (!text) {
      updateStatus('⚠️', 'Please enter some text first', 'warning');
      return;
    }

    const format = cardFormat.value;
    const prompt = generatePrompt(text, format);
    
    await chrome.storage.local.set({ 
      promptToSend: prompt,
      pendingGeneration: true
    });

    updateStatus('✨', 'Opening ChatGPT...', 'info');

    chrome.tabs.create({ 
      url: 'https://chatgpt.com',
      active: true
    }, (tab) => {
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'fillPrompt',
          prompt: prompt
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Tab not ready, will inject on load');
          }
        });
      }, 2500);
    });
  });

  clearBtn.addEventListener('click', () => {
    textInput.value = '';
    updateCharCount();
    chrome.storage.local.remove(['pdfText', 'promptToSend', 'pendingGeneration']);
    updateStatus('ℹ️', 'Cleared! Ready for new text', 'info');
  });

  function generatePrompt(text, format) {
    // Detect if content is primarily French
    const isFrench = /[àâäæçéèêëïîôùûüÿœ]/i.test(text) || 
                     /\b(le|la|les|un|une|des|est|sont|phénomène|réfraction|émétropisation|myopie|hypermétropie)\b/i.test(text);
    
    const language = isFrench ? 'FRENCH' : 'ENGLISH';
    const languageInstruction = isFrench 
      ? 'INSTRUCTION CRITIQUE: Vous DEVEZ écrire TOUTES les cartes en FRANÇAIS. Chaque question, chaque réponse, chaque mot doit être en FRANÇAIS.'
      : 'CRITICAL INSTRUCTION: You MUST write ALL flashcards in ENGLISH. Every question, every answer, every word must be in ENGLISH.';

    return `You are creating Anki flashcards from medical/optometry study notes.

**DETECTED LANGUAGE: ${language}**
${languageInstruction}

FORMAT: ${format === 'cloze' ? 'Cloze Deletion (Fill-in-the-blank)' : 'Question-Answer'}

${format === 'cloze' ? `CLOZE RULES:
- Use {{c1::hidden text}} to mark what should be hidden
- Hide KEY concepts, numbers, definitions - not trivial words
- Include enough context for the card to make sense
- One concept per card` : `QUESTION-ANSWER RULES:
- Write clear, specific questions that test understanding
- Provide detailed answers with context
- Ask "Why?", "How?", "Compare", "Explain" questions
- Avoid yes/no questions
- One concept per card`}

CARD REQUIREMENTS:
- Test understanding, not just memorization
- Include difficulty level: easy, medium, or hard
- Add 2-3 relevant tags per card
- Be clear and unambiguous

${isFrench ? `**EXEMPLES EN FRANÇAIS** (UTILISEZ EXACTEMENT CE STYLE):
${format === 'cloze' ? `✓ "L'hypermétropie moyenne du nouveau-né est de {{c1::+2.00 dioptries}}."
✓ "Le phénomène d'emmétropisation se produit de la naissance jusqu'à {{c1::7-8 ans}}."
✓ "La cycloplégie élimine l'aspect de {{c1::l'accommodation}}."
✓ "La rétinoscopie Indra Mohindra nécessite de soustraire {{c1::1.25D}} de la sphère."
✓ "Les fortes amétropies ont tendance à {{c1::rester stable ou s'accroître}}."

✗ MAUVAIS: "The average hyperopia is {{c1::+2.00D}}." (ANGLAIS - INTERDIT!)` : `✓ "Quelle est l'hypermétropie moyenne du nouveau-né?"
✓ "À quel âge se termine le phénomène d'emmétropisation?"
✓ "Quel est l'effet de la cycloplégie sur l'accommodation?"
✓ "Quel facteur doit être soustrait en rétinoscopie Indra Mohindra?"
✓ "Comment évoluent les fortes amétropies avec l'âge?"

✗ MAUVAIS: "What is the average hyperopia in newborns?" (ANGLAIS - INTERDIT!)`}` : `**EXAMPLES IN ENGLISH** (USE EXACTLY THIS STYLE):
${format === 'cloze' ? `✓ "The average hyperopia in newborns is {{c1::+2.00 diopters}}."
✓ "The emmetropization phenomenon occurs from birth until {{c1::7-8 years}}."
✓ "Cycloplegia eliminates the aspect of {{c1::accommodation}}."
✓ "Indra Mohindra retinoscopy requires subtracting {{c1::1.25D}} from the sphere."
✓ "High ametropias tend to {{c1::remain stable or increase}}."

✗ BAD: "L'hypermétropie moyenne est {{c1::+2.00D}}." (FRENCH - FORBIDDEN!)` : `✓ "What is the average hyperopia in newborns?"
✓ "At what age does the emmetropization phenomenon end?"
✓ "What is the effect of cycloplegia on accommodation?"
✓ "What factor must be subtracted in Indra Mohindra retinoscopy?"
✓ "How do high ametropias progress with age?"

✗ BAD: "Quelle est l'hypermétropie moyenne?" (FRENCH - FORBIDDEN!)`}`}

**YOUR STUDY NOTES:**
${text.substring(0, 8000)}

**RESPONSE FORMAT** - Return ONLY plain JSON (NO markdown, NO code blocks, NO backticks, NO explanations):

{
  "cards": [
    {
      "front": "${format === 'cloze' ? (isFrench ? 'Phrase avec {{c1::texte caché}}' : 'Statement with {{c1::hidden text}}') : (isFrench ? 'Question claire en français' : 'Clear question in English')}",
      "back": "${isFrench ? 'Réponse détaillée en français' : 'Detailed answer in English'}",
      "tags": ["topic1", "topic2"],
      "difficulty": "medium"
    }
  ],
  "concepts": ["concept1", "concept2"],
  "medicalTerms": ["term1", "term2"],
  "summary": "${isFrench ? 'Résumé du contenu' : 'Summary of content'}"
}

**TASK:** Generate 30-50 high-quality flashcards in ${language}. Return ONLY the JSON object above - start your response with { and end with }`;
  }
});