// popup.js - Extension popup logic

document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('textInput');
  const cardFormat = document.getElementById('cardFormat');
  const generateBtn = document.getElementById('generateBtn');
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

  // Update character count
  textInput.addEventListener('input', () => {
    updateCharCount();
    // Auto-save
    chrome.storage.local.set({ pdfText: textInput.value });
  });

  cardFormat.addEventListener('change', () => {
    chrome.storage.local.set({ cardFormat: cardFormat.value });
  });

  function updateCharCount() {
    const count = textInput.value.length;
    charCount.textContent = `${count} characters`;
  }

  function updateStatus(icon, text, type = 'info') {
    statusDiv.className = `status status-${type}`;
    statusDiv.innerHTML = `
      <div class="status-icon">${icon}</div>
      <div class="status-text">${text}</div>
    `;
  }

  // Generate flashcards
  generateBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    
    if (!text) {
      updateStatus('⚠️', 'Please enter some text first', 'warning');
      return;
    }

    const format = cardFormat.value;
    
    // Generate the prompt
    const prompt = generatePrompt(text, format);
    
    // Save to storage for content script
    await chrome.storage.local.set({ 
      promptToSend: prompt,
      pendingGeneration: true
    });

    updateStatus('✨', 'Opening ChatGPT...', 'success');

    // Open ChatGPT
    chrome.tabs.create({ 
      url: 'https://chatgpt.com',
      active: true
    }, (tab) => {
      // Wait a bit for the page to load, then inject
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'fillPrompt',
          prompt: prompt
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Tab not ready yet, will inject on load');
          } else if (response && response.success) {
            updateStatus('✅', 'Prompt injected! Wait for response...', 'success');
          }
        });
      }, 2000);
    });
  });

  // Clear button
  clearBtn.addEventListener('click', () => {
    textInput.value = '';
    updateCharCount();
    chrome.storage.local.remove(['pdfText', 'promptToSend', 'pendingGeneration']);
    updateStatus('ℹ️', 'Cleared! Ready for new text', 'info');
  });

  function generatePrompt(text, format) {
    const formatInstructions = format === 'cloze' 
      ? 'Create cloze deletion cards using {{c1::text}} format for key terms.'
      : 'Create question-answer flashcards with clear, specific questions that test understanding.';

    return `I need you to create Anki flashcards from my study notes. Please follow these instructions exactly:

FORMAT: ${format === 'cloze' ? 'Cloze Deletion' : 'Basic Question-Answer'}
${formatInstructions}

QUALITY REQUIREMENTS:
- Test understanding, not just memorization
- Ask "Why?", "How?", "Compare", "Explain" (for basic cards)
- One concept per card
- Clear and unambiguous
- Include difficulty level (easy/medium/hard)
- Add relevant tags for organization

OUTPUT FORMAT - Return ONLY valid JSON, no other text:
{
  "cards": [
    {
      "front": "Question or cloze statement",
      "back": "Answer with context",
      "tags": ["topic1", "topic2"],
      "difficulty": "medium"
    }
  ],
  "concepts": ["concept1", "concept2"],
  "medicalTerms": ["term1", "term2"],
  "summary": "Brief overview of content"
}

MY STUDY NOTES:
${text}

Please generate 15-20 high-quality flashcards now. Return ONLY the JSON, nothing else.`;
  }
});