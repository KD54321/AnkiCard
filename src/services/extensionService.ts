// Extension communication service
export class ExtensionService {
  private static readonly EXTENSION_ID = 'Ymnibfdclgfadpgkocmbfjgimckaaaknf'; 
  private static extensionId: string | null = null;

  // Detect if extension is installed
  static async isExtensionInstalled(): Promise<boolean> {
    try {
      if (!chrome?.runtime) {
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
    }
  }

  // Send message to extension
  static async sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Try multiple possible extension IDs
        const possibleIds = [
          this.extensionId,
          'YOUR_EXTENSION_ID_HERE', // Replace after building extension
        ].filter(Boolean);

        let resolved = false;

        possibleIds.forEach(extensionId => {
          if (resolved) return;

          try {
            chrome.runtime.sendMessage(
              extensionId as string,
              message,
              (response) => {
                if (chrome.runtime.lastError) {
                  console.log('Extension error:', chrome.runtime.lastError);
                  return;
                }
                
                if (!resolved && response) {
                  resolved = true;
                  resolve(response);
                }
              }
            );
          } catch (err) {
            console.log('Failed to send to extension:', err);
          }
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (!resolved) {
            reject(new Error('Extension communication timeout'));
          }
        }, 5000);

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
      return await this.pollForResponse(30000); // 30 second timeout

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
    const pollInterval = 1000; // Check every second

    return new Promise((resolve, reject) => {
      const checkForResponse = async () => {
        try {
          const response = await this.sendMessage({ action: 'getLatestResponse' });

          if (response?.latestResponse) {
            console.log('Response received from extension!');
            
            try {
              const parsed = JSON.parse(response.latestResponse);
              resolve({ success: true, cards: parsed.cards, data: parsed });
            } catch (e) {
              reject(new Error('Invalid JSON response from ChatGPT'));
            }
            return;
          }

          // Check timeout
          if (Date.now() - startTime > timeout) {
            reject(new Error('Timeout waiting for ChatGPT response'));
            return;
          }

          // Continue polling
          setTimeout(checkForResponse, pollInterval);

        } catch (error) {
          reject(error);
        }
      };

      checkForResponse();
    });
  }
}