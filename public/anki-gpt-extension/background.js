// Fixed background.js with proper message handlers

// Listen for messages from webapp
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('External message received:', request);

  // Handle extension ID request
  if (request.action === 'getExtensionId') {
    sendResponse({ extensionId: chrome.runtime.id });
    return true;
  }

  // Handle flashcard generation request
  if (request.action === 'generateFlashcards') {
    handleGenerateFromWebapp(request, sendResponse);
    return true; // Keep channel open for async response
  }

  // Handle request for latest response
  if (request.action === 'getLatestResponse') {
    console.log('📥 Webapp requesting latest response...');
    
    chrome.storage.local.get(['latestResponse', 'responseReady', 'timestamp'], (result) => {
      console.log('Storage contents:', {
        hasResponse: !!result.latestResponse,
        isReady: result.responseReady,
        timestamp: result.timestamp,
        dataPreview: result.latestResponse ? result.latestResponse.substring(0, 100) : 'none'
      });
      
      if (result.responseReady && result.latestResponse) {
        console.log('✅ Sending response back to webapp');
        sendResponse({ 
          success: true, 
          latestResponse: result.latestResponse,
          timestamp: result.timestamp
        });
        
        // Clear the ready flag but keep data for potential retry
        chrome.storage.local.set({ responseReady: false });
      } else {
        console.log('⏳ No response ready yet, webapp should continue polling');
        sendResponse({ 
          success: false, 
          waiting: true,
          message: 'Response not ready yet'
        });
      }
    });
    return true;
  }

  return false;
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'responseExtracted') {
    console.log('✅ Response extracted from ChatGPT!');
    console.log('Data received:', request.data);
    
    // Store the response - make sure it's a string
    const dataToStore = typeof request.data === 'string' 
      ? request.data 
      : JSON.stringify(request.data);
    
    chrome.storage.local.set({
      latestResponse: dataToStore,
      responseReady: true,
      timestamp: Date.now(),
      waitingForResponse: false
    }, () => {
      console.log('✅ Response stored in chrome.storage.local');
      console.log('Stored data preview:', dataToStore.substring(0, 100));
    });
    
    sendResponse({ success: true });
  }
  return true;
});

async function handleGenerateFromWebapp(request, sendResponse) {
  try {
    const { text, format } = request;
    
    console.log('Starting automated generation...');
    
    // Clear any old data
    await chrome.storage.local.remove(['latestResponse', 'responseReady']);
    
    // Store with auto-submit flag
    await chrome.storage.local.set({
      pendingGeneration: true,
      promptToSend: buildPrompt(text, format),
      cardFormat: format,
      waitingForResponse: true,
      autoSubmit: true
    });
    
    // Find or create ChatGPT tab
    const tabs = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
    
    let chatGPTTab;
    
    if (tabs.length > 0) {
      chatGPTTab = tabs[0];
      await chrome.tabs.update(chatGPTTab.id, { active: true });
      console.log('Using existing ChatGPT tab');
    } else {
      chatGPTTab = await chrome.tabs.create({ 
        url: 'https://chatgpt.com',
        active: true
      });
      console.log('Created new ChatGPT tab');
    }
    
    // Wait for tab to be ready and auto-submit
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(chatGPTTab.id, {
          action: 'fillPromptAndSubmit',
          prompt: buildPrompt(text, format)
        });
        
        sendResponse({ 
          success: true, 
          message: 'Prompt sent to ChatGPT! Waiting for response...',
          tabId: chatGPTTab.id
        });
      } catch (error) {
        console.error('Error sending to content script:', error);
        sendResponse({ 
          success: false, 
          error: 'Failed to communicate with ChatGPT tab. Please refresh the ChatGPT page and try again.' 
        });
      }
    }, 2500);
    
  } catch (error) {
    console.error('Error in handleGenerateFromWebapp:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function buildPrompt(text, format) {
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