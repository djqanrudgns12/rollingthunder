'use client';
import { useState, useRef } from 'react';

// ZzFX Micro Engine
let zzfxV = 0.5; // Master Volume
let zzfxX: AudioContext;
const zzfx = (...t: any[]) => zzfxP(zzfxG(...t));
const zzfxP = (...t: any[]) => {
  let e = zzfxX.createBufferSource(), f = zzfxX.createBuffer(t.length, t[0].length, 44100);
  t.map((t, e) => f.getChannelData(e).set(t));
  e.buffer = f; e.connect(zzfxX.destination); e.start(); return e;
};
const zzfxG = (q=1,k=.05,c=220,e=0,t=0,u=.1,r=0,F=1,v=0,z=0,w=0,A=0,l=0,B=0,x=0,m=0,d=0,y=1,n=0,C=0) => {
  let b=2*Math.PI,H=v*=500*b/44100**2,I=(0<x?1:-1)*b/4,D=c*=(1+2*k*Math.random()-k)*b/44100,Z=[],g=0,E=0,a=0,n_=1,J=0,K=0,f=0,p,h;e=99+44100*e;m*=44100;t*=44100;u*=44100;d*=44100;y*=500*b/44100**3;x*=b/44100;w*=b/44100;A*=44100;l=44100*l|0;for(h=e+t+u+m+d,p=0;p<h;p++)Z[p]=0;for(p=0;p<h;p++){Z[p]=0;a=++a%100,a=r?a>n?1:-1:Math.sin(a*b/100),g+=D+=v+=y,E=g+I*Math.sin(E*x),f=(p<e?p/e:p<e+t?1:p<e+t+u?1-(p-e-t)/u:p<e+t+u+m?0:p<e+t+u+m+d?1-(p-e-t-u-m)/d:0)*Math.abs(Math.sin(E)),f=B?f*(1-B+B*Math.sin(b*p/C)):f,f=C?f*(1-C+C*Math.sin(b*p/l)):f,J+=f,K+=f,n_=p?Math.min(1,n_+A):0;Z[p]=a*f*n_*q;D+=H;}return[Z]
};

const soundData = [
  {
    id: 'gimmick_funnel', name: 'Funnel (깔때기 흡입)', desc: '빨려 들어가는 슬라이드 파동',
    options: [
      { name: '스우시 흡입', param: [1.2,undefined,200,undefined,.05,.2,1,1.5,undefined,undefined,-100,undefined,.05,undefined,undefined,undefined,undefined,undefined,.5] },
      { name: '휘리릭 다운', param: [1,undefined,150,.01,.1,.3,1,1.1,-2,undefined,undefined,-0.1,.1,undefined,undefined,undefined,undefined,undefined,.5] },
      { name: '코믹 슉~', param: [1.5,undefined,800,.1,.1,.4,2,2.5,-5,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,.6] }
    ]
  },
  {
    id: 'gimmick_pipe', name: 'Pipe (파이프 통과)', desc: '기계 파이프를 타고 이동하는 소리',
    options: [
      { name: '파이프 공명음', param: [1.5,undefined,300,.02,.05,.1,1,1.5,-1,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,.1] },
      { name: '철그럭 이동', param: [1.5,undefined,500,.01,.01,.2,0,1,-3,undefined,undefined,undefined,.1,undefined,undefined,undefined,undefined,undefined,.1] },
      { name: '빠른 압축 이동', param: [1.5,undefined,150,.01,.1,.2,1,2,-1,-5,.1,.05,undefined,undefined,undefined,undefined,undefined,undefined,.1] }
    ]
  },
  {
    id: 'gimmick_domino', name: 'Bumper (범퍼 타격)', desc: '탄성으로 튕겨 나가는 도미노/범퍼',
    options: [
      { name: '통통 튀는 보잉', param: [1.5,undefined,100,undefined,.05,.1,0,1,10,-5,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,.5] },
      { name: '경쾌한 범퍼 팝', param: [1.5,undefined,400,undefined,.02,.15,1,1,5,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,.1] },
      { name: '플라스틱 팅', param: [1.5,undefined,200,.01,.05,.1,2,0.5,2,undefined,undefined,undefined,.1,undefined,undefined,undefined,undefined,.5] }
    ]
  },
  {
    id: 'env_wormhole', name: 'Wormhole (웜홀 워프)', desc: '공간을 뚫고 워프하는 이펙트',
    options: [
      { name: '우주 차원 이동', param: [1.5,undefined,100,.1,.5,1,2,3,-1,-1,undefined,.1,undefined,.1,undefined,undefined,undefined,.1,.8] },
      { name: '디지털 워프', param: [1.5,undefined,300,.2,.8,.5,1,0.5,-5,5,.1,.1,undefined,.5,undefined,undefined,undefined,.5,.5] },
      { name: '블랙홀 흡입음', param: [1.5,undefined,50,.5,1,1.5,3,2,1,-1,.2,.2,undefined,undefined,undefined,undefined,undefined,.5,.5] }
    ]
  },
  {
    id: 'skill_tank', name: 'Skill: TANK (탱크)', desc: '무겁고 육중한 변신음',
    options: [
      { name: '대지진 크래시', param: [2,undefined,50,.05,.1,.5,3,0,-2,undefined,undefined,undefined,.1,undefined,.5,undefined,undefined,undefined,.5] },
      { name: '금속성 파괴', param: [2,undefined,80,.01,.05,.4,3,1.5,-5,undefined,undefined,undefined,-0.1,.1,.8,undefined,undefined,undefined,.2] },
      { name: '둔탁한 변환', param: [2,undefined,120,.02,.05,.6,4,0.5,-3,undefined,undefined,undefined,.1,.05,.4,undefined,undefined,undefined,.1] }
    ]
  },
  {
    id: 'skill_slime', name: 'Skill: SLIME (슬라임)', desc: '끈적하고 물컹거리는 액체음',
    options: [
      { name: '몽글몽글 슬라임', param: [1.5,undefined,250,.01,.1,.2,0,1.5,5,-5,.1,.05,undefined,undefined,undefined,undefined,undefined,undefined,.5] },
      { name: '스플래시 점프', param: [1.5,undefined,400,.02,.1,.3,2,2,-2,10,.05,.1,.1,undefined,undefined,undefined,.1] },
      { name: '진득한 변환', param: [1.5,undefined,150,.05,.05,.15,1,0.5,8,-2,.1,.1,undefined,undefined,undefined,undefined,.8] }
    ]
  },
  {
    id: 'skill_ghost', name: 'Skill: GHOST (고스트)', desc: '반투명 유령화 되는 신비한 소리',
    options: [
      { name: '페이즈 쉬프트', param: [1.5,undefined,800,.1,.3,.5,1,0.5,undefined,undefined,-50,undefined,.05,undefined,.5,undefined,.1,.8] },
      { name: '공명하는 영혼', param: [1.5,undefined,600,.2,.5,.8,2,1.5,1,-2,.1,.1,.1,.2,undefined,.2,.5] },
      { name: '마법화 스르륵', param: [1.5,undefined,1200,.05,.2,.4,3,2,-1,2,.05,.05,undefined,.8,undefined,.1,.6] }
    ]
  },
  {
    id: 'skill_magnet', name: 'Skill: MAGNET (마그넷)', desc: '자성을 띠며 강하게 끌어당기는 소리',
    options: [
      { name: '전자기 펄스', param: [1.5,undefined,400,.01,.1,.3,1,0,10,10,-100,.05,.5,undefined,.5] },
      { name: '전류 스파크', param: [1.5,undefined,200,.05,.2,.2,3,1,-5,5,.1,.1,.8,undefined,.1] },
      { name: '징~ 코일 가동', param: [1.5,undefined,500,.01,.05,.4,2,2,-2,2,.01,.05,.2,undefined,.2] }
    ]
  },
  {
    id: 'skill_teleport', name: 'Skill: TELEPORT (텔레포트)', desc: '시공간 도약음',
    options: [
      { name: '순간이동 슉', param: [1.5,undefined,600,.01,.05,.3,1,2,-10,undefined,.1,.05,undefined,undefined,undefined,undefined,.5] },
      { name: '디지털 트랜스퍼', param: [1.5,undefined,800,.05,.1,.4,3,1.5,-5,5,.05,.1,.1,undefined,.2] },
      { name: '공간 찢어짐', param: [1.5,undefined,400,.02,.05,.2,0,3,10,-10,.01,.05,undefined,undefined,undefined,.1] }
    ]
  },
  {
    id: 'skill_booster', name: 'Skill: BOOSTER (부스터)', desc: '가속 엔진 폭발 및 바람소리',
    options: [
      { name: '제트 가동', param: [1.5,undefined,200,.1,.2,.4,4,1,5,undefined,.1,.1,.5,undefined,.2] },
      { name: '레이저 부스트', param: [1.5,undefined,100,.05,.1,.3,3,2,10,-5,.05,.05,.2,undefined,.1] },
      { name: '바람 가르기', param: [1.5,undefined,300,.1,.3,.5,1,0.5,2,2,undefined,undefined,undefined,.8,undefined,.5] }
    ]
  },
  {
    id: 'ui_click', name: 'UI: 기본 클릭', desc: '메뉴 버튼 클릭음',
    options: [
      { name: '단순한 블립', param: [1.5,undefined,800,undefined,.01,.02,1,0,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,.1] },
      { name: '부드러운 똑', param: [1.5,undefined,1200,undefined,.01,.05,0,0,5,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,.1] },
      { name: '전자 띡', param: [1.5,undefined,600,undefined,.02,.05,2,0.5,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,.1] }
    ]
  },
  {
    id: 'ui_nudge', name: 'UI: 넛지 (보드 툭 치기)', desc: '게임판을 흔드는 둔탁한 소리',
    options: [
      { name: '육중한 쿵', param: [1.5,undefined,150,undefined,.01,.05,3,0,-2,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,.1] },
      { name: '딱딱한 나무 타격', param: [1.5,undefined,200,undefined,.02,.08,1,1,-5,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,.1] },
      { name: '묵직한 플라스틱', param: [1.5,undefined,100,undefined,.01,.03,0,0,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,.1] }
    ]
  },
  {
    id: 'ui_door_slam', name: 'UI: 팝업 / 화면 등장', desc: '강력하고 압도적인 도어 클로즈',
    options: [
      { name: '메탈 쾅', param: [1.5,undefined,80,undefined,.02,.2,3,0,-1,undefined,undefined,undefined,.1,undefined,.5] },
      { name: '노이즈 셔터음', param: [1.5,undefined,100,.01,.05,.3,4,1,-2,undefined,undefined,undefined,.05,undefined,.2] },
      { name: '둔탁한 슬램', param: [1.5,undefined,60,.02,.08,.4,3,0.5,-5,undefined,undefined,undefined,-0.1,.1,.4] }
    ]
  },
  {
    id: 'ui_fanfare', name: 'UI: 완주 / 팡파레', desc: '골인 및 승리 축하 사운드',
    options: [
      { name: '아케이드 승리음', param: [1.5,undefined,600,.05,.2,.5,0,1,1,-1,undefined,.05,undefined,.1,undefined,.5] },
      { name: '상승 차임', param: [1.5,undefined,800,.1,.3,.6,1,2,2,-2,undefined,.1,.1,.2,undefined,.5] },
      { name: '영롱한 클리어', param: [1.5,undefined,1000,.02,.1,.4,0,3,-1,1,undefined,.05,.2,.1,undefined,.6] }
    ]
  }
];

export default function SoundTestPage() {
  const [selections, setSelections] = useState<Record<string, any>>({});

  const initAudio = () => {
    if (!zzfxX) {
      zzfxX = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (zzfxX.state === 'suspended') {
      zzfxX.resume();
    }
  };

  const playSound = (param: any[]) => {
    initAudio();
    zzfx(...param);
  };

  const handleSelect = (categoryId: string, param: any[]) => {
    setSelections(prev => ({ ...prev, [categoryId]: param }));
  };

  const handleExport = () => {
    if (Object.keys(selections).length < 14) {
      alert('아직 선택하지 않은 항목이 있습니다. 14개를 모두 선택해 주세요!');
      return;
    }
    navigator.clipboard.writeText(JSON.stringify(selections, null, 2));
    alert('설정이 복사되었습니다! 채팅창에 붙여넣어 주세요.');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8 pb-32 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-4">
            ZzFX Algorithm Sound Director
          </h1>
          <p className="text-gray-400 text-lg">Web Audio API가 브라우저 자체적으로 즉시 합성해 내는 효과음입니다.</p>
          <p className="text-red-400 text-sm mt-2 font-bold">※ 채팅창 아티팩트가 아닌 직접 띄운 페이지이므로 오디오 제한(샌드박스)이 풀려 100% 무조건 소리가 납니다!</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {soundData.map(item => {
            const isCompleted = !!selections[item.id];
            return (
              <div key={item.id} className={`p-6 rounded-xl border transition-colors ${isCompleted ? 'border-green-500/50 bg-green-900/20' : 'border-gray-800 bg-gray-800/50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">{item.name}</h2>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                  {isCompleted && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold border border-green-500/50">
                      선택 완료
                    </span>
                  )}
                </div>
                
                <div className="space-y-3">
                  {item.options.map((opt, idx) => {
                    const isSelected = JSON.stringify(selections[item.id]) === JSON.stringify(opt.param);
                    return (
                      <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${isSelected ? 'border-green-500 bg-green-900/40' : 'border-gray-700 bg-gray-900/50'}`}>
                        <button 
                          onClick={() => playSound(opt.param)}
                          className="w-10 h-10 bg-green-600 hover:bg-green-500 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                        >
                          ▶
                        </button>
                        <div className="flex-1">
                          <p className={`font-medium ${isSelected ? 'text-green-300' : 'text-gray-300'}`}>{opt.name}</p>
                        </div>
                        <button 
                          onClick={() => handleSelect(item.id, opt.param)}
                          className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${isSelected ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)] border border-purple-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        >
                          {isSelected ? '✓ 선택됨' : '선택하기'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur border-t border-gray-800 p-6 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-white">진행률</h3>
            <p className="text-gray-400">{Object.keys(selections).length} / 14 항목 선택됨</p>
          </div>
          <button 
            onClick={handleExport}
            className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105"
          >
            결과값 복사하기
          </button>
        </div>
      </div>
    </div>
  );
}
