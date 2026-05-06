/**
 * BookSmart Notifications Utility
 * Handles browser notifications
 */

export function showNotification(title, message, type = 'success') {
  // Use a default icon or an error icon
  const iconUrl = type === 'error' ? 'icons/icon48.png' : 'icons/icon48.png';
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl,
    title,
    message,
    priority: type === 'error' ? 2 : 1
  });
}

export function showSuccess(message) {
  showNotification('Success', message, 'success');
}

export function showError(message) {
  showNotification('Error', message, 'error');
}
