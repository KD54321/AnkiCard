async function handleGenerateFromWebapp(request, sendResponse) {
  try {
    const { text, format } = request;
    
    console.log('Starting automated generation...');
    
    // Store with auto-submit flag
    await chrome.storage.local.set({
      pendingGeneration: true,
      promptToSend: text,
      cardFormat: format,
      waitingForResponse: true,
      autoSubmit: true // NEW: Enable auto-submit
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
          action: 'fillPromptAndSubmit', // Changed from 'fillPromptAndWait'
          prompt: buildPrompt(text, format)
        });
        
        sendResponse({ 
          success: true, 
          message: 'Prompt sent and submitted automatically! Waiting for response...',
          tabId: chatGPTTab.id
        });
      } catch (error) {
        console.error('Error sending to content script:', error);
        sendResponse({ 
          success: false, 
          error: 'Failed to communicate with ChatGPT tab' 
        });
      }
    }, 2500); // Increased wait time for page load
    
  } catch (error) {
    console.error('Error in handleGenerateFromWebapp:', error);
    sendResponse({ success: false, error: error.message });
  }
}