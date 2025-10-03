console.log('Anki Flashcard Generator: Background service worker loaded');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    chrome.tabs.create({ url: 'https://chatgpt.com' });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'openChatGPT') {
    chrome.tabs.create({
      url: 'https://chatgpt.com',
      active: true
    }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true;
  }
  
  if (request.action === 'storeFlashcards') {
    chrome.storage.local.set({
      generatedCards: request.cards,
      timestamp: Date.now()
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getFlashcards') {
    chrome.storage.local.get(['generatedCards', 'timestamp'], (result) => {
      sendResponse(result);
    });
    return true;
  }
});