import type { Metadata } from 'next'
import LegalShell, { Article, Toc, Important } from '@/components/landing/LegalShell'
import { LEGAL_EFFECTIVE_DATE, LEGAL_LABEL } from '@/lib/legal'

export const metadata: Metadata = {
  title: '개인정보처리방침 | Rolling Thunder',
  description: 'Rolling Thunder 개인정보처리방침 — 수집 항목, 보유 기간, 파기 절차, 정보주체의 권리 행사 방법을 안내합니다.',
}

const TOC = [
  { id: 'section-1', label: '개인정보의 처리 목적' },
  { id: 'section-2', label: '수집하는 개인정보의 항목 및 방법' },
  { id: 'section-3', label: '개인정보의 처리 및 보유 기간' },
  { id: 'section-4', label: '개인정보의 파기 절차 및 방법' },
  { id: 'section-5', label: '처리 위탁 및 국외 이전' },
  { id: 'section-6', label: '쿠키 등 자동 수집 장치' },
  { id: 'section-7', label: '정보주체의 권리·의무 및 행사 방법' },
  { id: 'section-8', label: '만 14세 미만 아동의 개인정보' },
  { id: 'section-9', label: '개인정보의 안전성 확보 조치' },
  { id: 'section-10', label: '개인정보 보호책임자' },
  { id: 'section-11', label: '처리방침의 변경' },
]

/** 수집 항목 표 — 실제 데이터베이스 스키마와 1:1 대응 */
const COLLECTED = [
  { kind: '필수 (가입 시)', items: '아이디, 비밀번호(단방향 암호화 저장), 이름, 닉네임', period: '회원 탈퇴 시 즉시 파기' },
  { kind: '자동 생성', items: '가입일시, 권한 등급', period: '회원 탈퇴 시 즉시 파기' },
  {
    kind: '서비스 이용 과정',
    items: '칩 잔액 및 변동 이력, 뽑기(가챠) 기록, 보유·장착 스킨, 미션·업적·스탬프 달성 기록, 제작한 커스텀 맵과 좋아요·다운로드 이력, 추첨 세션 및 결과',
    period: '회원 탈퇴 시 즉시 파기',
  },
  { kind: '이용자가 입력하는 제3자 정보', items: '참가자 명단(추첨 대상자의 이름 또는 별명)', period: '회원 탈퇴 또는 명단 삭제 시 파기' },
  { kind: '쿠키', items: '로그인 인증 토큰, 로그인 유지 설정(최대 1년)', period: '로그아웃 또는 만료 시 삭제' },
  { kind: '비회원(게스트)', items: '칩·인벤토리·장착 정보 — 서버에 전송되지 않고 브라우저 로컬 저장소에만 저장', period: '이용자가 브라우저에서 직접 삭제' },
]

export default function PrivacyPage() {
  return (
    <LegalShell
      title="개인정보처리방침"
      subtitle="Rolling Thunder 운영자 찰떡쌤(이하 '운영자')은 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_LABEL}
    >
      {/* 핵심 요약 배지 — '알기 쉬운 처리방침' 권고 반영 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: '🪶', title: '수집 최소화', desc: '이메일·전화번호·생년월일을 수집하지 않습니다' },
          { icon: '🗑️', title: '탈퇴 즉시 파기', desc: '탈퇴하면 모든 데이터가 즉시 완전 삭제됩니다' },
          { icon: '🚫', title: '광고·분석 없음', desc: '광고 및 행태 분석 도구를 사용하지 않습니다' },
        ].map((b) => (
          <div key={b.title} className="glass-panel p-4 text-center">
            <div className="text-2xl mb-1" aria-hidden="true">{b.icon}</div>
            <div className="text-sm font-bold text-[var(--text-primary)]">{b.title}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{b.desc}</div>
          </div>
        ))}
      </div>

      <Toc items={TOC} />

      <Article id="section-1" title="제1조 (개인정보의 처리 목적)">
        <p>운영자는 다음의 목적을 위해 개인정보를 처리합니다. 처리한 개인정보는 아래 목적 이외의 용도로 이용되지 않으며, 이용 목적이 변경되는 경우 별도의 동의를 받는 등 필요한 조치를 이행합니다.</p>
        <ol>
          <li><strong>회원 식별 및 로그인</strong>: 계정 생성, 본인 식별, 세션 유지</li>
          <li><strong>게임 진행상태 저장</strong>: 칩, 인벤토리, 스킨, 미션·업적 등 진행 데이터의 계정 연동 보관</li>
          <li><strong>커스텀 맵 공유</strong>: 제작한 맵의 스토어 공개, 좋아요·다운로드 집계</li>
          <li><strong>추첨 진행</strong>: 이용자가 입력한 참가자 명단의 저장 및 추첨 결과 기록</li>
          <li><strong>부정 이용 방지</strong>: 비정상적인 재화 취득·조작 탐지 및 서비스 안정성 확보</li>
        </ol>
      </Article>

      <Article id="section-2" title="제2조 (수집하는 개인정보의 항목 및 방법)">
        <p>수집하는 항목은 아래 표와 같으며, 모두 회원가입 화면 또는 서비스 이용 과정에서 이용자가 직접 입력하거나 자동으로 생성됩니다.</p>
        <div className="overflow-x-auto rounded-lg border border-[var(--panel-border-hover)]">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-black/20 text-[var(--text-primary)]">
                <th className="px-3 py-2.5 text-left font-bold whitespace-nowrap">구분</th>
                <th className="px-3 py-2.5 text-left font-bold">항목</th>
                <th className="px-3 py-2.5 text-left font-bold whitespace-nowrap">보유 기간</th>
              </tr>
            </thead>
            <tbody>
              {COLLECTED.map((row) => (
                <tr key={row.kind} className="border-t border-[var(--panel-border)] align-top">
                  <td className="px-3 py-2.5 whitespace-nowrap font-medium text-[var(--text-primary)]">{row.kind}</td>
                  <td className="px-3 py-2.5 leading-6">{row.items}</td>
                  <td className="px-3 py-2.5">{row.period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul>
          <li>
            <strong>이메일 주소, 전화번호, 생년월일, 주소는 수집하지 않습니다.</strong> 시스템 내부적으로는 아이디에 서비스
            전용 가상 주소 체계를 결합하여 계정을 식별하며, 이는 실제 이메일이 아니므로 어떠한 메일도 발송되지 않습니다.
          </li>
          <li>비밀번호는 복호화할 수 없는 단방향 해시(bcrypt)로 변환되어 저장되며, 운영자도 원문을 알 수 없습니다.</li>
        </ul>
        <Important>
          <strong>참가자 명단에 관한 안내</strong> — 이 서비스는 이용자가 추첨 대상자(학생, 동료 등)의 이름을 직접 입력하는
          구조입니다. 참가자 명단은 추첨 진행 목적으로만 저장되며 다른 용도로 이용되지 않습니다. 명단에 포함된 개인은 명단을
          소유한 회원 또는 아래 문의처를 통해 삭제를 요청할 수 있습니다. 실명 대신 별명·번호 사용을 권장합니다.
        </Important>
      </Article>

      <Article id="section-3" title="제3조 (개인정보의 처리 및 보유 기간)">
        <ol>
          <li>운영자는 회원 탈퇴 시까지 개인정보를 보유·이용하며, <strong>탈퇴 즉시 모든 개인정보를 파기합니다.</strong></li>
          <li>본 서비스는 전자상거래(결제)를 제공하지 않으므로, 「전자상거래 등에서의 소비자보호에 관한 법률」 등에 따른 별도 보존 의무 대상 정보가 없습니다.</li>
          <li>다만 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우에는 해당 수사·조사 종료 시까지 보유할 수 있습니다.</li>
        </ol>
      </Article>

      <Article id="section-4" title="제4조 (개인정보의 파기 절차 및 방법)">
        <ol>
          <li>
            <strong>파기 절차</strong>: 회원이 프로필 화면에서 탈퇴를 요청하면, 인증 시스템에서 계정이 삭제되고 데이터베이스의
            연관 데이터(프로필, 칩 이력, 인벤토리, 제작 맵, 추첨 기록 등)가 참조 무결성 규칙(ON DELETE CASCADE)에 따라{' '}
            <strong>자동으로 연쇄 삭제</strong>됩니다. 별도의 유예 기간 없이 즉시 처리됩니다.
          </li>
          <li><strong>파기 방법</strong>: 전자적 파일 형태의 정보는 복구할 수 없는 방법으로 영구 삭제합니다.</li>
          <li>클라우드 인프라의 재해 복구용 백업에 포함된 데이터는 백업 보존 주기(수일 이내)가 경과하면 자동으로 소멸됩니다.</li>
        </ol>
      </Article>

      <Article id="section-5" title="제5조 (개인정보 처리 위탁 및 국외 이전)">
        <p>운영자는 안정적인 서비스 제공을 위해 아래와 같이 개인정보 처리를 국외 사업자에게 위탁하고 있습니다. 서비스 이용에 필수적인 인프라로서, 회원가입 시 본 방침에 대한 동의를 통해 고지·동의 절차를 갈음합니다.</p>
        <div className="overflow-x-auto rounded-lg border border-[var(--panel-border-hover)]">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-black/20 text-[var(--text-primary)]">
                <th className="px-3 py-2.5 text-left font-bold whitespace-nowrap">수탁 업체</th>
                <th className="px-3 py-2.5 text-left font-bold">위탁 업무</th>
                <th className="px-3 py-2.5 text-left font-bold">이전 항목 / 국가</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--panel-border)] align-top">
                <td className="px-3 py-2.5 whitespace-nowrap font-medium text-[var(--text-primary)]">Supabase, Inc.</td>
                <td className="px-3 py-2.5 leading-6">데이터베이스 및 인증(로그인) 시스템 호스팅</td>
                <td className="px-3 py-2.5 leading-6">제2조의 전체 수집 항목 / 미국 법인이 운영하는 클라우드 리전 (서비스 존속 기간 동안 상시 저장)</td>
              </tr>
              <tr className="border-t border-[var(--panel-border)] align-top">
                <td className="px-3 py-2.5 whitespace-nowrap font-medium text-[var(--text-primary)]">Vercel Inc.</td>
                <td className="px-3 py-2.5 leading-6">웹 서비스 호스팅 및 전송</td>
                <td className="px-3 py-2.5 leading-6">접속 IP 등 통신 과정에서 발생하는 기록 / 미국 (엣지 서버 경유)</td>
              </tr>
              <tr className="border-t border-[var(--panel-border)] align-top">
                <td className="px-3 py-2.5 whitespace-nowrap font-medium text-[var(--text-primary)]">jsDelivr (CDN)</td>
                <td className="px-3 py-2.5 leading-6">웹 폰트(Pretendard) 파일 전송</td>
                <td className="px-3 py-2.5 leading-6">폰트 요청 시 브라우저가 전송하는 접속 IP / 글로벌 CDN (저장하지 않고 전송 목적으로만 처리)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>수탁 업체가 변경되는 경우 본 방침을 개정하여 공개합니다.</p>
      </Article>

      <Article id="section-6" title="제6조 (쿠키 등 자동 수집 장치의 설치·운영 및 거부)">
        <ol>
          <li>
            서비스는 로그인 상태 유지를 위해 다음 쿠키를 사용합니다.
            <ul>
              <li><strong>인증 토큰 쿠키</strong>: 로그인 세션 식별 (로그아웃 또는 만료 시 삭제)</li>
              <li><strong>로그인 유지 설정 쿠키</strong>: &lsquo;로그인 상태 유지&rsquo; 선택 시 최대 1년간 유지</li>
            </ul>
          </li>
          <li><strong>광고, 행태 분석, 트래킹 목적의 쿠키나 제3자 분석 도구(예: Google Analytics)는 사용하지 않습니다.</strong> 도입하는 경우 본 방침을 먼저 개정하여 고지합니다.</li>
          <li>이용자는 브라우저 설정(설정 → 개인정보 보호 → 쿠키)에서 쿠키 저장을 거부할 수 있습니다. 다만 인증 쿠키를 거부하면 로그인이 유지되지 않습니다.</li>
          <li>비회원 데이터와 테마·차분 모드 등 환경 설정은 쿠키가 아닌 브라우저 로컬 저장소(localStorage)에 저장되며 서버로 전송되지 않습니다.</li>
        </ol>
      </Article>

      <Article id="section-7" title="제7조 (정보주체의 권리·의무 및 행사 방법)">
        <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
        <ol>
          <li><strong>열람</strong>: 프로필 화면에서 본인의 계정 정보와 게임 데이터를 직접 확인할 수 있습니다.</li>
          <li><strong>정정</strong>: 닉네임 등 변경 가능한 정보는 프로필 화면에서 직접 수정할 수 있습니다.</li>
          <li><strong>삭제 및 처리정지</strong>: 프로필 화면의 회원 탈퇴 기능으로 즉시 전체 삭제할 수 있으며, 개별 항목의 삭제는 문의처를 통해 요청할 수 있습니다.</li>
          <li>
            화면에서 직접 처리할 수 없는 요청(참가자 명단 내 본인 이름 삭제 등)은{' '}
            <a href="mailto:rudgnswh12@naver.com" className="text-[var(--accent-primary)] underline underline-offset-2">rudgnswh12@naver.com</a>
            으로 연락 주시면 지체 없이(10일 이내) 조치하고 결과를 알려드립니다.
          </li>
          <li>권리 행사는 법정대리인이나 위임을 받은 자를 통해서도 할 수 있습니다.</li>
        </ol>
      </Article>

      <Article id="section-8" title="제8조 (만 14세 미만 아동의 개인정보)">
        <ol>
          <li>만 14세 미만 아동이 회원가입을 하려면 「개인정보 보호법」 제22조의2에 따라 법정대리인의 동의가 필요합니다.</li>
          <li>
            교실 등에서 만 14세 미만 아동이 이용하는 경우, 개인정보를 전혀 수집하지 않는{' '}
            <strong>비회원(게스트) 모드 이용을 권장</strong>합니다. 게스트 모드의 데이터는 브라우저에만 저장되며 서버로
            전송되지 않습니다.
          </li>
          <li>법정대리인 동의 없이 가입된 만 14세 미만 아동의 계정이 확인되는 경우 지체 없이 삭제 조치합니다.</li>
        </ol>
      </Article>

      <Article id="section-9" title="제9조 (개인정보의 안전성 확보 조치)">
        <p>운영자는 개인정보의 안전성 확보를 위해 다음 조치를 실제로 적용하고 있습니다.</p>
        <ol>
          <li><strong>비밀번호 단방향 암호화</strong>: 비밀번호는 bcrypt 해시로만 저장되어 운영자를 포함한 누구도 원문을 볼 수 없습니다.</li>
          <li><strong>행 수준 보안(Row Level Security)</strong>: 데이터베이스의 모든 사용자 데이터 테이블에 RLS 정책이 적용되어, 각 이용자는 본인의 데이터에만 접근할 수 있습니다.</li>
          <li><strong>전송 구간 암호화</strong>: 서비스의 모든 통신은 HTTPS(TLS)로 암호화됩니다.</li>
          <li><strong>관리자 권한 분리</strong>: 데이터베이스 관리자 키는 서버 환경에서만 사용되며 브라우저(클라이언트)에 노출되지 않습니다.</li>
          <li><strong>접근 권한 관리</strong>: 관리 기능은 관리자 권한 계정으로 제한됩니다.</li>
        </ol>
      </Article>

      <Article id="section-10" title="제10조 (개인정보 보호책임자)">
        <p>개인정보 처리에 관한 업무를 총괄하고 관련 고충 처리를 담당하는 책임자는 다음과 같습니다.</p>
        <div className="glass-panel p-5 text-sm">
          <ul className="!pl-0 !list-none flex flex-col gap-1">
            <li><strong>개인정보 보호책임자</strong>: 찰떡쌤 (서비스 개발·운영자)</li>
            <li><strong>연락처</strong>: <a href="mailto:rudgnswh12@naver.com" className="text-[var(--accent-primary)] underline underline-offset-2">rudgnswh12@naver.com</a></li>
          </ul>
        </div>
        <p>
          기타 개인정보 침해에 대한 신고나 상담이 필요한 경우 개인정보침해 신고센터(privacy.kisa.or.kr / 국번 없이 118),
          개인정보 분쟁조정위원회(kopico.go.kr / 1833-6972)에 문의할 수 있습니다.
        </p>
      </Article>

      <Article id="section-11" title="제11조 (개인정보처리방침의 변경)">
        <ol>
          <li>본 방침의 내용이 추가, 삭제 또는 수정되는 경우 시행 <strong>7일 전</strong>(수집 항목 추가 등 중요한 변경은 <strong>30일 전</strong>)부터 서비스 초기 화면을 통해 공지합니다.</li>
          <li>변경 이력은 아래에 버전과 시행일로 기록합니다.</li>
        </ol>
        <div className="overflow-x-auto rounded-lg border border-[var(--panel-border-hover)]">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-black/20 text-[var(--text-primary)]">
                <th className="px-3 py-2.5 text-left font-bold">버전</th>
                <th className="px-3 py-2.5 text-left font-bold">시행일</th>
                <th className="px-3 py-2.5 text-left font-bold">주요 변경 내용</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--panel-border)]">
                <td className="px-3 py-2.5 font-mono">v1.0</td>
                <td className="px-3 py-2.5">2026-07-13</td>
                <td className="px-3 py-2.5">최초 제정</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Article>
    </LegalShell>
  )
}
