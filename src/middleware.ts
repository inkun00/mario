// src/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 허용할 출처(프론트엔드 주소) 목록을 여기에 추가하세요.
const allowedOrigins = [
  'http://localhost:9002', // 개발 환경
  // 'https://your-production-site.com', // 실제 서비스 도메인
];

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const origin = request.headers.get('origin');

  // 허용된 출처 목록에 있는 경우에만 헤더를 추가합니다.
  if (origin && allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // Pre-flight 요청(OPTIONS)에 대한 처리
  if (request.method === 'OPTIONS') {
    // 허용된 출처인지 다시 한번 확인하여 응답합니다.
    if (origin && allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Credentials': 'true',
            },
        });
    } else {
        // 허용되지 않은 출처의 OPTIONS 요청은 기본 응답으로 처리
        return new NextResponse(null, { status: 204 });
    }
  }

  return response;
}

// 이 미들웨어를 적용할 API 경로를 지정합니다.
export const config = {
  matcher: '/api/genkit/:path*',
};
