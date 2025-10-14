/**
 * FrogBytes Cookie Helper - Content Script
 * 
 * AUTO-COOKIE EXTRACTION FOR PROTECTED VIDEOS
 * 
 * This browser extension provides ONE-CLICK cookie extraction for downloading
 * protected university lectures and other authenticated video content.
 * 
 * HOW IT WORKS:
 * 1. User attempts to download protected video on FrogBytes
 * 2. FrogBytes detects authentication error
 * 3. User clicks "🚀 Auto Extract with Extension" button
 * 4. Extension automatically extracts cookies from the video domain
 * 5. Cookies are sent to FrogBytes in Netscape format
 * 6. Download proceeds with authentication
 * 
 * PRIVACY & SECURITY:
 * - Only extracts cookies when explicitly requested by user click
 * - Cookies only sent to FrogBytes (same-origin)
 * - No storage or third-party sharing
 * - Open source and auditable
 * 
 * INSTALLATION:
 * 1. Go to chrome://extensions/
 * 2. Enable "Developer mode"
 * 3. Click "Load unpacked"
 * 4. Select folder with extension files
 * 
 * Runs on all pages and detects when user is on FrogBytes
 */

// Detect if we're on FrogBytes website
const isFrogBytes = window.location.hostname.includes('frogbytes') || 
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1';

// Listen for cookie requests from FrogBytes page
if (isFrogBytes) {
  window.addEventListener('message', async (event) => {
    // Only accept messages from same origin
    if (event.origin !== window.location.origin) return;
    
    if (event.data.type === 'FROGBYTES_REQUEST_COOKIES') {
      const targetUrl = event.data.url;
      
      // Send message to background script to get cookies
      chrome.runtime.sendMessage({
        type: 'GET_COOKIES',
        url: targetUrl
      }, (response) => {
        // Send cookies back to the page
        window.postMessage({
          type: 'FROGBYTES_COOKIES_RESPONSE',
          cookies: response.cookies,
          success: response.success,
          requestId: event.data.requestId
        }, window.location.origin);
      });
    }
  });
  
  // Inject detection script
  const script = document.createElement('script');
  script.textContent = `
    window.FROGBYTES_EXTENSION_INSTALLED = true;
    window.FROGBYTES_EXTENSION_VERSION = '1.0.0';
  `;
  document.documentElement.appendChild(script);
  script.remove();
}

