import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            에듀칩(Educhip) 개인정보 처리방침
          </CardTitle>
          <CardDescription>시행일: 2026년 2월 11일</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <section>
            <h2 className="text-lg font-semibold mb-2">제1조 (개인정보의 처리 목적)</h2>
            <p>
              서비스는 다음 목적을 위하여 개인정보를 처리합니다. 처리하는
              개인정보는 아래 목적 이외의 용도로 이용되지 않으며, 이용 목적이
              변경되는 경우 「개인정보 보호법」 제18조에 따라 별도의 동의를
              받는 등 필요한 조치를 이행합니다.
            </p>
            <ol className="list-decimal list-inside space-y-2 mt-2 pl-4">
              <li>
                <strong>회원 가입 및 관리</strong>
                <ul className="list-disc list-inside pl-4 mt-1">
                  <li>본인 확인, 계정 생성 및 로그인(로컬)</li>
                  <li>
                    학급 구성원 식별 및 권한 관리(교사/학생 구분, 학급 소속 확인)
                  </li>
                  <li>부정 이용 방지 및 서비스 안정성 확보</li>
                </ul>
              </li>
              <li>
                <strong>학급 및 교과 수업 운영 기능 제공</strong>
                <ul className="list-disc list-inside pl-4 mt-1">
                  <li>
                    학급/교과 운영, 교과 수업 자료(교사 및 학생 제작 컨텐츠) 및
                    도구 게시·공유
                  </li>
                  <li>
                    학습 활동/포인트 저장(서비스 내 제공 기능에 한함)
                    <br />
                    <span className="text-xs text-muted-foreground">
                      ※학습 활동 및 포인트 등의 기록은 개별 성취도 확인, 학급
                      운영을 위한 목적으로만 활용되며, 공식 성적 평가 자료로
                      사용되지 않습니다.
                    </span>
                  </li>
                  <li>교사의 피드백 제공 및 학습 지원</li>
                </ul>
              </li>
              <li>
                <strong>고객 문의 및 민원 처리</strong>
                <p>문의 응대, 공지 전달, 오류 대응 및 분쟁 처리</p>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제2조 (처리하는 개인정보 항목)</h2>
            <p>
              서비스는 원활한 운영을 위해 필요한 최소한의 개인정보를 수집합니다.
            </p>
            <ol className="list-decimal list-inside space-y-2 mt-2 pl-4">
              <li>
                <strong>학생(회원)</strong>
                <p>필수: 아이디, 학교, 이름 (실명 확인 하지 않음)</p>
              </li>
              <li>
                <strong>교사(회원)</strong>
                <p>필수: 아이디, 학교, 이름 (실명 확인 하지 않음)</p>
              </li>
              <li>
                <strong>로그인/서비스 이용 과정에서 자동 생성·수집될 수 있는 정보</strong>
                <p>
                  접속 로그, 이용 기록, IP, 쿠키 정보 등(보안 및 서비스 안정화
                  목적)
                </p>
              </li>
              <li>
                <strong>수집하지 않는 정보(원칙)</strong>
                <p>
                  주민등록번호, 주소, 전화번호 등 과도한 개인정보 및 민감정보는
                  원칙적으로 수집하지 않습니다.
                </p>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              제3조 (개인정보의 처리 및 보유 기간)
            </h2>
            <p>
              서비스는 법령에 따른 보유·이용기간 또는 정보주체로부터 동의받은
              기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <ol className="list-decimal list-inside space-y-2 mt-2 pl-4">
              <li>
                <strong>학생 계정 정보 및 학급 활동 기록(아이디, 학교, 이름, 포인트)</strong>
                <p>보유 기간: 회원 탈퇴 시</p>
                <p>
                  파기 시점: 보유 기간 종료 후 지체 없이(원칙적으로 5일 이내)
                  파기
                </p>
              </li>
              <li>
                <strong>계정 탈퇴(회원탈퇴) 시</strong>
                <p>회원탈퇴 요청이 있는 경우, 지체 없이 삭제합니다.</p>
              </li>
               <li>
                <strong>교사 계정 정보</strong>
                <p>보유기간: 회원 탈퇴시 까지</p>
                <p>파기 시점: 탈퇴 요청시 지체 없이 삭제</p>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              제4조 (만 14세 미만 아동의 개인정보 처리)
            </h2>
            <p>
              서비스는 만 14세 미만 아동의 개인정보를 처리하기 위하여 가입 단계
              및 학기 초 학교 가정통신문(개인정보 수집·이용 동의서) 등을 통해
              법정대리인의 동의를 받습니다. 법정대리인이 동의하지 않는 경우, 해당
              아동은 서비스 가입 및 이용이 제한될 수 있습니다.
            </p>
          </section>
          
           <section>
            <h2 className="text-lg font-semibold mb-2">제5조 (개인정보의 제3자 제공)</h2>
            <p>
              서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지
              않습니다. 다만, 이용자가 사전에 동의한 경우 또는 법령에 근거가
              있는 경우에는 예외로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              제6조 (개인정보 처리업무의 위탁 및 국외 이전 가능성)
            </h2>
            <p>
              서비스는 안정적인 운영을 위해 아래 클라우드 서비스를 이용할 수
              있습니다.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 pl-4">
                <li><strong>수탁업체:</strong> Google LLC (Firebase / Firestore / Firebase Authentication)</li>
                <li><strong>위탁 업무:</strong> 사용자 인증(로그인), 데이터베이스 저장 및 운영, 보안 인프라 제공</li>
                <li><strong>보유 기간:</strong> 서비스 이용 기간(또는 위탁계약 종료 시까지)</li>
                <li>(Firebase는 글로벌 인프라를 사용하므로 데이터가 해외 서버에서 처리·보관될 수 있습니다. 서비스는 관련 법령에 따른 보호조치를 준수합니다. 또한, 서비스는 위탁업무와 관련하여 재 위탁을 하지 않습니다.)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제7조 (개인정보의 파기 절차 및 방법)</h2>
            <p>
              개인정보 보유기간 경과, 처리목적 달성 등 개인정보가 불필요하게
              되었을 때에는 지체 없이 해당 개인정보를 파기합니다.
            </p>
             <ul className="list-disc list-inside space-y-1 mt-2 pl-4">
                <li><strong>전자적 파일:</strong> 복구 불가능한 방법으로 삭제(DB 영구 삭제)</li>
                <li><strong>출력물 등 종이 문서:</strong> 분쇄 또는 소각</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제8조 (개인정보의 안전성 확보 조치)</h2>
            <p>
              서비스는 「개인정보 보호법」 제29조에 따라 다음과 같은 안전성 확보
              조치를 합니다.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 pl-4">
                <li><strong>비밀번호 보호:</strong> 로컬 로그인 사용 시 비밀번호는 일방향 암호화(Hash) 등 안전한 방식으로 저장·관리</li>
                <li><strong>전송구간 암호화:</strong> HTTPS 등 보안 통신 적용</li>
                <li><strong>접근 권한 최소화:</strong> 개인정보 접근 권한을 최소한으로 제한하고 관리</li>
                <li><strong>보안 점검:</strong> 설정(보안 규칙/권한) 점검 및 취약점 대응</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              제9조 (정보주체 및 법정대리인의 권리·의무 및 행사 방법)
            </h2>
            <p>
              정보주체(이용자) 및 만 14세 미만 아동의 법정대리인은 언제든지
              개인정보 열람, 정정, 삭제, 처리정지 등을 요구할 수 있습니다.
            </p>
             <ul className="list-disc list-inside space-y-1 mt-2 pl-4">
                <li><strong>행사 방법:</strong> 서비스 내 회원정보 수정 / 회원탈퇴 기능 이용 또는 개인정보 보호책임자에게 문의</li>
                <li>서비스는 요청을 받은 경우 지체 없이 조치합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제10조 (개인정보 보호책임자)</h2>
            <p>
              서비스는 개인정보 처리에 관한 업무를 총괄하여 책임지고, 개인정보
              관련 불만처리 및 피해구제를 위해 아래와 같이 개인정보 보호책임자를
              지정합니다.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 pl-4">
                <li><strong>성명:</strong> 유인근</li>
                <li><strong>소속:</strong> 인천도담초등학교</li>
                <li><strong>직위:</strong> 교사</li>
                <li><strong>이메일:</strong> inkun00@hanmail.net</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제11조 (개인정보 처리방침 변경)</h2>
            <p>
              이 개인정보 처리방침은 2026년 2월 11일부터 적용됩니다. 내용의
              추가, 삭제, 정정이 있는 경우 변경사항 시행 전 서비스 내 공지사항
              등을 통해 안내합니다.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
