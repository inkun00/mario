import {
  Sprout,
  Book,
  Pencil,
  Lightbulb,
  Search,
  Target,
  Brain,
  Award,
  Trophy,
  GraduationCap,
  Sparkles,
  Star,
  Flame,
  Rocket,
  Gem,
  Key,
  Map,
  Compass,
  Puzzle,
  FlaskConical,
  Atom,
  Dna,
  Bot,
  Laptop,
  BookOpen,
  Library,
  PenTool,
  Feather,
  Quote,
  MessageSquare,
  Users,
  ClipboardList,
  CheckCircle,
  TrendingUp,
  BarChart,
  PieChart,
  BrainCircuit,
  Milestone,
  Crown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface LevelInfo {
  level: number;
  title: string;
  icon: LucideIcon;
  xpThreshold: number;
}

const baseXp = 100;
const growthFactor = 1.2;

const levels: Omit<LevelInfo, 'level' | 'xpThreshold'>[] = [
  { title: '새싹 학습자', icon: Sprout },
  { title: '첫걸음마 독서가', icon: Book },
  { title: '메모하는 연습생', icon: Pencil },
  { title: '질문하는 아이', icon: MessageSquare },
  { title: '호기심 많은 탐험가', icon: Search },
  { title: '아이디어 도전자', icon: Lightbulb },
  { title: '꾸준한 노력가', icon: TrendingUp },
  { title: '지식의 씨앗', icon: BookOpen },
  { title: '개념 이해자', icon: CheckCircle },
  { title: '배움의 길잡이', icon: Map },
  { title: '성실한 기록가', icon: ClipboardList },
  { title: '지식의 탐험가', icon: Compass },
  { title: '노력의 별', icon: Star },
  { title: '열정의 불꽃', icon: Flame },
  { title: '성장의 로켓', icon: Rocket },
  { title: '집중하는 학생', icon: Target },
  { title: '문제 해결사', icon: Puzzle },
  { title: '실험하는 과학자', icon: FlaskConical },
  { title: '논리의 탐구자', icon: Brain },
  { title: '지식의 마법사', icon: Sparkles },
  { title: '데이터 분석가', icon: BarChart },
  { title: '구조 설계자', icon: Atom },
  { title: '정보 수집가', icon: Library },
  { title: '지식의 조각가', icon: PenTool },
  { title: '유레카 발명가', icon: Lightbulb },
  { title: '지혜의 깃털', icon: Feather },
  { title: '인용의 달인', icon: Quote },
  { title: '토론의 참여자', icon: Users },
  { title: '핵심 파악자', icon: Key },
  { title: '숨은 보석 발굴가', icon: Gem },
  { title: '지식의 연결고리', icon: Dna },
  { title: 'AI 조련사', icon: Bot },
  { title: '디지털 학자', icon: Laptop },
  { title: '패턴 인식가', icon: PieChart },
  { title: '통찰의 관찰자', icon: BrainCircuit },
  { title: '지식의 건축가', icon: Library },
  { title: '정리의 고수', icon: ClipboardList },
  { title: '문제의 분해자', icon: Puzzle },
  { title: '가설 검증자', icon: CheckCircle },
  { title: '배움의 항해사', icon: Compass },
  { title: '학습 전략가', icon: Target },
  { title: '지식의 은하수', icon: Sparkles },
  { title: '성장의 증명', icon: Award },
  { title: '탐구의 챔피언', icon: Trophy },
  { title: '지혜의 샘', icon: FlaskConical },
  { title: '사고의 확장자', icon: Brain },
  { title: '지식의 연금술사', icon: Atom },
  { title: '정복의 이정표', icon: Milestone },
  { title: '빛나는 지성', icon: Star },
  { title: '타오르는 학구열', icon: Flame },
  { title: '지식의 정복자', icon: Rocket },
  { title: '책속의 현자', icon: BookOpen },
  { title: '연구의 선구자', icon: Search },
  { title: '토론의 지배자', icon: Users },
  { title: '지식의 수호자', icon: Key },
  { title: '깨달음의 순간', icon: Lightbulb },
  { title: '논리의 마스터', icon: BrainCircuit },
];

// Fill up to 100 levels
const baseLevelCount = levels.length;
for (let i = baseLevelCount; i < 100; i++) {
  const baseIndex = i % baseLevelCount;
  levels.push({
    ...levels[baseIndex],
    title: `${levels[baseIndex].title} +${Math.floor(i / baseLevelCount)}`,
  });
}

export const levelSystem: LevelInfo[] = levels.slice(0, 100).map((level, i) => {
  const xpThreshold = Math.floor(baseXp * Math.pow(growthFactor, i));
  return {
    ...level,
    level: i + 1,
    xpThreshold,
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
