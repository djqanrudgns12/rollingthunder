import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Sparkles, ShoppingBag, Map, Copy, Mail, Share2, Coffee, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PremiumUpgradeModal({ isOpen, onClose }: PremiumUpgradeModalProps) {
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${type} 복사 완료! 🚀`);
    }).catch(() => {
      toast.error('복사에 실패했습니다. 직접 복사해주세요.');
    });
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
        {/* 백드롭 블러 */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100 backdrop-blur-sm"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 backdrop-blur-sm"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-8"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-8"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-3xl bg-black/90 p-1 text-left align-middle shadow-2xl transition-all border border-purple-500/30">
                {/* 화려한 보더 효과 */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-transparent to-amber-500/20 rounded-3xl pointer-events-none"></div>

                <div className="relative bg-zinc-950/80 backdrop-blur-xl rounded-[22px] p-6 sm:p-8">
                  {/* 닫기 버튼 */}
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors z-10"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <Dialog.Title
                    as="h3"
                    className="text-2xl sm:text-3xl font-black text-center mb-2 flex items-center justify-center gap-3"
                  >
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-600 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
                      PREMIUM UPGRADE
                    </span>
                    <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
                  </Dialog.Title>

                  <p className="text-center text-white/60 text-sm mb-6 font-medium">
                    프리미엄 회원이 되어 롤링썬더의 모든 기능을 해금하세요!
                  </p>

                  {/* 혜택 섹션 */}
                  <div className="space-y-3 mb-8">
                    <h4 className="text-amber-400 font-bold text-sm tracking-widest uppercase mb-4 flex items-center gap-2">
                      <div className="w-4 h-1 bg-amber-400 rounded-full"></div>
                      프리미엄 혜택
                    </h4>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-4 hover:border-yellow-500/50 hover:bg-white/10 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0 border border-yellow-500/30">
                        <span className="text-yellow-400 font-black text-lg">$</span>
                      </div>
                      <div>
                        <h5 className="font-bold text-yellow-100 text-sm sm:text-base">10,000 Chips 즉시 지급!</h5>
                        <p className="text-xs sm:text-sm text-white/50 mt-1">상점에서 플렉스할 수 있는 넉넉한 칩을 즉시 드립니다.</p>
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-4 hover:border-pink-500/50 hover:bg-white/10 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0 border border-pink-500/30">
                        <ShoppingBag className="w-5 h-5 text-pink-400" />
                      </div>
                      <div>
                        <h5 className="font-bold text-pink-100 text-sm sm:text-base">프리미엄 상점 100% 개방</h5>
                        <p className="text-xs sm:text-sm text-white/50 mt-1">고급 참가자 스킨, 화려한 배경, 특별한 맵 프레임을 구매하세요.</p>
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-4 hover:border-cyan-500/50 hover:bg-white/10 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 border border-cyan-500/30">
                        <Map className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <h5 className="font-bold text-cyan-100 text-sm sm:text-base">맵 에디터 무제한 접근</h5>
                        <p className="text-xs sm:text-sm text-white/50 mt-1">직접 커스텀 맵을 제작하고, 커스텀 맵 스토어에 배포해보세요! 유저들이 다운하는 횟수당 100 chip을 얻을 수 있습니다.</p>
                      </div>
                    </div>
                  </div>

                  {/* 등업 방법 섹션 */}
                  <div className="relative">
                    <h4 className="text-purple-400 font-bold text-sm tracking-widest uppercase mb-4 flex items-center gap-2">
                      <div className="w-4 h-1 bg-purple-400 rounded-full"></div>
                      프리미엄 등급 UP 하는 방법!
                    </h4>

                    <div className="bg-black/50 border border-purple-500/30 rounded-2xl p-5 space-y-5">
                      {/* Step 1 */}
                      <div className="flex gap-4 relative">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/50 shrink-0 z-10">
                          <span className="font-black text-purple-300 text-sm">1</span>
                        </div>
                        <div className="absolute top-8 left-4 bottom-[-20px] w-[2px] bg-purple-500/20"></div>
                        <div className="pt-1">
                          <h6 className="font-bold text-white text-sm">홍보 글 작성하기</h6>
                          <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
                            블로그, 인스타그램 등 SNS나 인디스쿨에 롤링썬더를 널리 홍보하는 멋진 글을 작성해 주세요!
                          </p>
                          <div className="flex gap-2 mt-2">
                            <span className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-[10px] px-2 py-1 rounded-md"><Coffee className="w-3 h-3" /> 카페</span>
                            <span className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-[10px] px-2 py-1 rounded-md"><Share2 className="w-3 h-3" /> SNS</span>
                            <span className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-[10px] px-2 py-1 rounded-md"><GraduationCap className="w-3 h-3" /> 인디스쿨</span>
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-4 relative">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/50 shrink-0 z-10">
                          <span className="font-black text-purple-300 text-sm">2</span>
                        </div>
                        <div className="absolute top-8 left-4 bottom-[-20px] w-[2px] bg-purple-500/20"></div>
                        <div className="pt-1 w-full">
                          <h6 className="font-bold text-white text-sm">인증 이메일 보내기</h6>
                          <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
                            작성하신 글의 링크를 아래 이메일로 보내주시면 확인 후 1~2일 이내에 등급을 올려드립니다!
                          </p>
                          <div className="mt-3 space-y-2">
                            {/* Email */}
                            <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-purple-400" />
                                <span className="text-xs font-mono text-purple-300 font-bold">rudgnswh12@naver.com</span>
                              </div>
                              <button
                                onClick={() => handleCopy('rudgnswh12@naver.com', '이메일 주소')}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
                                title="이메일 복사"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Title */}
                            <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold">제목</span>
                                <span className="text-xs font-mono text-white/80">롤링썬더 프리미엄 등급 요청</span>
                              </div>
                              <button
                                onClick={() => handleCopy('롤링썬더 프리미엄 등급 요청', '제목')}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
                                title="제목 복사"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Content */}
                            <div className="flex items-start justify-between bg-white/5 border border-white/10 rounded-xl p-3">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold mt-0.5">내용</span>
                                <div className="text-xs font-mono text-white/60 leading-relaxed">
                                  - 이름:<br />
                                  - 아이디:<br />
                                  - 링크 주소: (홍보 글 링크)
                                </div>
                              </div>
                              <button
                                onClick={() => handleCopy('- 이름:\n- 아이디:\n- 링크 주소: ', '내용 양식')}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors mt-0.5"
                                title="내용 복사"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 3 (완료) */}
                      <div className="flex gap-4 relative">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/50 shrink-0 z-10">
                          <span className="font-black text-green-400 text-sm">3</span>
                        </div>
                        <div className="pt-1 w-full">
                          <h6 className="font-bold text-green-300 text-sm flex items-center gap-2">
                            완료!
                            <span className="text-[10px] font-normal text-green-300/60">(확인까지 1~2일 소요)</span>
                          </h6>
                        </div>
                      </div>

                    </div>
                  </div>

                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={onClose}
                      className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-xl transition-colors border border-white/10"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
