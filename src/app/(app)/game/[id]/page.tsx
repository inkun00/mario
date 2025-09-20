import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Player } from '@/lib/types';
import { Crown, HelpCircle, Shield, Star, Swords, Zap } from 'lucide-react';
import Image from 'next/image';

const players: Player[] = [
  { uid: '1', nickname: '슈퍼마리오', score: 15, avatarId: 'player-avatar-1' },
  { uid: '2', nickname: '피치공주', score: 22, avatarId: 'player-avatar-2' },
  { uid: '3', nickname: '요시', score: 10, avatarId: 'player-avatar-3' },
  { uid: '4', nickname: '키노피오', score: 18, avatarId: 'player-avatar-4' },
];

const questionBlockImage = PlaceHolderImages.find(p => p.id === 'question-block');
const answeredBlockImage = PlaceHolderImages.find(p => p.id === 'answered-block');

const questions = Array.from({ length: 25 }, (_, i) => ({
  id: `q${i+1}`,
  status: Math.random() > 0.7 ? 'answered' : 'available',
  points: Math.floor(Math.random() * 5) + 1,
}));


export default function GamePage({ params }: { params: { id: string } }) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const currentTurnPlayer = players[0];

  return (
    <div className="flex h-full max-h-[calc(100vh-4rem)] flex-col lg:flex-row gap-6">
      {/* Game Board */}
      <div className="flex-grow flex flex-col items-center justify-center p-6 bg-blue-100/50 dark:bg-blue-900/20 rounded-xl shadow-inner">
        <Card className="w-full max-w-4xl p-4 sm:p-6 bg-background/70 backdrop-blur-sm">
           <div className="text-center mb-6">
                <h2 className="text-2xl font-bold font-headline">
                    <span className="text-primary">{currentTurnPlayer.nickname}</span>님의 차례입니다!
                </h2>
                <p className="text-muted-foreground">점수를 얻을 질문을 선택하세요.</p>
            </div>
          <div className="grid grid-cols-5 gap-2 sm:gap-4">
            {questions.map((q) => (
              <div key={q.id} className="aspect-square relative group cursor-pointer transition-transform duration-300 hover:scale-105">
                <Image 
                    src={q.status === 'available' ? (questionBlockImage?.imageUrl || '') : (answeredBlockImage?.imageUrl || '')}
                    alt={q.status === 'available' ? 'Question Block' : 'Answered Block'}
                    fill
                    className="object-contain"
                    data-ai-hint={q.status === 'available' ? questionBlockImage?.imageHint : answeredBlockImage?.imageHint}
                />
                 {q.status === 'available' && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center bg-black/50 text-white font-bold rounded-full p-2">
                           <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 mr-1" />
                           <span>{q.points}</span>
                        </div>
                    </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Scoreboard & Info */}
      <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0">
        <Card className="h-full flex flex-col">
            <div className="p-4 border-b">
                <h2 className="font-headline text-xl font-bold text-center">스코어보드</h2>
            </div>
            <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                {sortedPlayers.map((player, index) => (
                    <div key={player.uid} className={`p-3 rounded-lg border-2 ${player.uid === currentTurnPlayer.uid ? 'border-primary shadow-lg bg-primary/10' : 'border-transparent'}`}>
                       <div className="flex items-center gap-3">
                            <div className="font-bold text-lg w-6 text-center text-muted-foreground">
                                {index === 0 ? <Crown className="w-5 h-5 mx-auto text-yellow-500" /> : index + 1}
                            </div>
                            <Image src={PlaceHolderImages.find(p => p.id === player.avatarId)?.imageUrl || ''} alt={player.nickname} width={40} height={40} className="rounded-full" data-ai-hint={PlaceHolderImages.find(p => p.id === player.avatarId)?.imageHint} />
                            <div className="flex-grow">
                                <p className="font-semibold">{player.nickname}</p>
                                <Progress value={(player.score / 50) * 100} className="h-2 mt-1" />
                            </div>
                            <div className="font-bold text-primary text-lg w-12 text-right">{player.score}</div>
                       </div>
                    </div>
                ))}
            </div>
            <div className="p-4 border-t bg-secondary/30">
                <h3 className="font-headline font-semibold mb-2 text-center">미스터리 박스 효과</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <Badge variant="outline" className="justify-center py-1"><Star className="w-3 h-3 mr-1.5"/> 점수 2배</Badge>
                    <Badge variant="outline" className="justify-center py-1"><Shield className="w-3 h-3 mr-1.5"/> 감점 방어</Badge>
                    <Badge variant="outline" className="justify-center py-1"><Swords className="w-3 h-3 mr-1.5"/> 점수 뺏기</Badge>
                    <Badge variant="outline" className="justify-center py-1"><Zap className="w-3 h-3 mr-1.5"/> 한 턴 쉬기</Badge>
                    <Badge variant="outline" className="justify-center py-1 col-span-2"><HelpCircle className="w-3 h-3 mr-1.5"/> ???</Badge>
                </div>
            </div>
        </Card>
      </aside>
    </div>
  );
}
