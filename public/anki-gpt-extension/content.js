console.log('Anki Flashcard Generator: Content script loaded');

let isWaitingForResponse = false;
let responseCheckInterval = null;
let lastMessageCount = 0;

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillPrompt') {
    fillChatGPTPrompt(request.prompt, false);
    sendResponse({ success: true });
  }
  
  if (request.action === 'fillPromptAndSubmit') {
    fillChatGPTPrompt(request.prompt, true);
    sendResponse({ success: true });
  }
  
  if (request.action === 'extractResponse') {
    const response = extractChatGPTResponse();
    sendResponse(response);
  }
  
  return true;
});

// Check for pending generation on load
chrome.storage.local.get(['pendingGeneration', 'promptToSend', 'autoSubmit'], (result) => {
  if (result.pendingGeneration && result.promptToSend) {
    console.log('Found pending generation');
    
    const waitAndFill = () => {
      setTimeout(() => {
        fillChatGPTPrompt(result.promptToSend, result.autoSubmit || false);
        chrome.storage.local.remove(['pendingGeneration']);
      }, 2000);
    };
    
    if (document.readyState === 'complete') {
      waitAndFill();
    } else {
      window.addEventListener('load', waitAndFill);
    }
  }
});

function fillChatGPTPrompt(prompt, autoSubmit = false) {
  console.log('Filling ChatGPT prompt... Auto-submit:', autoSubmit);
  
  const selectors = [
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    'textarea[data-id="root"]',
    '[contenteditable="true"][data-id]',
    'div[contenteditable="true"]'
  ];

  let inputElement = null;
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        inputElement = el;
        console.log(`Found input: ${selector}`);
        break;
      }
    }
    if (inputElement) break;
  }

  if (!inputElement) {
    console.error('Could not find ChatGPT input');
    copyToClipboard(prompt);
    showNotification('📋 Prompt copied! Paste manually', 'warning');
    return;
  }

  try {
    inputElement.focus();
    
    // Fill the input
    if (inputElement.isContentEditable) {
      inputElement.textContent = '';
      const textNode = document.createTextNode(prompt);
      inputElement.appendChild(textNode);
      
      // Trigger input events
      inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(inputElement);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      inputElement.value = prompt;
      inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      inputElement.selectionStart = prompt.length;
      inputElement.selectionEnd = prompt.length;
    }

    console.log('Prompt filled successfully');

    if (autoSubmit) {
      // Wait a bit for ChatGPT to process the input
      setTimeout(() => {
        submitPrompt(inputElement);
      }, 500);
    } else {
      showNotification('✅ Prompt filled! Press Enter to send', 'success');
    }

  } catch (error) {
    console.error('Error filling prompt:', error);
    copyToClipboard(prompt);
    showNotification('📋 Error - Copied to clipboard', 'warning');
  }
}

function submitPrompt(inputElement) {
  console.log('Attempting to submit prompt...');
  
  try {
    // Method 1: Find and click the send button
    const sendButtonSelectors = [
      'button[data-testid="send-button"]',
      'button[data-testid="fruitjuice-send-button"]',
      'button svg[class*="icon"]', // SVG icon in button
      'button[aria-label*="Send"]',
      'button[type="submit"]',
      'form button[class*="absolute"]' // Often the send button has absolute positioning
    ];

    let sendButton = null;
    
    for (const selector of sendButtonSelectors) {
      const buttons = document.querySelectorAll(selector);
      for (const btn of buttons) {
        // Check if button is visible and in the input area
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Check if it's near the input (likely the send button)
          const inputRect = inputElement.getBoundingClientRect();
          if (Math.abs(rect.top - inputRect.top) < 100) {
            sendButton = btn;
            console.log(`Found send button: ${selector}`);
            break;
          }
        }
      }
      if (sendButton) break;
    }

    if (sendButton && !sendButton.disabled) {
      console.log('Clicking send button...');
      sendButton.click();
      showNotification('🚀 Sending to ChatGPT...', 'info');
      
      // Start monitoring for response
      setTimeout(() => {
        startResponseMonitoring();
      }, 1000);
      return;
    }

    // Method 2: Simulate Enter key press
    console.log('Send button not found, trying Enter key...');
    
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    
    inputElement.dispatchEvent(enterEvent);
    showNotification('🚀 Sending to ChatGPT...', 'info');
    
    // Start monitoring
    setTimeout(() => {
      startResponseMonitoring();
    }, 1000);

  } catch (error) {
    console.error('Error submitting prompt:', error);
    showNotification('⚠️ Auto-submit failed. Press Enter manually', 'warning');
    
    // Still start monitoring in case user submits manually
    setTimeout(() => {
      startResponseMonitoring();
    }, 2000);
  }
}

function startResponseMonitoring() {
  console.log('Starting response monitoring...');
  showNotification('⏳ Waiting for ChatGPT response...', 'info');
  
  // Count current messages to detect new ones
  const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
  lastMessageCount = messages.length;
  
  let attemptCount = 0;
  const maxAttempts = 120; // 2 minutes timeout
  
  isWaitingForResponse = true;
  
  responseCheckInterval = setInterval(() => {
    attemptCount++;
    
    if (attemptCount > maxAttempts) {
      console.log('Response monitoring timeout');
      clearInterval(responseCheckInterval);
      isWaitingForResponse = false;
      showNotification('⏱️ Timeout - Please try again', 'warning');
      chrome.storage.local.set({ waitingForResponse: false });
      return;
    }
    
    // Check if a new message appeared
    const currentMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
    
    if (currentMessages.length > lastMessageCount) {
      console.log('New response detected!');
      
      // Wait a bit for the response to fully render
      setTimeout(() => {
        const response = extractChatGPTResponse();
        
        if (response.success && response.json) {
          console.log('Valid JSON response found!');
          clearInterval(responseCheckInterval);
          isWaitingForResponse = false;
          
          // Send to background
          chrome.runtime.sendMessage({
            action: 'responseExtracted',
            data: response.json
          });
          
          // Store for webapp
          chrome.storage.local.set({
            latestResponse: response.json,
            waitingForResponse: false,
            responseReady: true,
            timestamp: Date.now()
          });
          
          showNotification('✅ Cards generated! Returning to webapp...', 'success');
          
          // Optional: Show confirmation before closing
          setTimeout(() => {
            showNotification('💚 Success! You can close this tab', 'success');
          }, 2000);
        } else {
          // Response exists but no valid JSON yet, keep checking
          console.log('Response exists but no valid JSON yet...');
        }
      }, 2000); // Wait 2 seconds for full render
    }
  }, 1000);
}

function extractChatGPTResponse() {
  try {
    // Find the latest assistant message
    const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
    
    if (messages.length === 0) {
      return { success: false, error: 'No response yet' };
    }
    
    const latestMessage = messages[messages.length - 1];
    
    // Check if message is still being generated (has streaming indicator)
    const isGenerating = latestMessage.querySelector('[data-message-id]')?.classList.contains('result-streaming') ||
                        latestMessage.textContent?.includes('...') ||
                        document.querySelector('[class*="streaming"]');
    
    if (isGenerating) {
      console.log('Response still generating...');
      return { success: false, error: 'Still generating' };
    }
    
    // Look for code blocks first
    const codeBlocks = latestMessage.querySelectorAll('code, pre');
    
    for (const block of codeBlocks) {
      let text = block.textContent || '';
      
      // Try to find JSON
      if (text.includes('"cards"') && text.includes('[')) {
        try {
          // Clean markdown formatting
          text = text
            .replace(/```json\n?/gi, '')
            .replace(/```javascript\n?/gi, '')
            .replace(/```\n?/g, '')
            .trim();
          
          // Try to parse
          const parsed = JSON.parse(text);
          
          if (parsed.cards && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
            console.log(`Found valid JSON with ${parsed.cards.length} cards`);
            return { success: true, json: text };
          }
        } catch (e) {
          console.log('Failed to parse code block:', e);
        }
      }
    }
    
    // Fallback: search in plain text
    const textContent = latestMessage.textContent || '';
    
    // Try to extract JSON from text
    const jsonMatch = textContent.match(/\{[\s\S]*?"cards"[\s\S]*?\[[\s\S]*?\][\s\S]*?\}/);
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.cards && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
          console.log('Found valid JSON in text');
          return { success: true, json: jsonMatch[0] };
        }
      } catch (e) {
        console.log('Failed to parse text JSON:', e);
      }
    }
    
    console.log('No valid JSON found in response');
    return { success: false, error: 'No valid JSON found' };
    
  } catch (error) {
    console.error('Error extracting response:', error);
    return { success: false, error: error.message };
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    console.log('Copied to clipboard');
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