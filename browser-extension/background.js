/**
 * FrogBytes Cookie Helper - Background Service Worker
 * Handles cookie extraction and communication with FrogBytes website
 */

let activeSession = null

/**
 * Listen for messages from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'extractCookiesForUrl') {
    handleCookieExtraction(message.payload, sendResponse)
    return true
  }

  if (message.type === 'extractCookiesNow') {
    handleImmediateCookieExtraction(sender.tab.id, sendResponse)
    return true
  }

  if (message.type === 'getActiveSession') {
    sendResponse({ session: activeSession })
    return false
  }

  return false
})

/**
 * Handle cookie extraction request from FrogBytes
 */
async function handleCookieExtraction(payload, sendResponse) {
  try {
    const { url, sessionId, userId } = payload

    console.log('FrogBytes extension: Extracting cookies for', {
      url,
      sessionId
    })

    // Store active session
    activeSession = { url, sessionId, userId, timestamp: Date.now() }
    await chrome.storage.local.set({ activeSession })

    // Open URL in new tab
    const tab = await chrome.tabs.create({ url, active: true })

    console.log('FrogBytes extension: Opened tab', tab.id)

    sendResponse({ success: true, tabId: tab.id })
  } catch (error) {
    console.error('FrogBytes extension: Failed to open tab', error)
    sendResponse({ success: false, error: error.message })
  }
}

/**
 * Handle immediate cookie extraction from current tab
 */
async function handleImmediateCookieExtraction(tabId, sendResponse) {
  try {
    const tab = await chrome.tabs.get(tabId)

    console.log('FrogBytes extension: Extracting cookies from tab', {
      tabId,
      url: tab.url
    })

    const result = await extractCookiesFromTab(tab)

    if (result.success && activeSession) {
      await sendCookiesToFrogBytes(result.cookies, activeSession.sessionId)

      // Clear active session
      activeSession = null
      await chrome.storage.local.remove('activeSession')

      // Close tab after short delay
      setTimeout(() => {
        chrome.tabs.remove(tabId).catch(() => {})
      }, 2000)
    }

    sendResponse(result)
  } catch (error) {
    console.error('FrogBytes extension: Failed to extract cookies', error)
    sendResponse({ success: false, error: error.message })
  }
}

/**
 * Extract cookies from a tab
 */
async function extractCookiesFromTab(tab) {
  try {
    const url = new URL(tab.url)
    const cookies = await chrome.cookies.getAll({ domain: url.hostname })

    console.log(
      `FrogBytes extension: Found ${cookies.length} cookies for ${url.hostname}`
    )

    if (cookies.length === 0) {
      return {
        success: false,
        error: 'No cookies found for this domain'
      }
    }

    const netscapeCookies = convertToNetscapeFormat(cookies, url.hostname)

    return {
      success: true,
      cookies: netscapeCookies,
      cookieCount: cookies.length
    }
  } catch (error) {
    console.error('FrogBytes extension: Cookie extraction error', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Convert cookies to Netscape format for yt-dlp compatibility
 */
function convertToNetscapeFormat(cookies, hostname) {
  const lines = [
    '# Netscape HTTP Cookie File',
    '# This is a generated file. Do not edit.',
    ''
  ]

  for (const cookie of cookies) {
    const domain = cookie.domain.startsWith('.')
      ? cookie.domain.substring(1)
      : cookie.domain
    const domainFlag = cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE'
    const path = cookie.path || '/'
    const secure = cookie.secure ? 'TRUE' : 'FALSE'
    const expiration = cookie.expirationDate
      ? Math.floor(cookie.expirationDate)
      : 0
    const name = cookie.name
    const value = cookie.value

    lines.push(
      `${domain}\t${domainFlag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}`
    )
  }

  return lines.join('\n')
}

/**
 * Send extracted cookies back to FrogBytes
 */
async function sendCookiesToFrogBytes(cookies, sessionId) {
  try {
    // Find FrogBytes tab
    const tabs = await chrome.tabs.query({ url: 'http://localhost:*/*' })

    if (tabs.length === 0) {
      console.warn('FrogBytes extension: No FrogBytes tab found')
      return
    }

    // Send message to content script on FrogBytes tab
    await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'FROGBYTES_COOKIES_EXTRACTED',
      payload: {
        cookies,
        sessionId,
        timestamp: Date.now()
      }
    })

    console.log('FrogBytes extension: Cookies sent to FrogBytes')
  } catch (error) {
    console.error('FrogBytes extension: Failed to send cookies', error)
  }
}

/**
 * Clean up expired sessions
 */
setInterval(async () => {
  if (activeSession && Date.now() - activeSession.timestamp > 3600000) {
    activeSession = null
    await chrome.storage.local.remove('activeSession')
    console.log('FrogBytes extension: Cleared expired session')
  }
}, 60000)
