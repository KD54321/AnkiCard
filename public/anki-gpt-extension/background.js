// background.js - Service worker for the extension

console.log('Anki Flashcard Generator: Background service worker loaded');

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    // Open welcome page or instructions
    chrome.tabs.create({
      url: 'https://chatgpt.com'
    });
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'openChatGPT') {
    chrome.tabs.create({
      url: 'https://chatgpt.com',
      active: true
    }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'storeFlashcards') {
    // Store generated flashcards
    chrome.storage.local.set({
      generatedCards: request.cards,
      timestamp: Date.now()
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getFlashcards') {
    // Retrieve stored flashcards
    chrome.storage.local.get(['generatedCards', 'timestamp'], (result) => {
      sendResponse(result);
    });
    return true;
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This only fires if no popup is set
  console.log('Extension icon clicked');
});

// Optional: Monitor ChatGPT responses
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.url.includes('conversation')) {
      console.log('ChatGPT conversation detected');
      // Could potentially extract the response here
    }
  },
  { urls: ['https://chatgpt.com/*', 'https://chat.openai.com/*'] }
);