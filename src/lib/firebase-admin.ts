
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// This robust singleton pattern ensures Firebase is initialized only once.
if (getApps().length === 0) {
  try {
    // 아무런 인자 없이 initializeApp()을 호출합니다.
    // 이렇게 하면 SDK가 실행 환경(예: Google Cloud Workstations, App Hosting)의
    // 기본 서비스 계정 정보를 자동으로 찾아 인증합니다.
    // 이것이 가장 표준적이고 권장되는 방식입니다.
    initializeApp();
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// 초기화된 admin 객체에서 Firestore 인스턴스를 내보냅니다.
const adminDb: Firestore = getFirestore();

try {
  // Firestore has a maximum batch size of 500.
  // This settings call will only succeed on the very first initialization.
  // Subsequent calls will throw an error, which we safely ignore in the catch block.
  adminDb.settings({
      batchRequests: 500,
  });
} catch (e) {
  // This is expected and fine if settings have already been applied.
}


export { adminDb };
