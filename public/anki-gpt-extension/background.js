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