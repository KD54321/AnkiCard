console.log('Anki Flashcard Generator: Content script loaded');

let isWaitingForResponse = false;
let responseObserver = null;
let lastMessageCount = 0;

// Create debug panel
function createDebugPanel() {
  if (document.getElementById('anki-debug-panel')) return;
  
  const panel = document.createElement('div');
  panel.id = 'anki-debug-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    border: 2px solid #667eea;
    border-radius: 10px;
    padding: 15px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 999998;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    max-width: 250px;
  `;
  
  panel.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 10px; color: #667eea;">
      🎴 Anki Card Generator
    </div>
    <button id="anki-extract-now" style="
      width: 100%;
      padding: 8px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 500;
      margin-bottom: 5px;
    ">Extract Response Now</button>
    <button id="anki-check-storage" style="
      width: 100%;
      padding: 8px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 500;
      margin-bottom: 5px;
    ">Check Storage</button>
    <button id="anki-resubmit" style="
      width: 100%;
      padding: 8px;
      background: #f59e0b;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 500;
    ">Retry Submit</button>
    <div id="anki-status" style="
      margin-top: 10px;
      padding: 8px;
      background: #f3f4f6;
      border-radius: 5px;
      font-size: 11px;
    ">Ready</div>
  `;
  
  document.body.appendChild(panel);
  
  document.getElementById('anki-extract-now').addEventListener('click', manualExtract);
  document.getElementById('anki-check-storage').addEventListener('click', checkStorageDebug);
  document.getElementById('anki-resubmit').addEventListener('click', retrySubmit);
}

function updateDebugStatus(message) {
  const status = document.getElementById('anki-status');
  if (status) {
    status.textContent = message;
    console.log('🎯 Debug status:', message);
  }
}

function manualExtract() {
  console.log('🔧 Manual extraction triggered');
  updateDebugStatus('Extracting...');
  
  const response = extractChatGPTResponse();
  
  if (response.success && response.json) {
    console.log('✅ Manual extraction successful!');
    
    chrome.runtime.sendMessage({
      action: 'responseExtracted',
      data: response.json
    });
    
    chrome.storage.local.set({
      latestResponse: response.json,
      responseReady: true,
      timestamp: Date.now()
    });
    
    updateDebugStatus('✅ Extracted! Check webapp');
    showNotification('✅ Response extracted manually!', 'success');
  } else {
    console.log('❌ Manual extraction failed:', response.error);
    updateDebugStatus('❌ ' + response.error);
    
    // Show helpful message
    showNotification(
      '❌ Could not find valid JSON. Make sure ChatGPT finished responding and returned the JSON format.',
      'error',
      8000
    );
    
    // Log what we found for debugging
    const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      const preview = (latestMessage.textContent || '').substring(0, 200);
      console.log('Latest message preview:', preview);
      
      if (!preview.includes('"cards"')) {
        showNotification(
          '💡 Tip: Ask ChatGPT to return the response as JSON with a "cards" array',
          'info',
          6000
        );
      }
    }
  }
}

function checkStorageDebug() {
  chrome.storage.local.get(['latestResponse', 'responseReady', 'promptToSend'], (result) => {
    console.log('📦 Storage check:', {
      hasResponse: !!result.latestResponse,
      isReady: result.responseReady,
      hasPrompt: !!result.promptToSend,
      responseLength: result.latestResponse?.length || 0
    });
    if (result.latestResponse) {
      updateDebugStatus(`✅ Has data (${result.latestResponse.length} chars)`);
    } else {
      updateDebugStatus('❌ No data in storage');
    }
  });
}

function retrySubmit() {
  updateDebugStatus('Retrying submit...');
  const input = findChatGPTInput();
  if (input) {
    submitPrompt(input);
  } else {
    updateDebugStatus('❌ Input not found');
  }
}

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
        
        // Show debug panel after a delay
        setTimeout(createDebugPanel, 3000);
      }, 2000);
    };
    
    if (document.readyState === 'complete') {
      waitAndFill();
    } else {
      window.addEventListener('load', waitAndFill);
    }
  } else {
    // Show debug panel on any ChatGPT page
    setTimeout(createDebugPanel, 2000);
  }
});

function findChatGPTInput() {
  const selectors = [
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    'textarea[data-id="root"]',
    '[contenteditable="true"][data-id]',
    'div[contenteditable="true"]'
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        console.log(`✅ Found input: ${selector}`);
        return el;
      }
    }
  }
  return null;
}

function fillChatGPTPrompt(prompt, autoSubmit = false) {
  console.log('📝 Filling ChatGPT prompt... Auto-submit:', autoSubmit);
  updateDebugStatus('Filling prompt...');
  
  const inputElement = findChatGPTInput();

  if (!inputElement) {
    console.error('❌ Could not find ChatGPT input');
    updateDebugStatus('❌ Input not found');
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

    console.log('✅ Prompt filled successfully');
    updateDebugStatus('Prompt filled');

    if (autoSubmit) {
      setTimeout(() => {
        submitPrompt(inputElement);
      }, 800);
    } else {
      showNotification('✅ Prompt filled! Press Enter to send', 'success');
    }

  } catch (error) {
    console.error('❌ Error filling prompt:', error);
    updateDebugStatus('❌ Fill failed');
    copyToClipboard(prompt);
    showNotification('📋 Error - Copied to clipboard', 'warning');
  }
}

function submitPrompt(inputElement) {
  console.log('🚀 Attempting to submit prompt...');
  updateDebugStatus('Submitting...');
  
  try {
    // Find the form first (more reliable)
    const form = inputElement.closest('form');
    
    if (form) {
      console.log('📋 Found form element, checking for send button...');
      
      // Look for send button within the form
      const sendButton = form.querySelector('button[data-testid="send-button"]') ||
                        form.querySelector('button[data-testid="fruitjuice-send-button"]') ||
                        form.querySelector('button[type="submit"]') ||
                        form.querySelector('button:not([disabled])');
      
      if (sendButton && !sendButton.disabled) {
        console.log('✅ Found send button in form');
        console.log('Button details:', {
          tagName: sendButton.tagName,
          type: sendButton.type,
          disabled: sendButton.disabled,
          testId: sendButton.getAttribute('data-testid'),
          className: sendButton.className
        });
        
        // Try multiple click methods
        try {
          sendButton.click();
          console.log('✅ Button clicked successfully');
        } catch (e) {
          console.log('⚠️ Direct click failed, trying MouseEvent...', e);
          sendButton.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          }));
        }
        
        updateDebugStatus('Submitted! Waiting...');
        showNotification('🚀 Sent to ChatGPT!', 'info');
        
        setTimeout(() => {
          startResponseMonitoring();
        }, 1500);
        return;
      } else {
        console.log('⚠️ Send button not found or disabled in form');
      }
    }

    // Fallback: Search entire page for send button
    console.log('🔍 Searching page for send button...');
    const sendButtonSelectors = [
      'button[data-testid="send-button"]',
      'button[data-testid="fruitjuice-send-button"]',
      'button[aria-label*="Send"]',
      'button[type="submit"]'
    ];

    let sendButton = null;
    
    for (const selector of sendButtonSelectors) {
      const buttons = document.querySelectorAll(selector);
      console.log(`Checking selector "${selector}": found ${buttons.length} elements`);
      
      for (const btn of buttons) {
        if (btn.tagName !== 'BUTTON') continue;
        
        const rect = btn.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        const isDisabled = btn.disabled || btn.hasAttribute('disabled');
        
        console.log('Button check:', {
          selector,
          visible: isVisible,
          disabled: isDisabled,
          ariaLabel: btn.getAttribute('aria-label')
        });
        
        if (isVisible && !isDisabled) {
          const inputRect = inputElement.getBoundingClientRect();
          const distance = Math.abs(rect.top - inputRect.top);
          
          if (distance < 150) {
            sendButton = btn;
            console.log(`✅ Found send button: ${selector}, distance: ${distance}px`);
            break;
          }
        }
      }
      if (sendButton) break;
    }

    if (sendButton) {
      console.log('🎯 Clicking send button...');
      sendButton.click();
      updateDebugStatus('Submitted! Waiting...');
      showNotification('🚀 Sent to ChatGPT!', 'info');
      
      setTimeout(() => {
        startResponseMonitoring();
      }, 1500);
      return;
    }

    // Last resort: Simulate Enter key
    console.log('⌨️ No button found, simulating Enter key...');
    
    ['keydown', 'keypress', 'keyup'].forEach(eventType => {
      inputElement.dispatchEvent(new KeyboardEvent(eventType, {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true
      }));
    });
    
    updateDebugStatus('Enter pressed...');
    showNotification('⌨️ Enter key sent...', 'info');
    
    setTimeout(() => {
      startResponseMonitoring();
    }, 1500);

  } catch (error) {
    console.error('❌ Error submitting prompt:', error);
    updateDebugStatus('❌ Submit failed');
    showNotification('⚠️ Auto-submit failed. Press Enter manually', 'warning');
    
    setTimeout(() => {
      startResponseMonitoring();
    }, 2000);
  }
}

function startResponseMonitoring() {
  console.log('🔍 Starting response monitoring with MutationObserver...');
  updateDebugStatus('Monitoring...');
  showNotification('⏳ Waiting for ChatGPT response...', 'info');
  
  // Stop any existing observer
  if (responseObserver) {
    responseObserver.disconnect();
  }
  
  // Count current messages
  const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
  lastMessageCount = messages.length;
  console.log(`📊 Initial message count: ${lastMessageCount}`);
  
  isWaitingForResponse = true;
  
  // Find the container to observe
  const container = document.querySelector('main') || document.body;
  
  let generationComplete = false;
  let stableChecks = 0;
  const requiredStableChecks = 3;
  
  // Create MutationObserver
  responseObserver = new MutationObserver((mutations) => {
    // Check if new message appeared
    const currentMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
    
    if (currentMessages.length > lastMessageCount && !generationComplete) {
      console.log('🎉 New response detected via MutationObserver!');
      updateDebugStatus('Response detected!');
      lastMessageCount = currentMessages.length;
      showNotification('📝 Response started, waiting...', 'info');
    }
    
    // If we've detected a message, check if generation is complete
    if (currentMessages.length > 0 && currentMessages.length >= lastMessageCount) {
      const latestMessage = currentMessages[currentMessages.length - 1];
      
      const isGenerating = 
        latestMessage.querySelector('[data-message-id]')?.classList.contains('result-streaming') ||
        document.querySelector('[class*="streaming"]') !== null ||
        document.querySelector('button[aria-label*="Stop"]') !== null ||
        document.querySelector('button[aria-label*="Stop generating"]') !== null;
      
      if (!isGenerating && !generationComplete) {
        stableChecks++;
        console.log(`✅ Generation appears complete (stable check ${stableChecks}/${requiredStableChecks})`);
        
        if (stableChecks >= requiredStableChecks) {
          console.log('✅ Response is stable, extracting JSON...');
          generationComplete = true;
          
          setTimeout(() => {
            handleResponseExtraction();
          }, 1000);
        }
      } else if (isGenerating) {
        if (stableChecks > 0) {
          console.log('⏳ Still generating, resetting stable checks...');
        }
        stableChecks = 0;
      }
    }
  });
  
  // Start observing
  responseObserver.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-message-author-role']
  });
  
  console.log('✅ MutationObserver active');
  
  // Fallback timeout
  setTimeout(() => {
    if (isWaitingForResponse) {
      console.log('⏱️ Timeout reached, stopping observer');
      responseObserver.disconnect();
      isWaitingForResponse = false;
      updateDebugStatus('⏱️ Timeout - try manual');
      showNotification('⏱️ Timeout - Use manual extract', 'warning');
    }
  }, 180000); // 3 minutes
}

function handleResponseExtraction() {
  const response = extractChatGPTResponse();
  
  if (response.success && response.json) {
    console.log('✅ Valid JSON response found!');
    console.log('JSON preview:', response.json.substring(0, 200));
    
    responseObserver.disconnect();
    isWaitingForResponse = false;
    
    // Send to background script
    console.log('📤 Sending response to background script...');
    chrome.runtime.sendMessage({
      action: 'responseExtracted',
      data: response.json
    }, (bgResponse) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error sending to background:', chrome.runtime.lastError);
      } else {
        console.log('✅ Background script confirmed:', bgResponse);
      }
    });
    
    // Store locally
    chrome.storage.local.set({
      latestResponse: response.json,
      waitingForResponse: false,
      responseReady: true,
      timestamp: Date.now()
    }, () => {
      console.log('✅ Response stored');
      
      chrome.storage.local.get(['latestResponse', 'responseReady'], (result) => {
        console.log('✅ Verification:', {
          hasResponse: !!result.latestResponse,
          isReady: result.responseReady,
          length: result.latestResponse?.length || 0
        });
      });
    });
    
    updateDebugStatus('✅ Extracted!');
    showNotification('✅ Cards generated! Check webapp', 'success');
    
    setTimeout(() => {
      showNotification('💚 Success! You can close this tab', 'success');
    }, 2000);
  } else {
    console.log('⚠️ Response complete but no valid JSON');
    console.log('Error:', response.error);
    updateDebugStatus('❌ No JSON found');
  }
}

function extractChatGPTResponse() {
  try {
    console.log('🔍 Extracting ChatGPT response...');
    
    const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
    
    if (messages.length === 0) {
      console.log('❌ No assistant messages found');
      return { success: false, error: 'No response yet' };
    }
    
    const latestMessage = messages[messages.length - 1];
    console.log('📝 Found latest message');
    
    // Strategy 1: Look for code blocks first
    const codeBlocks = latestMessage.querySelectorAll('code, pre');
    console.log(`Found ${codeBlocks.length} code blocks`);
    
    // Try each code block
    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i];
      let text = block.textContent || '';
      
      if (text.length < 50) {
        console.log(`Skipping code block ${i + 1} (too short: ${text.length} chars)`);
        continue;
      }
      
      console.log(`Checking code block ${i + 1} (${text.length} chars)`);
      
      // Must contain both "cards" and an array
      if (!text.includes('"cards"') || !text.includes('[')) {
        console.log(`Skipping code block ${i + 1} (no cards array)`);
        continue;
      }
      
      const result = tryParseJSON(text, `code block ${i + 1}`);
      if (result.success) return result;
    }
    
    // Strategy 2: If no code blocks worked, try the entire message text
    console.log('⚠️ No valid JSON in code blocks, trying full message text...');
    const fullText = latestMessage.textContent || '';
    
    if (fullText.includes('"cards"') && fullText.includes('[')) {
      console.log(`Checking full message text (${fullText.length} chars)`);
      
      // Try to extract JSON from the message
      // Look for content between { and } that contains "cards"
      const jsonMatches = fullText.match(/\{[\s\S]*?"cards"[\s\S]*?\]/);
      
      if (jsonMatches) {
        // Find the complete JSON object
        let startIdx = fullText.indexOf(jsonMatches[0]);
        let braceCount = 0;
        let endIdx = startIdx;
        
        for (let i = startIdx; i < fullText.length; i++) {
          if (fullText[i] === '{') braceCount++;
          if (fullText[i] === '}') braceCount--;
          if (braceCount === 0 && fullText[i] === '}') {
            endIdx = i + 1;
            break;
          }
        }
        
        const possibleJSON = fullText.substring(startIdx, endIdx);
        console.log(`Extracted possible JSON (${possibleJSON.length} chars)`);
        
        const result = tryParseJSON(possibleJSON, 'full message extraction');
        if (result.success) return result;
      }
    }
    
    // Strategy 3: Look in markdown/prose sections
    console.log('⚠️ Trying to find JSON in prose text...');
    const paragraphs = latestMessage.querySelectorAll('p, div');
    
    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i].textContent || '';
      if (text.includes('"cards"') && text.includes('[') && text.length > 100) {
        console.log(`Checking paragraph ${i + 1} (${text.length} chars)`);
        const result = tryParseJSON(text, `paragraph ${i + 1}`);
        if (result.success) return result;
      }
    }
    
    console.log('❌ No valid JSON found anywhere in the message');
    return { success: false, error: 'No valid JSON found' };
    
  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
}

function tryParseJSON(text, source) {
  try {
    // Aggressive cleaning
    let cleaned = text
      .replace(/^jsonCopy\s*/gi, '')
      .replace(/^json\s*/gi, '')
      .replace(/Copy\s*/gi, '')
      .replace(/```json\s*/gi, '')
      .replace(/```javascript\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^[\s\n]+/, '')
      .replace(/[\s\n]+$/, '')
      .trim();
    
    // Find first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      console.log(`${source}: No valid JSON structure (no braces)`);
      return { success: false };
    }
    
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    
    if (!cleaned.startsWith('{')) {
      console.log(`${source}: Doesn't start with {`);
      return { success: false };
    }
    
    const parsed = JSON.parse(cleaned);
    
    // Validate structure
    if (parsed.cards && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
      const validCards = parsed.cards.filter(card => 
        card.front && card.back && 
        typeof card.front === 'string' && 
        typeof card.back === 'string'
      );
      
      if (validCards.length > 0) {
        console.log(`✅ Found ${validCards.length} valid cards in ${source}`);
        
        if (validCards.length !== parsed.cards.length) {
          console.log(`⚠️ Filtered out ${parsed.cards.length - validCards.length} invalid cards`);
          parsed.cards = validCards;
        }
        
        return { success: true, json: JSON.stringify(parsed) };
      } else {
        console.log(`⚠️ ${source} has cards array but no valid cards`);
      }
    } else {
      console.log(`⚠️ ${source} missing cards array or empty`);
    }
  } catch (e) {
    console.log(`❌ Parse failed for ${source}:`, e.message);
  }
  
  return { success: false };
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(err => {
    console.error('Failed to copy:', err);
  });
}

function showNotification(message, type = 'info', duration = 5000) {
  const existing = document.getElementById('anki-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'anki-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
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
  }, duration);
}