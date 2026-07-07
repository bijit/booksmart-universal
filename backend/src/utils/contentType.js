/**
 * Detects the content type of a bookmark based on its URL and extraction method
 *
 * @param {string} url - The bookmark URL
 * @param {string} [extractionMethod] - The method used to extract content (e.g. document-service)
 * @returns {string} One of: 'webpage', 'document', 'email', 'video', 'audio', 'social'
 */
export function detectContentType(url, extractionMethod) {
  if (!url) return 'webpage';

  const cleanUrl = url.toLowerCase().trim();

  // 1. Documents (PDFs, office documents, Google workspace items)
  if (
    extractionMethod === 'document-service' ||
    extractionMethod === 'pdf-parse' ||
    extractionMethod === 'mammoth' ||
    cleanUrl.endsWith('.pdf') ||
    cleanUrl.endsWith('.docx') ||
    cleanUrl.endsWith('.xlsx') ||
    cleanUrl.endsWith('.pptx') ||
    cleanUrl.includes('drive.google.com') ||
    cleanUrl.includes('docs.google.com')
  ) {
    return 'document';
  }

  // 2. Emails (Gmail, Outlook Web App, Yahoo mail, etc.)
  if (
    cleanUrl.includes('mail.google.com') ||
    cleanUrl.includes('outlook.live.com') ||
    cleanUrl.includes('outlook.office.com') ||
    cleanUrl.includes('outlook.office365.com') ||
    cleanUrl.includes('mail.yahoo.com')
  ) {
    return 'email';
  }

  // 3. Videos (YouTube, Vimeo, Loom, Twitch, TikTok, Wistia)
  if (
    cleanUrl.includes('youtube.com') ||
    cleanUrl.includes('youtu.be') ||
    cleanUrl.includes('vimeo.com') ||
    cleanUrl.includes('loom.com') ||
    cleanUrl.includes('twitch.tv') ||
    cleanUrl.includes('tiktok.com') ||
    cleanUrl.includes('wistia.com')
  ) {
    return 'video';
  }

  // 4. Audio (Spotify, SoundCloud, Apple Music, Bandcamp, podcast feeds)
  if (
    cleanUrl.includes('spotify.com') ||
    cleanUrl.includes('soundcloud.com') ||
    cleanUrl.includes('music.apple.com') ||
    cleanUrl.includes('bandcamp.com')
  ) {
    return 'audio';
  }

  // 5. Social posts (Twitter/X, LinkedIn, Reddit, Mastodon)
  if (
    cleanUrl.includes('twitter.com') ||
    cleanUrl.includes('x.com') ||
    cleanUrl.includes('linkedin.com') ||
    cleanUrl.includes('reddit.com')
  ) {
    return 'social';
  }

  // Fallback
  return 'webpage';
}
