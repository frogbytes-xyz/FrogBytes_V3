// Simple in-memory store for pending file during navigation
let pendingFile: File | null = null

export const setPendingFile = (file: File | null) => {
  pendingFile = file
}

export const getPendingFile = (): File | null => {
  return pendingFile
}

export const clearPendingFile = () => {
  pendingFile = null
}
