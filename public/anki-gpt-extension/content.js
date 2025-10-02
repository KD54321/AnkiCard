// content.js - Runs on ChatGPT pages

console.log('Anki Flashcard Generator: Content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillPrompt') {
    fillChatGPTPrompt(request.prompt);
    sendResponse({ success: true });
  }
  return true;
});

// Check if there's a pending generation on page load
chrome.storage.local.get(['pendingGeneration', 'promptToSend'], (result) => {
  if (result.pendingGeneration && result.promptToSend) {
    console.log('Found pending generation, will inject prompt');
    // Wait for page to be fully loaded
    if (document.readyState === 'complete') {
      setTimeout(() => fillChatGPTPrompt(result.promptToSend), 1000);
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => fillChatGPTPrompt(result.promptToSend), 1000);
      });
    }
    // Clear the pending flag
    chrome.storage.local.remove(['pendingGeneration']);
  }
});

function fillChatGPTPrompt(prompt) {
  console.log('Attempting to fill ChatGPT prompt...');
  
  // Try multiple selectors as ChatGPT's UI may change
  const selectors = [
    'textarea[placeholder*="Message"]',
    'textarea[data-id="root"]',
    'textarea#prompt-textarea',
    'textarea',
    '[contenteditable="true"]'
  ];

  let textArea = null;
  
  for (const selector of selectors) {
    textArea = document.querySelector(selector);
    if (textArea) {
      console.log(`Found input using selector: ${selector}`);
      break;
    }
  }

  if (!textArea) {
    console.error('Could not find ChatGPT input field');
    showNotification('⚠️ Could not find ChatGPT input. Please paste manually.', 'warning');
    // Copy to clipboard as fallback
    copyToClipboard(prompt);
    showNotification('📋 Prompt copied to clipboard! Paste it manually (Ctrl+V)', 'info');
    return;
  }

  try {
    // Focus the textarea
    textArea.focus();
    
    // Set the value
    textArea.value = prompt;
    
    // Trigger input events to make ChatGPT recognize the change
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
    textArea.dispatchEvent(new Event('change', { bubbles: true }));
    
    // For contenteditable elements
    if (textArea.isContentEditable) {
      textArea.textContent = prompt;
      textArea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    console.log('Prompt filled successfully');
    showNotification('✅ Prompt filled! Press Enter or click Send', 'success');

    // Optional: Auto-submit (commented out for safety)
    // setTimeout(() => {
    //   const sendButton = document.querySelector('[data-testid="send-button"]') || 
    //                      document.querySelector('button[aria-label*="Send"]');
    //   if (sendButton) sendButton.click();
    // }, 500);

  } catch (error) {
    console.error('Error filling prompt:', error);
    copyToClipboard(prompt);
    showNotification('📋 Error auto-filling. Copied to clipboard instead!', 'warning');
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    console.log('Prompt copied to clipboard');
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

function showNotification(message, type = 'info') {
  // Remove existing notification
  const existing = document.getElementById('anki-notification');
  if (existing) existing.remove();

  // Create notification
  const notification = document.createElement('div');
  notification.id = 'anki-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    max-width: 350px;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Add CSS for fade out
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
  @keyframes slideOut {
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(fadeOutStyle);