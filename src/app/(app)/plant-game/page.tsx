
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'SEED' | 'WATER';
  trail: { x: number; y: number }[];
}

interface GameItem {
  id: number;
  x: number;
  y: number;
  emoji: string;
  level: number;
}

const PlantGamePage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [angle, setAngle] = useState(45);
  const [isCharging, setIsCharging] = useState(false);
  const [chargePower, setChargePower] = useState(0);
  const [mode, setMode] = useState<'SEED' | 'WATER'>('SEED');
  const [gameItems, setGameItems] = useState<GameItem[]>([]);
  const [isFiring, setIsFiring] = useState(false);
  const [message, setMessage] = useState('스페이스바를 꾹 눌러 파워를 조절하세요!');

  // 게임 상수
  const WORLD_WIDTH = 2400; 
  const VIEWPORT_WIDTH = 800;
  const VIEWPORT_HEIGHT = 600;
  const GRAVITY = 0.22;
  const LAUNCHER_X = 100;
  const MAX_POWER = 100;
  const SPLASH_RADIUS = 120;
  const MAX_PLANT_LEVEL = 10;

  const PLANT_EMOJIS = [
    '🌳', '🌲', '🌴', '🎋', '🎍', '🌵', '🎄', '🌳', '🌲', '🌴',
    '🌹', '🌷', '🌸', '🌼', '🌻', '🌺', '🪻', '💐', '💮', '🏵️', '🪷', '🥀',
    '🌿', '☘️', '🍀', '🌾', '🪴', '🍄', '🌱', '🌿', '🌾'
  ];

  const projectileRef = useRef<Projectile | null>(null);
  const terrainRef = useRef<number[]>([]);
  const chargeRequestRef = useRef<number | null>(null);
  const cameraXRef = useRef(0);

  // 1. 지형 생성 (산악 지형)
  useEffect(() => {
    const terrain: number[] = [];
    for (let x = 0; x < WORLD_WIDTH; x++) {
      let height = 520;
      height -= Math.sin(x * 0.01) * 20; 
      if (x > 800) {
        const mountain = Math.pow((x - 800) * 0.06, 1.4);
        height -= Math.min(mountain, 400);
        height += Math.sin(x * 0.04) * 20; 
      }
      terrain[x] = height;
    }
    terrainRef.current = terrain;
  }, []);
  
  const handleCollision = useCallback((x: number, y: number, type: 'SEED' | 'WATER') => {
    const gridX = Math.min(WORLD_WIDTH - 1, Math.max(0, Math.floor(x)));
    const terrainY = terrainRef.current[gridX];

    if (type === 'SEED') {
      const randomEmoji = PLANT_EMOJIS[Math.floor(Math.random() * PLANT_EMOJIS.length)];
      setGameItems(prev => [...prev, {
        id: Date.now(),
        x: x,
        y: terrainY,
        emoji: randomEmoji,
        level: 1
      }]);
      setMessage('새로운 식물이 안착될 준비를 마쳤습니다!');
    } else if (type === 'WATER') {
      let hitCount = 0;
      setGameItems(prev => prev.map(item => {
        const dist = Math.sqrt(Math.pow(item.x - x, 2) + Math.pow(item.y - y, 2));
        if (dist < SPLASH_RADIUS) {
          hitCount++;
          return { ...item, level: Math.min(item.level + 1, MAX_PLANT_LEVEL) };
        }
        return item;
      }));
      setMessage(hitCount > 0 ? `${hitCount}개의 식물이 무럭무럭 자라납니다!` : '물폭탄이 땅을 적셨습니다.');
    }

    setTimeout(() => {
      setIsFiring(false);
      cameraXRef.current = 0;
      setChargePower(0);
      setMessage('준비 완료! 다시 스페이스바를 누르세요.');
    }, 1500);
  }, [PLANT_EMOJIS, SPLASH_RADIUS]);

  const fire = useCallback((power: number) => {
    setIsFiring(true);
    setMessage('발사!');
    const rad = (angle * Math.PI) / 180;
    const v0 = power * 0.38; 
    const startY = terrainRef.current[LAUNCHER_X] - 25;

    projectileRef.current = {
      x: LAUNCHER_X,
      y: startY,
      vx: Math.cos(rad) * v0,
      vy: -Math.sin(rad) * v0,
      type: mode,
      trail: []
    };
  }, [angle, mode]);
  
  // 2. 파워 차지 로직 (즉각적인 반응성)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isFiring && !isCharging && !e.repeat) {
        e.preventDefault();
        setIsCharging(true);
        setChargePower(1); 
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isCharging) {
        e.preventDefault();
        setIsCharging(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isFiring, isCharging]);

  // 발사 트리거
  useEffect(() => {
    if (!isCharging && chargePower > 0 && !isFiring) {
      fire(chargePower);
    }
  }, [isCharging, chargePower, isFiring, fire]);

  // 게이지 상승 애니메이션
  useEffect(() => {
    if (isCharging) {
      const updateCharge = () => {
        setChargePower(prev => {
          if (prev >= MAX_POWER) return MAX_POWER;
          return prev + 3.0; 
        });
        chargeRequestRef.current = requestAnimationFrame(updateCharge);
      };
      chargeRequestRef.current = requestAnimationFrame(updateCharge);
    } else {
        if(chargeRequestRef.current) {
            cancelAnimationFrame(chargeRequestRef.current);
        }
    }
    return () => {
        if(chargeRequestRef.current) {
            cancelAnimationFrame(chargeRequestRef.current);
        }
    }
  }, [isCharging]);

  // 4. 렌더링 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      ctx.save();
      ctx.translate(-cameraXRef.current, 0);

      // 4-1. 배경 (하늘)
      const sky = ctx.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
      sky.addColorStop(0, '#f0f9ff'); sky.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = sky;
      ctx.fillRect(cameraXRef.current, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

      // 4-2. 지형
      ctx.beginPath(); ctx.moveTo(0, VIEWPORT_HEIGHT);
      terrainRef.current.forEach((y, x) => ctx.lineTo(x, y));
      ctx.lineTo(WORLD_WIDTH, VIEWPORT_HEIGHT);
      ctx.fillStyle = '#2d1e12'; ctx.fill();
      
      ctx.beginPath(); terrainRef.current.forEach((y, x) => ctx.lineTo(x, y));
      ctx.strokeStyle = '#065f46'; ctx.lineWidth = 4; ctx.stroke();

      // 4-3. 발사대
      const lY = terrainRef.current[LAUNCHER_X];
      ctx.save(); ctx.translate(LAUNCHER_X, lY - 15); ctx.rotate((-angle * Math.PI) / 180);
      ctx.fillStyle = '#334155'; ctx.fillRect(0, -8, 60, 16);
      ctx.restore();
      ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(LAUNCHER_X, lY - 15, 22, 0, Math.PI*2); ctx.fill();

      // 4-4. 식물
      gameItems.forEach(item => {
        ctx.save();
        ctx.translate(item.x, item.y);
        const fontSize = 15 + (item.level * 38); 
        ctx.font = `${fontSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const wobble = Math.sin(Date.now() * 0.0015 + item.id) * 1.5;
        ctx.rotate(wobble * 0.01);
        ctx.fillText(item.level === 1 ? '🌱' : item.emoji, 0, 0);
        ctx.restore();
      });

      // 4-5. 투사체
      const proj = projectileRef.current;
      if (proj) {
        proj.x += proj.vx; proj.y += proj.vy; proj.vy += GRAVITY;
        proj.trail.push({x: proj.x, y: proj.y});
        if(proj.trail.length > 30) proj.trail.shift();

        ctx.beginPath(); proj.trail.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = proj.type === 'SEED' ? 'rgba(67, 20, 7, 0.3)' : 'rgba(14, 165, 233, 0.3)';
        ctx.lineWidth = 5; ctx.stroke();

        ctx.beginPath(); ctx.arc(proj.x, proj.y, 10, 0, Math.PI*2);
        ctx.fillStyle = proj.type === 'SEED' ? '#431407' : '#0284c7';
        ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        
        if (proj.type === 'WATER' && proj.y > terrainRef.current[Math.floor(proj.x)] - 150) {
          ctx.beginPath(); ctx.arc(proj.x, proj.y, SPLASH_RADIUS, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.1)'; ctx.fill();
        }

        cameraXRef.current = Math.max(0, Math.min(proj.x - VIEWPORT_WIDTH / 2, WORLD_WIDTH - VIEWPORT_WIDTH));

        const gx = Math.floor(proj.x);
        if (gx < 0 || gx >= WORLD_WIDTH || proj.y >= terrainRef.current[gx]) {
          const { x: fx, y: fy, type: ft } = proj;
          projectileRef.current = null;
          handleCollision(fx, fy, ft);
        }
      }

      ctx.restore();
      animationFrameId = window.requestAnimationFrame(render);
    };

    render();
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [angle, gameItems, mode, isCharging, handleCollision]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-4 font-sans text-slate-100">
      <div className="bg-slate-900 p-8 rounded-[4rem] shadow-2xl border-t-2 border-emerald-400 w-full max-w-6xl">
        <header className="flex justify-between items-center mb-8 px-6">
          <div className="flex flex-col">
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 tracking-tighter italic">MOUNTAIN FLORA GARDEN</h1>
            <span className="text-[11px] font-bold text-emerald-500/40 uppercase tracking-[0.4em] ml-1">Universal Plant Simulation</span>
          </div>
          <div className="bg-emerald-950/30 border border-emerald-500/10 py-3 px-8 rounded-[2rem] backdrop-blur-md shadow-2xl">
            <span className="text-emerald-400 font-bold text-base">{message}</span>
          </div>
        </header>
        
        <div className="relative rounded-[3rem] overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,1)] bg-white mb-10 border-[16px] border-slate-800 aspect-video">
          <canvas 
            ref={canvasRef} 
            width={VIEWPORT_WIDTH} 
            height={VIEWPORT_HEIGHT} 
            className="w-full h-full cursor-crosshair"
          />
          
          {isCharging && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[500px] px-6 py-4 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200">
              <div className="flex justify-between mb-3 text-slate-900 font-black text-xs uppercase tracking-[0.2em]">
                <span>Launch Intensity</span>
                <span className="text-rose-600 animate-pulse">{Math.round(chargePower)}%</span>
              </div>
              <div className="h-8 bg-slate-100 rounded-full overflow-hidden p-1.5 border-2 border-slate-200">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-600 rounded-full transition-all duration-75"
                  style={{ width: `${chargePower}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-center bg-slate-800/40 p-10 rounded-[3.5rem] border border-slate-700/50">
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <span className="text-emerald-400 font-black uppercase tracking-widest text-xs">Launch Angle</span>
              <span className="text-5xl font-mono font-bold text-white tracking-tighter">{angle}°</span>
            </div>
            <input 
              type="range" min="0" max="90" value={angle} 
              onChange={(e) => setAngle(parseInt(e.target.value))}
              className="w-full h-3 bg-slate-950 rounded-full appearance-none cursor-pointer accent-emerald-400"
            />
          </div>

          <div className="flex flex-col gap-4">
            <span className="text-center text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Payload System</span>
            <div className="grid grid-cols-2 gap-3 p-2 bg-slate-950/80 rounded-[2rem] border border-slate-700/50">
              <button 
                onClick={() => setMode('SEED')}
                className={`py-5 rounded-2xl font-black text-sm transition-all ${mode === 'SEED' ? 'bg-emerald-500 text-white shadow-[0_10px_25px_rgba(16,185,129,0.3)]' : 'text-slate-500 hover:text-slate-200'}`}
              >
                🌰 SEED
              </button>
              <button 
                onClick={() => setMode('WATER')}
                className={`py-5 rounded-2xl font-black text-sm transition-all ${mode === 'WATER' ? 'bg-cyan-500 text-white shadow-[0_10px_25px_rgba(6,182,212,0.3)]' : 'text-slate-500 hover:text-slate-200'}`}
              >
                💧 WATER
              </button>
            </div>
          </div>

          <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-700/40">
            <h4 className="font-black text-emerald-400 text-xs mb-4 uppercase tracking-[0.2em] border-b border-emerald-500/10 pb-3">Operational Manual</h4>
            <div className="text-[12px] text-slate-400 space-y-3 font-medium leading-relaxed">
              <p className="flex items-center gap-3"><span className="text-emerald-500 text-lg">●</span> <strong>[SPACE]</strong> 키를 즉각 활용하여 에너지를 모으세요.</p>
              <p className="flex items-center gap-3"><span className="text-emerald-500 text-lg">●</span> 온전한 형태의 나무, 꽃, 수풀 이모지만 엄선되었습니다.</p>
              <p className="flex items-center gap-3"><span className="text-emerald-500 text-lg">●</span> 물을 주어 산 중턱에 거대 식물 군락을 조성하세요.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlantGamePage;
