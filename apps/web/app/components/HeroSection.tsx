export function HeroSection() {
  return (
    <div className="flex flex-col items-center space-y-6 text-center py-8">
      <div className="relative w-32 h-32 rounded-full overflow-hidden bg-linear-to-br from-primary/20 to-secondary/20 border-4 border-primary/10">
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-6xl">🧗</span>
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold">볼더링 파티 게임</h1>
        <p className="text-lg text-muted-foreground">친구들과 함께하는 특별한 클라이밍 경험</p>
      </div>
    </div>
  );
}
