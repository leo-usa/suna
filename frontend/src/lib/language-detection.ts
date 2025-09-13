/**
 * Language detection utility for detecting Chinese vs English content
 */

export function detectLanguage(text: string): 'zh-CN' | 'en' {
  if (!text || typeof text !== 'string') {
    return 'en'; // Default to English
  }

  // Remove whitespace and normalize
  const normalizedText = text.trim();
  
  if (normalizedText.length === 0) {
    return 'en';
  }

  // Count Chinese characters (CJK Unified Ideographs)
  const chineseCharRegex = /[\u4e00-\u9fff]/g;
  const chineseMatches = normalizedText.match(chineseCharRegex);
  const chineseCharCount = chineseMatches ? chineseMatches.length : 0;
  
  // Count total characters (excluding spaces and punctuation)
  const totalCharCount = normalizedText.replace(/[\s\p{P}]/gu, '').length;
  
  // If more than 30% of characters are Chinese, consider it Chinese
  const chineseRatio = totalCharCount > 0 ? chineseCharCount / totalCharCount : 0;
  
  return chineseRatio > 0.3 ? 'zh-CN' : 'en';
}

export function detectLanguageFromPost(post: any): 'zh-CN' | 'en' {
  if (!post) return 'en';
  
  // Check title first (most reliable indicator)
  if (post.title) {
    const titleLang = detectLanguage(post.title);
    console.log('Title language detection:', post.title, '->', titleLang);
    if (titleLang === 'zh-CN') return 'zh-CN';
  }
  
  // Check description
  if (post.description) {
    const descLang = detectLanguage(post.description);
    console.log('Description language detection:', post.description, '->', descLang);
    if (descLang === 'zh-CN') return 'zh-CN';
  }
  
  // Check HTML content if available
  if (post.html_content) {
    // Extract text from HTML (basic extraction)
    const textContent = post.html_content
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    if (textContent) {
      const contentLang = detectLanguage(textContent);
      console.log('HTML content language detection:', textContent.substring(0, 100) + '...', '->', contentLang);
      if (contentLang === 'zh-CN') return 'zh-CN';
    }
  }
  
  // Default to English if no Chinese detected
  return 'en';
}

export async function detectLanguageFromPostWithHTML(post: any, htmlUrl: string): Promise<'zh-CN' | 'en'> {
  if (!post) return 'en';
  
  // First try with available post data
  const postLang = detectLanguageFromPost(post);
  if (postLang === 'zh-CN') return 'zh-CN';
  
  // If post data doesn't indicate Chinese, try fetching HTML content
  try {
    const response = await fetch(htmlUrl);
    if (response.ok) {
      const htmlContent = await response.text();
      const textContent = htmlContent
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      if (textContent) {
        const contentLang = detectLanguage(textContent);
        console.log('HTML content language detection from URL:', textContent.substring(0, 200) + '...', '->', contentLang);
        return contentLang;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch HTML content for language detection:', error);
  }
  
  return postLang;
}
