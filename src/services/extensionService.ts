// Fixed Extension communication service
export class ExtensionService {
  private static extensionId: string | null = null;
  private static isDetecting = false;

  // Detect if extension is installed
  static async isExtensionInstalled(): Promise<boolean> {
    if (this.isDetecting) return false;
    
    try {
      this.isDetecting = true;

      if (!chrome?.runtime) {
        console.log('Chrome runtime not available');
        return false;
      }

      // Try to get extension ID
      const response = await this.sendMessage({ action: 'getExtensionId' });
      if (response?.extensionId) {
        this.extensionId = response.extensionId;
        console.log('Extension detected:', this.extensionId);
        return true;
      }
      return false;
    } catch (error) {
      console.log('Extension not detected:', error);
      return false;
    } finally {
      this.isDetecting = false;
    }
  }

  // Send message to extension
  static async sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome?.runtime) {
          reject(new Error('Chrome runtime not available'));
          return;
        }

        // If we don't have the extension ID yet, try to detect it
        if (!this.extensionId) {
          // Try common development ID pattern or use a fallback
          // After you build your extension, replace this with your actual ID
          const testIds = [
            'mnibfdclgfadpgkocmbfjgimckaaaknf' // Replace after building
          ];

          let resolved = false;

          testIds.forEach(extensionId => {
            if (resolved) return;

            try {
              chrome.runtime.sendMessage(
                extensionId,
                message,
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.log('Extension error:', chrome.runtime.lastError.message);
                    return;
                  }
                  
                  if (!resolved && response) {
                    resolved = true;
                    this.extensionId = extensionId; // Store successful ID
                    resolve(response);
                  }
                }
              );
            } catch (err) {
              console.log('Failed to send to extension:', err);
            }
          });

          // Timeout after 3 seconds
          setTimeout(() => {
            if (!resolved) {
              reject(new Error('Extension not found. Please install the Chrome extension.'));
            }
          }, 3000);

        } else {
          // We already have the extension ID
          chrome.runtime.sendMessage(
            this.extensionId,
            message,
            (response) => {
              if (chrome.runtime.lastError) {
                console.log('Extension error:', chrome.runtime.lastError.message);
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              resolve(response);
            }
          );
        }

      } catch (error) {
        reject(error);
      }
    });
  }

  // Generate flashcards via ChatGPT
  static async generateWithChatGPT(
    text: string,
    format: 'basic' | 'cloze' | 'image'
  ): Promise<{ success: boolean; cards?: any[]; error?: string }> {
    try {
      console.log('Sending to extension...');
      
      const response = await this.sendMessage({
        action: 'generateFlashcards',
        text,
        format
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to communicate with extension');
      }

      console.log('Prompt sent to ChatGPT, waiting for response...');

      // Poll for response
      return await this.pollForResponse(60000); // 60 second timeout

    } catch (error) {
      console.error('Extension generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Extension communication failed'
      };
    }
  }

  // Poll extension for ChatGPT response
  private static async pollForResponse(timeout: number): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const checkForResponse = async () => {
        attempts++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`🔄 Polling attempt ${attempts} (${elapsed}s elapsed)...`);

        try {
          const response = await this.sendMessage({ action: 'getLatestResponse' });
          console.log('📬 Poll response:', {
            success: response?.success,
            hasData: !!response?.latestResponse,
            waiting: response?.waiting,
            message: response?.message
          });

          if (response?.success && response?.latestResponse) {
            console.log('🎉 Response received from extension!');
            console.log('📄 Response preview:', 
              typeof response.latestResponse === 'string' 
                ? response.latestResponse.substring(0, 200) 
                : JSON.stringify(response.latestResponse).substring(0, 200)
            );
            
            try {
              // If it's already a string, parse it
              const parsed = typeof response.latestResponse === 'string' 
                ? JSON.parse(response.latestResponse)
                : response.latestResponse;
              
              console.log('✅ Parsed successfully:', {
                hasCards: !!parsed.cards,
                cardCount: parsed.cards?.length || 0,
                hasConcepts: !!parsed.concepts,
                hasSummary: !!parsed.summary
              });
              
              if (parsed.cards && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
                console.log('🎊 Valid cards found! Resolving...');
                resolve({ success: true, cards: parsed.cards, data: parsed });
                return;
              } else {
                console.warn('⚠️ Response has no valid cards array, continuing to poll...');
                console.log('Parsed structure:', Object.keys(parsed));
              }
            } catch (e) {
              console.error('❌ Invalid JSON response from ChatGPT:', e);
              console.error('Raw response:', response.latestResponse);
            }
          } else {
            console.log('⏳ No response ready yet...');
          }

          // Check timeout
          const timeRemaining = timeout - (Date.now() - startTime);
          if (timeRemaining <= 0) {
            console.error('⏱️ Timeout reached after', attempts, 'attempts');
            reject(new Error('Timeout waiting for ChatGPT response. Please try again or import JSON manually.'));
            return;
          }

          console.log(`⏰ ${Math.round(timeRemaining / 1000)}s remaining, will check again...`);
          
          // Continue polling
          setTimeout(checkForResponse, pollInterval);

        } catch (error) {
          console.error('❌ Polling error:', error);
          // Don't reject immediately, continue polling unless timeout
          const timeRemaining = timeout - (Date.now() - startTime);
          if (timeRemaining > 0) {
            console.log('⚠️ Error occurred, but will retry...');
            setTimeout(checkForResponse, pollInterval);
          } else {
            reject(error);
          }
        }
      };

      checkForResponse();
    });
  }

  // Manual method to get extension ID after installation
  static setExtensionId(id: string) {
    this.extensionId = id;
    console.log('Extension ID manually set:', id);
  }
} 