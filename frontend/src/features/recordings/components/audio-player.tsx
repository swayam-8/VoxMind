import { useState, useEffect, useRef } from "react";
import {
  AudioLines,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  durationSeconds: number;
  currentTime: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackRate?: number;
  onChangePlaybackRate?: (rate: number) => void;
  title?: string;
  className?: string;
  audioSrc?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Precomputed deterministic heights for waveform visualization
const WAVEFORM_HEIGHTS: number[] = Array.from({ length: 48 }, (_, i) => {
  const v = Math.sin(i * 0.4) * 35 + Math.cos(i * 0.8) * 25 + 40;
  return Math.max(15, Math.min(90, Math.round(v)));
});

export function AudioPlayer({
  durationSeconds,
  currentTime,
  onSeek,
  isPlaying,
  onTogglePlay,
  playbackRate = 1.0,
  onChangePlaybackRate,
  title,
  className,
  audioSrc,
  onTimeUpdate,
}: AudioPlayerProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [internalRate, setInternalRate] = useState(playbackRate);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync HTML5 audio element with React playback state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {
        // Autoplay policy or media load in progress
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, audioSrc]);

  // Sync seek events to audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (Math.abs(audio.currentTime - currentTime) > 0.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  // Sync rate and mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = internalRate;
    audio.muted = isMuted;
  }, [internalRate, isMuted]);

  const progressPercent =
    durationSeconds > 0 ? (currentTime / durationSeconds) * 100 : 0;

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || durationSeconds <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newPercent = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(newPercent * durationSeconds);
  };

  const handleSkip = (seconds: number) => {
    const nextTime = Math.max(
      0,
      Math.min(durationSeconds, currentTime + seconds),
    );
    onSeek(nextTime);
  };

  const handleRateChange = (rate: number) => {
    setInternalRate(rate);
    onChangePlaybackRate?.(rate);
  };

  // Keyboard shortcut listener for spacebar play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only toggle if user is not typing in an input
      if (
        e.code === "Space" &&
        !(e.target instanceof Element && e.target.closest('input, textarea, button, a, select, [role="tab"], [contenteditable="true"]'))
      ) {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTogglePlay]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-1 p-3.5 sm:p-5 shadow-sm space-y-3 sm:space-y-4 min-w-0 max-w-full",
        className,
      )}
    >
      {/* Hidden native HTML5 audio element for actual sound playback */}
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onLoadedMetadata={() => {
            if (audioRef.current && currentTime > 0) audioRef.current.currentTime = currentTime;
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              onTimeUpdate?.(audioRef.current.currentTime);
            }
          }}
          onEnded={() => {
            onTogglePlay();
            onSeek(0);
          }}
        />
      )}

      {/* Title & Status */}
      {title && (
        <div className="flex items-center justify-between border-b border-border/50 pb-2.5 gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <h4 className="player-eyebrow text-xs font-semibold text-text-muted uppercase tracking-wider">
              <AudioLines aria-hidden="true" /> Audio playback
            </h4>
            <p className="text-sm sm:text-sm font-medium text-text-primary truncate mt-0.5">
              {title}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-mono text-text-secondary shrink-0">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(durationSeconds)}</span>
          </div>
        </div>
      )}

      {/* Interactive Waveform Display */}
      <div
        ref={progressBarRef}
        onClick={handleProgressBarClick}
        className="player-waveform group relative h-12 sm:h-16 w-full cursor-pointer flex items-end justify-between gap-0.5 sm:gap-1 px-1 select-none overflow-hidden rounded-md bg-surface-2/60 border border-border/40 py-2 hover:border-accent/40 transition-colors"
        title="Click to seek in recording"
      >
        {WAVEFORM_HEIGHTS.map((height, idx) => {
          const barPercent = (idx / WAVEFORM_HEIGHTS.length) * 100;
          const isPlayed = barPercent <= progressPercent;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col justify-end h-full items-center"
            >
              <div
                style={{ height: `${height}%`, animationDelay: `${idx * -71}ms` }}
                className={cn(
                  "w-full rounded-xs transition-colors duration-150",
                  isPlaying && "audio-wave-playing",
                  isPlayed
                    ? "bg-accent shadow-xs shadow-accent/20"
                    : "bg-surface-3 group-hover:bg-border",
                )}
              />
            </div>
          );
        })}

        {/* Playhead Indicator Line */}
        <div
          style={{ left: `${progressPercent}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-accent-foreground shadow-sm shadow-accent pointer-events-none transition-all duration-75"
        >
          <div className="h-2 w-2 rounded-full bg-accent absolute -top-1 -left-[3px] ring-2 ring-surface-1" />
        </div>
      </div>

      {/* Playback Controls Row */}
      <div className="player-controls flex flex-wrap items-center justify-between gap-2.5 pt-1">
        {/* Play / Skip Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleSkip(-10)}
            className="h-8 w-8 text-text-secondary hover:text-text-primary"
            aria-label="Skip backward 10 seconds"
          >
            <RotateCcw className="h-5 w-5 sm:h-5 sm:w-5" />
          </Button>

          <Button
            variant="default"
            size="icon"
            onClick={onTogglePlay}
            className="player-play-button h-9 w-9 sm:h-10 sm:w-10 rounded-full shadow-md"
            aria-label={isPlaying ? "Pause playback" : "Play audio recording"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 sm:h-5 sm:w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 sm:h-5 sm:w-5 fill-current ml-0.5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => handleSkip(10)}
            className="h-8 w-8 text-text-secondary hover:text-text-primary"
            aria-label="Skip forward 10 seconds"
          >
            <RotateCw className="h-5 w-5 sm:h-5 sm:w-5" />
          </Button>

          <span className="text-xs font-mono text-text-muted hidden md:inline ml-2">
            Space to {isPlaying ? "pause" : "play"}
          </span>
        </div>

        {/* Speed & Volume Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2 sm:px-2.5 font-mono text-sm text-text-primary"
              >
                {internalRate}x
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <DropdownMenuItem
                  key={rate}
                  onClick={() => handleRateChange(rate)}
                  className={cn(
                    "font-mono text-sm cursor-pointer",
                    internalRate === rate && "text-accent font-semibold",
                  )}
                >
                  {rate.toFixed(2)}x Speed
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className="h-8 w-8 text-text-secondary hover:text-text-primary"
            aria-label={isMuted ? "Unmute audio" : "Mute audio"}
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5 text-danger" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
