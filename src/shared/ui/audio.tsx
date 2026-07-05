import { Download, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCallAudioBlob, getCallAudioUrl } from "../../api";
import type { CallResponse } from "../../types";
import { formatDuration } from "../lib/formatters";

const playbackRates = [0.75, 1, 1.25, 1.5, 2];
const waveformBars = 72;
const fallbackWaveform = Array.from({ length: waveformBars }, (_, index) => {
  const wave = Math.sin(index * 0.68) * 0.22 + Math.sin(index * 1.73) * 0.14;
  return Math.max(0.2, Math.min(0.9, 0.54 + wave));
});

export function CallAudioPlayer({ call }: { call: CallResponse; }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const speedControlRef = useRef<HTMLDivElement | null>(null);
  const speedHoldTimerRef = useRef<number | null>(null);
  const speedLongPressRef = useRef(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioError, setAudioError] = useState("");
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [loadingWaveform, setLoadingWaveform] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(call.duration_seconds || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const source = useMemo(
    () => getCallAudioUrl(call),
    [
      call.id,
      call.audio_url,
      call.audio_download_url,
      call.file_url,
      call.media_url,
      call.recording_url,
      call.download_url
    ]
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    resetAudioElement(audioRef.current);
    setAudioUrl("");
    setAudioError("");
    setLoadingAudio(true);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(call.duration_seconds || 0);
    setAudioBlob(null);
    setWaveform([]);
    setLoadingWaveform(false);

    getCallAudioBlob(call)
      .then(async (blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(objectUrl);
        setLoadingWaveform(true);
        try {
          const peaks = await buildWaveform(blob, waveformBars);
          if (!cancelled) setWaveform(peaks);
        } catch {
          if (!cancelled) setWaveform([]);
        } finally {
          if (!cancelled) setLoadingWaveform(false);
        }
      })
      .catch((error) => {
        if (!cancelled) setAudioError(error instanceof Error ? error.message : "Аудио недоступно");
      })
      .finally(() => {
        if (!cancelled) setLoadingAudio(false);
      });

    return () => {
      cancelled = true;
      resetAudioElement(audioRef.current);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [call.duration_seconds, source]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [audioUrl, playbackRate]);

  useEffect(() => {
    if (!speedMenuOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (speedControlRef.current?.contains(event.target as Node)) return;
      setSpeedMenuOpen(false);
    }

    window.addEventListener("pointerdown", closeOnOutsidePointer);

    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [speedMenuOpen]);

  useEffect(() => () => clearSpeedHoldTimer(), []);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !audioUrl || audioError) return;

    if (audio.paused) {
      audio.play().catch(() => setAudioError("Не удалось воспроизвести аудио"));
    } else {
      audio.pause();
    }
  }

  function seek(value: string) {
    const audio = audioRef.current;
    const nextTime = Number(value);
    setCurrentTime(nextTime);
    if (audio && Number.isFinite(nextTime)) {
      audio.currentTime = nextTime;
    }
  }

  function seekByRatio(ratio: number) {
    const nextTime = Math.min(1, Math.max(0, ratio)) * effectiveDuration;
    seek(String(nextTime));
  }

  function seekFromPointer(clientX: number) {
    const rect = waveformRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    seekByRatio((clientX - rect.left) / rect.width);
  }

  function handleWaveformPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!audioUrl || loadingAudio || audioError || effectiveDuration <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromPointer(event.clientX);
  }

  function handleWaveformKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!audioUrl || loadingAudio || audioError || effectiveDuration <= 0) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    if (event.key === "Home") {
      seekByRatio(0);
      return;
    }
    if (event.key === "End") {
      seekByRatio(1);
      return;
    }
    const direction = event.key === "ArrowRight" ? 1 : -1;
    seek(String(Math.min(effectiveDuration, Math.max(0, currentTime + direction * 5))));
  }

  function clearSpeedHoldTimer() {
    if (speedHoldTimerRef.current === null) return;
    window.clearTimeout(speedHoldTimerRef.current);
    speedHoldTimerRef.current = null;
  }

  function changePlaybackRate(value: number) {
    const nextRate = Number(value);
    setPlaybackRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  }

  function cyclePlaybackRate() {
    const currentIndex = playbackRates.indexOf(playbackRate);
    const nextRate = playbackRates[(currentIndex + 1) % playbackRates.length] ?? 1;
    changePlaybackRate(nextRate);
    setSpeedMenuOpen(false);
  }

  function handleSpeedPointerDown() {
    if (audioDisabled) return;
    speedLongPressRef.current = false;
    clearSpeedHoldTimer();
    speedHoldTimerRef.current = window.setTimeout(() => {
      speedLongPressRef.current = true;
      setSpeedMenuOpen(true);
    }, 420);
  }

  function handleSpeedPointerUp() {
    if (audioDisabled) return;
    clearSpeedHoldTimer();
    if (speedLongPressRef.current) {
      speedLongPressRef.current = false;
      return;
    }
    cyclePlaybackRate();
  }

  function handleSpeedKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (audioDisabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      cyclePlaybackRate();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSpeedMenuOpen(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setSpeedMenuOpen(false);
    }
  }

  function downloadAudio() {
    if (!audioBlob) return;
    const downloadUrl = URL.createObjectURL(audioBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = audioDownloadName(call);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  }

  const effectiveDuration = duration > 0 ? duration : call.duration_seconds;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;
  const waveformReady = waveform.length > 0;
  const showAudioSkeleton = loadingAudio || (loadingWaveform && !waveformReady);
  const currentTimeLabel = formatDuration(Math.round(currentTime));
  const audioDisabled = !audioUrl || loadingAudio || Boolean(audioError);

  return (
    <div
      className={`dashboard-audio-player custom-audio-player ${showAudioSkeleton ? "audio-loading-state" : ""} ${audioError ? "audio-error-state" : ""}`}
      style={{ "--audio-progress": `${progressPercent}%` } as React.CSSProperties}
    >
      <button
        className="audio-play"
        type="button"
        disabled={!audioUrl || loadingAudio || Boolean(audioError)}
        aria-label={playing ? "Поставить аудио на паузу" : "Воспроизвести аудио"}
        onClick={togglePlayback}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div className="audio-player-main">
        <div className="audio-player-track-row">
          <span className="audio-time" title={audioError || (loadingWaveform ? "Строю звуковую дорожку" : undefined)}>
            {currentTimeLabel}
          </span>
          <div
            ref={waveformRef}
            className={`audio-waveform ${waveformReady ? "ready" : "empty"}`}
            role="slider"
            tabIndex={audioUrl && !audioError ? 0 : -1}
            aria-label="Позиция аудиозаписи"
            aria-valuemin={0}
            aria-valuemax={Math.round(effectiveDuration)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${formatDuration(Math.round(currentTime))} из ${formatDuration(Math.round(effectiveDuration))}`}
            onKeyDown={handleWaveformKey}
            onPointerDown={handleWaveformPointer}
            onPointerMove={(event) => {
              if (event.buttons === 1) handleWaveformPointer(event);
            }}
          >
            {(waveformReady ? waveform : fallbackWaveform).map((peak, index) => {
              const barProgress = waveform.length > 1 ? index / (waveform.length - 1) : 0;
              const active = barProgress * 100 <= progressPercent;
              return (
                <span
                  className={active ? "active" : ""}
                  style={{ "--bar-height": `${Math.max(8, peak * 100)}%` } as React.CSSProperties}
                  key={`${index}-${peak.toFixed(3)}`}
                />
              );
            })}
          </div>
          <span className="audio-time total">{formatDuration(Math.round(effectiveDuration))}</span>
          <div className="audio-player-actions">
            <div
              className={`audio-speed-control ${speedMenuOpen ? "open" : ""} ${audioDisabled ? "disabled" : ""}`}
              ref={speedControlRef}
            >
              <button
                className="audio-speed-button"
                type="button"
                disabled={audioDisabled}
                aria-haspopup="menu"
                aria-expanded={speedMenuOpen}
                aria-label="Скорость воспроизведения"
                onKeyDown={handleSpeedKeyDown}
                onPointerCancel={clearSpeedHoldTimer}
                onPointerDown={handleSpeedPointerDown}
                onPointerLeave={clearSpeedHoldTimer}
                onPointerUp={handleSpeedPointerUp}
              >
                {playbackRate}x
              </button>
              <div className="audio-speed-menu" role="menu">
                {playbackRates.map((rate) => (
                  <button
                    className={rate === playbackRate ? "active" : ""}
                    type="button"
                    role="menuitemradio"
                    aria-checked={rate === playbackRate}
                    key={rate}
                    onClick={() => {
                      changePlaybackRate(rate);
                      setSpeedMenuOpen(false);
                    }}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
            <button
              className="audio-download-button"
              type="button"
              disabled={!audioBlob}
              aria-label="Скачать аудиозапись"
              onClick={downloadAudio}
            >
              <Download size={14} />
            </button>
          </div>
        </div>
        <audio
          ref={audioRef}
          className="call-audio-element"
          src={audioUrl || undefined}
          preload="metadata"
          onDurationChange={(event) => {
            const nextDuration = event.currentTarget.duration;
            if (Number.isFinite(nextDuration)) setDuration(nextDuration);
          }}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        />
      </div>
    </div>
  );
}

function resetAudioElement(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.pause();
  if (Number.isFinite(audio.duration)) {
    audio.currentTime = 0;
  }
  audio.load();
}

function audioDownloadName(call: CallResponse) {
  const fallbackName = call.title || "call-audio";
  const rawName = call.original_filename || `${fallbackName}.mp3`;
  return rawName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "call-audio.mp3";
}

async function buildWaveform(blob: Blob, barCount: number) {
  const AudioContextConstructor = window.AudioContext ?? (window as Window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("AudioContext is not available");
  }

  const audioContext = new AudioContextConstructor();

  try {
    const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const channelData = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    const samplesPerBar = Math.max(1, Math.floor(buffer.length / barCount));
    const peaks = Array.from({ length: barCount }, (_, barIndex) => {
      const start = barIndex * samplesPerBar;
      const end = barIndex === barCount - 1 ? buffer.length : Math.min(buffer.length, start + samplesPerBar);
      let peak = 0;

      for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
        let mixed = 0;
        channelData.forEach((channel) => {
          mixed += Math.abs(channel[sampleIndex] ?? 0);
        });
        peak = Math.max(peak, mixed / channelData.length);
      }

      return peak;
    });
    const maxPeak = Math.max(...peaks, 0.01);

    return peaks.map((peak) => Math.max(0.1, Math.min(1, peak / maxPeak)));
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}
