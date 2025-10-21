import { logger } from '@/lib/utils/logger'

/**
 * Authentication Popup Service
 * Shows user-friendly popup dialogs when authentication is required for media access
 */

import { Page } from 'puppeteer'
import { browserLauncherService } from './browser-launcher-service'
import { videoDownloadConfig } from '../config/video-download'

export interface PopupOptions {
  title?: string
  message?: string
  loginButtonText?: string
  cancelButtonText?: string
  showProgress?: boolean
  timeout?: number
  customStyles?: Record<string, string>
}

export interface PopupResult {
  success: boolean
  action: 'login' | 'cancel' | 'timeout' | 'error'
  sessionId?: string
  error?: string
}

class AuthenticationPopupService {
  private activePopups = new Map<string, { page: Page; timeoutId: NodeJS.Timeout }>()

  /**
   * Show authentication popup when media is not found
   */
  async showAuthenticationPopup(
    url: string,
    userId: string,
    options: PopupOptions = {}
  ): Promise<PopupResult> {
    const sessionId = `popup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const timeout = options.timeout || videoDownloadConfig.authSessionTimeout

    try {
      // Launch browser for popup
      const browserResult = await browserLauncherService.launchForAuth()
      
      if (!browserResult.success || !browserResult.browser) {
        return {
          success: false,
          action: 'error',
          error: browserResult.error || 'Failed to launch browser for popup',
        }
      }

      // Create popup page
      const page = await browserLauncherService.createPage(browserResult.instanceId!)
      
      if (!page) {
        return {
          success: false,
          action: 'error',
          error: 'Failed to create popup page',
        }
      }

      // Set up popup page
      await this.setupPopupPage(page, url, userId, options)

      // Create popup HTML content
      const popupHTML = this.generatePopupHTML(url, options)
      await page.setContent(popupHTML)

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.cleanupPopup(sessionId)
      }, timeout)

      // Store popup reference
      this.activePopups.set(sessionId, { page, timeoutId })

      // Wait for user interaction
      const result = await this.waitForUserInteraction(page, sessionId, url, userId)

      return result

    } catch (error) {
      return {
        success: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Set up popup page configuration
   */
  private async setupPopupPage(page: Page, url: string, userId: string, options: PopupOptions): Promise<void> {
    // Set viewport for popup
    await page.setViewport({
      width: 500,
      height: 400,
      deviceScaleFactor: 1,
    })

    // Set up page event listeners
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        logger.error(`Popup console error: ${msg.text()}`)
      }
    })

    page.on('pageerror', (error) => {
      logger.error(`Popup page error: ${error.message}`)
    })

    // Add custom styles if provided
    if (options.customStyles) {
      await page.addStyleTag({
        content: Object.entries(options.customStyles)
          .map(([property, value]) => `${property}: ${value};`)
          .join(' ')
      })
    }
  }

  /**
   * Generate popup HTML content
   */
  private generatePopupHTML(url: string, options: PopupOptions): string {
    const title = options.title || 'Authentication Required'
    const message = options.message || `
      <p>This video requires authentication to access.</p>
      <p><strong>URL:</strong> <code>${url}</code></p>
      <p>Please log in to your account to continue with the download.</p>
    `
    const loginButtonText = options.loginButtonText || 'Login & Download'
    const cancelButtonText = options.cancelButtonText || 'Cancel'

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authentication Required</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .popup-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 40px;
            max-width: 450px;
            width: 100%;
            text-align: center;
            animation: slideIn 0.3s ease-out;
          }
          
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .icon {
            font-size: 48px;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          
          h1 {
            color: #2d3748;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 16px;
          }
          
          .message {
            color: #4a5568;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          
          .message code {
            background: #f7fafc;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            color: #2d3748;
            word-break: break-all;
          }
          
          .button-group {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
          }
          
          .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 140px;
            text-decoration: none;
            display: inline-block;
          }
          
          .btn-primary {
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
            color: white;
          }
          
          .btn-primary:hover {
            background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(49, 130, 206, 0.3);
          }
          
          .btn-secondary {
            background: #e2e8f0;
            color: #4a5568;
          }
          
          .btn-secondary:hover {
            background: #cbd5e0;
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
          }
          
          .progress-container {
            margin-top: 20px;
            display: none;
          }
          
          .progress-bar {
            width: 100%;
            height: 6px;
            background: #e2e8f0;
            border-radius: 3px;
            overflow: hidden;
          }
          
          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4299e1, #3182ce);
            width: 0%;
            transition: width 0.3s ease;
            animation: shimmer 2s infinite;
          }
          
          @keyframes shimmer {
            0% { background-position: -200px 0; }
            100% { background-position: 200px 0; }
          }
          
          .status-text {
            margin-top: 8px;
            font-size: 14px;
            color: #718096;
          }
          
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #a0aec0;
          }
        </style>
      </head>
      <body>
        <div class="popup-container">
          <div class="icon">[AUTH]</div>
          <h1>${title}</h1>
          <div class="message">${message}</div>

          <div class="button-group">
            <button class="btn btn-primary" id="loginBtn">${loginButtonText}</button>
            <button class="btn btn-secondary" id="cancelBtn">${cancelButtonText}</button>
          </div>

          <div class="progress-container" id="progressContainer">
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="status-text" id="statusText">Preparing authentication...</div>
          </div>

          <div class="footer">
            <p>[SECURE] Your credentials are secure and never stored</p>
            <p>[TIMEOUT] Session will timeout after 5 minutes</p>
          </div>
        </div>

        <script>
          let progressInterval;
          let progress = 0;
          
          // Handle login button click
          document.getElementById('loginBtn').addEventListener('click', async () => {
            const loginBtn = document.getElementById('loginBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            const progressContainer = document.getElementById('progressContainer');
            const statusText = document.getElementById('statusText');
            
            // Disable buttons and show progress
            loginBtn.disabled = true;
            cancelBtn.disabled = true;
            progressContainer.style.display = 'block';
            
            // Start progress animation
            progressInterval = setInterval(() => {
              progress += Math.random() * 10;
              if (progress > 90) progress = 90;
              
              document.getElementById('progressFill').style.width = progress + '%';
              
              if (progress < 30) {
                statusText.textContent = 'Opening authentication page...';
              } else if (progress < 60) {
                statusText.textContent = 'Waiting for login...';
              } else if (progress < 90) {
                statusText.textContent = 'Processing authentication...';
              }
            }, 200);
            
            // Send login action to parent
            window.parent.postMessage({
              type: 'AUTH_POPUP_ACTION',
              action: 'login',
              sessionId: '${sessionId}'
            }, '*');
          });
          
          // Handle cancel button click
          document.getElementById('cancelBtn').addEventListener('click', () => {
            window.parent.postMessage({
              type: 'AUTH_POPUP_ACTION',
              action: 'cancel',
              sessionId: '${sessionId}'
            }, '*');
          });
          
          // Handle window close
          window.addEventListener('beforeunload', () => {
            window.parent.postMessage({
              type: 'AUTH_POPUP_ACTION',
              action: 'cancel',
              sessionId: '${sessionId}'
            }, '*');
          });
          
          // Auto-focus login button
          document.getElementById('loginBtn').focus();
        </script>
      </body>
      </html>
    `
  }

  /**
   * Wait for user interaction with the popup
   */
  private async waitForUserInteraction(
    page: Page,
    sessionId: string,
    url: string,
    userId: string
  ): Promise<PopupResult> {
    return new Promise((resolve) => {
      const messageHandler = (message: any) => {
        if (message.type === 'AUTH_POPUP_ACTION' && message.sessionId === sessionId) {
          this.cleanupPopup(sessionId)
          
          if (message.action === 'login') {
            resolve({
              success: true,
              action: 'login',
              sessionId,
            })
          } else if (message.action === 'cancel') {
            resolve({
              success: false,
              action: 'cancel',
              sessionId,
            })
          }
        }
      }

      // Listen for messages from the popup
      page.on('console', (msg) => {
        if (msg.text().includes('AUTH_POPUP_ACTION')) {
          try {
            const message = JSON.parse(msg.text())
            messageHandler(message)
          } catch (e) {
            // Ignore parsing errors
          }
        }
      })

      // Set up timeout
      const timeout = setTimeout(() => {
        this.cleanupPopup(sessionId)
        resolve({
          success: false,
          action: 'timeout',
          sessionId,
        })
      }, videoDownloadConfig.authSessionTimeout)
    })
  }

  /**
   * Clean up popup resources
   */
  private cleanupPopup(sessionId: string): void {
    const popup = this.activePopups.get(sessionId)
    if (popup) {
      clearTimeout(popup.timeoutId)
      popup.page.close().catch(console.error)
      this.activePopups.delete(sessionId)
    }
  }

  /**
   * Get active popup count
   */
  getActivePopupCount(): number {
    return this.activePopups.size
  }

  /**
   * Close all active popups
   */
  async closeAllPopups(): Promise<void> {
    const sessionIds = Array.from(this.activePopups.keys())
    for (const sessionId of sessionIds) {
      this.cleanupPopup(sessionId)
    }
  }
}

// Export singleton instance
export const authenticationPopupService = new AuthenticationPopupService()

