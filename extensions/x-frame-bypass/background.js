/**
 * X-Frame-Options Bypass Extension
 * Strips X-Frame-Options and frame-ancestors CSP headers from HTTP responses
 * to allow iframe embedding of protected sites
 */

chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    const headersToRemove = [
      'x-frame-options',
      'content-security-policy',
      'x-content-type-options'
    ]

    const filteredHeaders = details.responseHeaders.filter(header => {
      const headerName = header.name.toLowerCase()

      // Remove X-Frame-Options completely
      if (headerName === 'x-frame-options') {
        console.log(
          `[X-Frame Bypass] Removed X-Frame-Options: ${header.value} from ${details.url}`
        )
        return false
      }

      // Remove or modify CSP headers that contain frame-ancestors
      if (headerName === 'content-security-policy') {
        if (header.value && header.value.includes('frame-ancestors')) {
          console.log(
            `[X-Frame Bypass] Removed CSP frame-ancestors from ${details.url}`
          )
          return false
        }
      }

      return true
    })

    return { responseHeaders: filteredHeaders }
  },
  { urls: ['<all_urls>'] },
  ['blocking', 'responseHeaders']
)

console.log('[X-Frame Bypass] Extension loaded and active')
