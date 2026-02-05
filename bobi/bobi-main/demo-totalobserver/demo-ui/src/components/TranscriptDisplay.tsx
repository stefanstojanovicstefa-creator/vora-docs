import React, { useEffect, useRef } from 'react';
import type { TranscriptMessage } from '../types';

interface Props {
  transcripts: TranscriptMessage[];
}

export function TranscriptDisplay({ transcripts }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  return (
    <div className="h-full bg-white rounded-lg shadow-lg p-4 overflow-y-auto">
      <h2 className="text-lg font-bold mb-4 text-totalobserver-dark">
        📝 Live Transcript
      </h2>
      <div className="space-y-3">
        {transcripts.map((t, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg ${
              t.speaker === 'User'
                ? 'bg-blue-50 ml-8'
                : 'bg-gray-50 mr-8'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm text-totalobserver-dark">
                {t.speaker === 'User' ? '👤 Korisnik' : '🤖 Agent'}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(t.timestamp).toLocaleTimeString('sr-RS')}
              </span>
            </div>
            <p className="text-gray-800">{t.text}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {transcripts.length === 0 && (
        <p className="text-gray-400 text-center mt-8">
          Čekam govor...
        </p>
      )}
    </div>
  );
}
