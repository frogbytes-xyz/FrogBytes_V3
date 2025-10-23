/**
 * FrogBytes Cookie Helper - Content Script
 * Handles communication between FrogBytes website and extension
 */

let extractionButtonShown = false

/**
 * Check if this is FrogBytes website
 */
function isFrogBytesWebsite() {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname.endsWith('.frogbytes.app')
  )
}

/**
 * Send ready message to FrogBytes when on their site
 */
if (isFrogBytesWebsite()) {
  window.addEventListener('message', async event => {
    if (event.source !== window) return
    if (event.origin !== window.location.origin) return

    if (event.data.type === 'FROGBYTES_CHECK_EXTENSION') {
      window.postMessage(
        {
          type: 'FROGBYTES_EXTENSION_READY',
          payload: { installed: true }
        },
        window.location.origin
      )
    }

    if (event.data.type === 'FROGBYTES_EXTRACT_COOKIES') {
      const response = await chrome.runtime.sendMessage({
        type: 'extractCookiesForUrl',
        payload: event.data.payload
      })

      if (!response.success) {
        console.error(
          'FrogBytes extension: Failed to start extraction',
          response.error
        )
      }
    }
  })
}

/**
 * Show confirmation button after user has logged in
 */
function showConfirmationUI() {
  if (extractionButtonShown) return
  if (isFrogBytesWebsite()) return

  const container = document.createElement('div')
  container.id = 'frogbytes-cookie-helper'
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    background: white;
    border: 2px solid #3b82f6;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: system-ui, -apple-system, sans-serif;
  `

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <div>
        <div style="font-weight: 600; font-size: 14px; color: #1f2937; margin-bottom: 4px;">
          FrogBytes Cookie Helper
        </div>
        <div style="font-size: 12px; color: #6b7280;">
          Click button to extract cookies
        </div>
      </div>
    </div>
    <button id="frogbytes-confirm-btn" style="
      width: 100%;
      margin-top: 12px;
      padding: 8px 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
      cursor: pointer;
    ">
      Extract Cookies Now
    </button>
    <div id="frogbytes-status" style="
      margin-top: 8px;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    "></div>
  `

  document.body.appendChild(container)
  extractionButtonShown = true

  const confirmBtn = document.getElementById('frogbytes-confirm-btn')
  const statusDiv = document.getElementById('frogbytes-status')

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true
    confirmBtn.textContent = 'Extracting...'
    statusDiv.textContent = 'Please wait...'

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'extractCookiesNow'
      })

      if (response.success) {
        confirmBtn.style.background = '#10b981'
        confirmBtn.textContent = 'Success'
        statusDiv.textContent = `Extracted ${response.cookieCount} cookies`

        setTimeout(() => {
          container.style.transition = 'opacity 0.3s'
          container.style.opacity = '0'
          setTimeout(() => container.remove(), 300)
        }, 2000)
      } else {
        throw new Error(response.error || 'Extraction failed')
      }
    } catch (error) {
      confirmBtn.style.background = '#ef4444'
      confirmBtn.textContent = 'Failed'
      statusDiv.textContent = error.message

      setTimeout(() => {
        confirmBtn.disabled = false
        confirmBtn.textContent = 'Try Again'
        confirmBtn.style.background = '#3b82f6'
        statusDiv.textContent = ''
      }, 3000)
    }
  })
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FROGBYTES_COOKIES_EXTRACTED') {
    window.postMessage(message, window.location.origin)
    sendResponse({ received: true })
  }
  return false
})

/**
 * Check if there's an active session and show button after delay
 */
setTimeout(async () => {
  if (isFrogBytesWebsite()) return

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'getActiveSession'
    })
    if (response.session) {
      showConfirmationUI()
    }
  } catch (error) {
    console.error('FrogBytes extension: Failed to check session', error)
  }
}, 3000)
