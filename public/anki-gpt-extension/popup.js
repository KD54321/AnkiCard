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
    const formatInstructions = format === 'cloze' 
      ? 'Create cloze deletion cards using {{c1::text}} format for key terms.'
      : 'Create question-answer flashcards with clear, specific questions.';

    return `I need you to create Anki flashcards from my study notes. Return ONLY valid JSON, no other text.

FORMAT: ${format === 'cloze' ? 'Cloze Deletion' : 'Basic Question-Answer'}
${formatInstructions}

QUALITY REQUIREMENTS:
- Test understanding, not memorization
- One concept per card
- Clear and unambiguous
- Include difficulty level (easy/medium/hard)
- Add relevant tags for organization

OUTPUT FORMAT - Return ONLY this JSON structure:
{
  "cards": [
    {
      "front": "${format === 'cloze' ? 'Statement with {{c1::hidden text}}' : 'Clear question'}",
      "back": "${format === 'cloze' ? 'The hidden answer' : 'Detailed answer with context'}",
      "tags": ["topic1", "topic2"],
      "difficulty": "medium"
    }
  ],
  "concepts": ["concept1", "concept2"],
  "medicalTerms": ["term1", "term2"],
  "summary": "Brief overview of content"
}

MY STUDY NOTES:
${text.substring(0, 4000)}

Generate 15-20 high-quality flashcards. Return ONLY valid JSON, no markdown, no explanations.`;
  }
});