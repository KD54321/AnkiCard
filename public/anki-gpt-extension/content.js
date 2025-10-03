console.log('Anki Flashcard Generator: Content script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillPrompt') {
    fillChatGPTPrompt(request.prompt);
    sendResponse({ success: true });
  }
  return true;
});

// Check for pending generation on load
chrome.storage.local.get(['pendingGeneration', 'promptToSend'], (result) => {
  if (result.pendingGeneration && result.promptToSend) {
    console.log('Found pending generation, will inject prompt');
    
    const waitAndFill = () => {
      setTimeout(() => {
        fillChatGPTPrompt(result.promptToSend);
        chrome.storage.local.remove(['pendingGeneration']);
      }, 1500);
    };
    
    if (document.readyState === 'complete') {
      waitAndFill();
    } else {
      window.addEventListener('load', waitAndFill);
    }
  }
});

function fillChatGPTPrompt(prompt) {
  console.log('Attempting to fill ChatGPT prompt...');
  
  // Updated selectors for ChatGPT (2024-2025)
  const selectors = [
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    'textarea[data-id="root"]',
    '[contenteditable="true"][data-id]',
    'div[contenteditable="true"]',
    'textarea'
  ];

  let inputElement = null;
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      // Check if element is visible
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        inputElement = el;
        console.log(`Found input using selector: ${selector}`);
        break;
      }
    }
    if (inputElement) break;
  }

  if (!inputElement) {
    console.error('Could not find ChatGPT input field');
    copyToClipboard(prompt);
    showNotification('📋 Prompt copied to clipboard! Paste manually (Ctrl+V)', 'warning');
    return;
  }

  try {
    inputElement.focus();
    
    // Handle contenteditable divs
    if (inputElement.isContentEditable) {
      inputElement.textContent = '';
      
      // Insert text properly
      const textNode = document.createTextNode(prompt);
      inputElement.appendChild(textNode);
      
      // Trigger events
      inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(inputElement);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } 
    // Handle textareas
    else {
      inputElement.value = prompt;
      inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Set cursor to end
      inputElement.selectionStart = prompt.length;
      inputElement.selectionEnd = prompt.length;
    }

    console.log('Prompt filled successfully');
    showNotification('✅ Prompt filled! Review and press Enter to send', 'success');

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
  const existing = document.getElementById('anki-notification');
  if (existing) existing.remove();

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
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 999999;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    font-weight: 500;
    max-width: 350px;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;

  if (!document.getElementById('anki-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'anki-notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        to { transform: translateX(400px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}