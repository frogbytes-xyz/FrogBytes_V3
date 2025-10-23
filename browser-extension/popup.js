/**
 * FrogBytes Cookie Helper - Popup Script
 * Displays extension status and provides quick actions
 */

const statusCard = document.getElementById('status-card')
const statusTitle = document.getElementById('status-title')
const statusMessage = document.getElementById('status-message')
const openFrogBytesBtn = document.getElementById('open-frogbytes')
const clearSessionBtn = document.getElementById('clear-session')

/**
 * Update status display
 */
async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'getActiveSession'
    })

    if (response.session) {
      statusCard.classList.remove('status-inactive')
      statusCard.classList.add('status-active')
      statusTitle.textContent = 'Active Session'

      const url = new URL(response.session.url)
      const elapsed = Math.floor(
        (Date.now() - response.session.timestamp) / 1000
      )

      statusMessage.textContent = `Extracting cookies from ${url.hostname} (${elapsed}s ago)`
    } else {
      statusCard.classList.remove('status-active')
      statusCard.classList.add('status-inactive')
      statusTitle.textContent = 'No Active Session'
      statusMessage.textContent = 'Navigate to FrogBytes to start'
    }
  } catch (error) {
    console.error('Failed to get session status', error)
  }
}

/**
 * Open FrogBytes website
 */
openFrogBytesBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000', active: true })
  window.close()
})

/**
 * Clear active session
 */
clearSessionBtn.addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove('activeSession')
    statusTitle.textContent = 'Session Cleared'
    statusMessage.textContent = 'Ready for new extraction'

    setTimeout(() => {
      updateStatus()
    }, 1500)
  } catch (error) {
    console.error('Failed to clear session', error)
  }
})

/**
 * Initialize
 */
updateStatus()
setInterval(updateStatus, 2000)
