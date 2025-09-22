import type { LucideIcon } from 'lucide-react';

export interface LevelInfo {
  level: number;
  title: string;
  icon: string; // Changed from LucideIcon to string for image URL
  xpThreshold: number;
}

const baseXp = 100;
const growthFactor = 1.2;

const levelTitles: string[] = [
    '새싹 학습자', '첫걸음마 독서가', '메모하는 연습생', '질문하는 아이', '호기심 많은 탐험가',
    '아이디어 도전자', '꾸준한 노력가', '지식의 씨앗', '개념 이해자', '배움의 지도',
    '성실한 기록가', '노력의 별', '열정의 불꽃', '성장의 로켓', '집중의 명수',
    '문제 해결사', '실험하는 과학자', '논리의 탐구자', '지식의 마법사', '데이터 분석가',
    '구조 설계자', '정보 수집가', '지식의 조각가', '유레카 발명가', '지혜의 깃털',
    '인용의 달인', '토론의 참여자', '핵심의 열쇠', '숨은 보석 발굴가', '지식의 연결고리',
    'AI 조련사', '디지털 학자', '패턴 인식가', '통찰의 관찰자', '지식의 건축가',
    '정리의 고수', '문제의 분해자', '가설 검증자', '배움의 항해사', '학습 전략가',
    '지식의 은하수', '성장의 증명', '탐구의 챔피언', '지혜의 샘', '사고의 확장자',
    '지식의 연금술사', '정복의 이정표', '빛나는 다이아', '타오르는 학구열', '지식의 정복자',
    '책속의 현자', '연구의 선구자', '토론의 지배자', '지식의 수호자', '깨달음의 순간',
    '논리의 마스터', '지식의 나무', '달콤한 지식', '지혜의 왕관', '학사모'
];

// Fill up to 100 levels
const extendedLevelTitles = [...levelTitles];
const baseLevelCount = levelTitles.length;
for (let i = baseLevelCount; i < 100; i++) {
  const baseIndex = i % baseLevelCount;
  extendedLevelTitles.push(`${levelTitles[baseIndex]} +${Math.floor(i / baseLevelCount)}`);
}

export const levelSystem: LevelInfo[] = extendedLevelTitles.map((title, i) => {
  const xpThreshold = Math.floor(baseXp * Math.pow(growthFactor, i));
  return {
    title,
    level: i + 1,
    xpThreshold,
    icon: `https://picsum.photos/seed/level-${i + 1}/100/100`, // Unique image for each level
  };
});

export const getMaxLevel = () => levelSystem[levelSystem.length - 1].level;

export const getLevelInfo = (xp: number): LevelInfo => {
  let currentLevel: LevelInfo = levelSystem[0];
  for (const level of levelSystem) {
    if (xp >= level.xpThreshold) {
      currentLevel = level;
    } else {
      break;
    }
  }
  return currentLevel;
};

export const getNextLevelInfo = (currentLevel: number): LevelInfo | null => {
  if (currentLevel >= getMaxLevel()) {
    return null;
  }
  return levelSystem.find(l => l.level === currentLevel + 1) || null;
};
