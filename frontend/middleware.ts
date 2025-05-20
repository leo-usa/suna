import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const lang = request.cookies.get('i18next')?.value || 'en';
  // Set a header for the language
  const response = NextResponse.next();
  response.headers.set('x-i18n-lang', lang);
  return response;
} 