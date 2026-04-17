import { uploadImage } from './firebaseService';

const PROXIES = [
  (u: string) => `/api/proxy-image?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];

/**
 * Extracts a direct image link from an HTML page (like Postimage)
 */
async function extractDirectLinkFromHtml(html: string, originalUrl: string): Promise<string | null> {
  // Common patterns for Postimage, Pixxxels, etc.
  const patterns = [
    // Standard direct link patterns
    /https?:\/\/i\.postimg\.cc\/[a-zA-Z0-9]+\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp|gif)/i,
    /https?:\/\/i\.pixxxels\.cc\/[a-zA-Z0-9]+\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp|gif)/i,
    
    // Patterns found inside HTML (often escaped or in JSON)
    /https?:\\?\/\\?\/i\.postimg\.cc\\?\/[a-zA-Z0-9]+\\?\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp|gif)/i,
    /https?:\\?\/\\?\/i\.pixxxels\.cc\\?\/[a-zA-Z0-9]+\\?\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp|gif)/i,

    // Variation of subdomains
    /https?:\/\/[a-z0-9]+\.(postimg\.(cc|org|com|me)|pixxxels\.cc)\/[a-zA-Z0-9._\/-]+\.(jpg|jpeg|png|webp|gif)/i,
    /https?:\/\/[a-z0-9]+\.(postimg\.(cc|org|com|me)|pixxxels\.cc)\/[a-zA-Z0-9._\/-]+/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[0];
  }

  // Fallback: look for generic high-res images in meta tags
  const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i);
  if (ogImageMatch && ogImageMatch[1]) return ogImageMatch[1];

  const twitterImageMatch = html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]*)"/i);
  if (twitterImageMatch && twitterImageMatch[1]) return twitterImageMatch[1];

  return null;
}

/**
 * Unified logic to convert an external image link to a Firebase Storage URL.
 * Handles Postimage, Pixxxels, and other common image hosting services by extracting direct links.
 */
export async function convertUrlToFirebase(url: string, storagePath: string = 'converted'): Promise<string> {
  if (!url || url.includes('firebasestorage.googleapis.com') || !url.startsWith('http')) {
    return url;
  }

  const cleanUrl = url.trim();
  let blob: Blob | null = null;
  let contentType = '';
  let finalUrl = cleanUrl;

  // 1. Try to fetch the URL content
  // OPTIMIZATION: If it's a known non-direct link (Postimage page), skip the initial proxy and go to extraction
  const isDirectCandidate = cleanUrl.match(/\.(jpg|jpeg|png|webp|gif)/i);
  const isHostingPage = cleanUrl.includes('postimg.') || cleanUrl.includes('postimage.') || cleanUrl.includes('pixxxels.cc');

  if (isDirectCandidate || !isHostingPage) {
    for (const getProxyUrl of PROXIES) {
      try {
        const proxyUrl = getProxyUrl(cleanUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // reduced to 8s
  
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) continue;
        blob = await response.blob();
        contentType = blob.type;
        if (blob && blob.type.startsWith('image/')) break; 
      } catch (e) { continue; }
    }
  }

  // 2. Identify if it's an HTML page or if initial fetch failed to get an image
  if ((!blob || contentType.includes('html')) && isHostingPage) {
    let html = '';
    // If we don't have a blob (skipped fetch or failed), we need to fetch the HTML
    if (!blob) {
      for (const getProxyUrl of PROXIES) {
        try {
          const res = await fetch(getProxyUrl(cleanUrl));
          if (res.ok) {
            html = await res.text();
            break;
          }
        } catch (e) { continue; }
      }
    } else {
      html = await blob.text();
    }

    if (html) {
      const directUrl = await extractDirectLinkFromHtml(html, cleanUrl);
      if (directUrl) {
        finalUrl = directUrl;
        for (const getProxyUrl of PROXIES) {
          try {
            const res = await fetch(getProxyUrl(directUrl));
            if (res.ok) {
              const imageBlob = await res.blob();
              if (imageBlob.type.startsWith('image/')) {
                blob = imageBlob;
                break;
              }
            }
          } catch (e) { continue; }
        }
      }
    }
  }

  // 3. Last check: is it actually an image?
  if (!blob || !blob.type.startsWith('image/')) {
    // If we couldn't get an image blob but we have a direct-looking URL, try one last time with simple fetch
    // (some proxies might be failing but the browser might succeed)
    try {
      const res = await fetch(finalUrl, { mode: 'no-cors' }); 
      // Note: no-cors fetch doesn't let us see the body, so this isn't very useful for uploading to Firebase.
      // We really need it through a proxy to get the blob.
    } catch (e) {}
    
    throw new Error('Could not retrieve a valid image from this link. Please check the URL.');
  }

  // 4. Upload to Firebase
  const extension = blob.type.split('/')[1] || 'jpg';
  const file = new File([blob], `converted_${Date.now()}.${extension}`, { type: blob.type });
  return await uploadImage(file, storagePath);
}
