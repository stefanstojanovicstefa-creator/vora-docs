
interface Props {
  active: boolean;
}

export function VoiceWaveform({ active }: Props) {
  return (
    <div className="flex items-center justify-center gap-1 h-32">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className={`w-3 bg-totalobserver-blue rounded-full transition-all duration-300 ${
            active ? 'animate-pulse' : ''
          }`}
          style={{
            height: active ? `${Math.random() * 80 + 20}%` : '20%',
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}
