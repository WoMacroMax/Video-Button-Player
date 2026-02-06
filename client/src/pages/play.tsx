import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowRight, Menu, Volume2, VolumeX, Play, Pause, Repeat, Link, Clock, Maximize2, Palette, ExternalLink, Eye, EyeOff, SkipBack, SkipForward, Music, X } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const DEFAULT_AUDIO_URL = "https://xrwnptogkhxeyamjcxhd.supabase.co/storage/v1/object/public/attachments/1770396018869-OneDanceSnippet.mp4";

const AUDIO_URLS_KEY = "play-audio-urls";
const MAX_HISTORY = 20;

function loadUrlHistory(key: string): string[] {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveUrlToHistory(key: string, url: string): string[] {
  if (!url.trim()) return loadUrlHistory(key);
  const history = loadUrlHistory(key);
  const filtered = history.filter((u) => u !== url);
  const updated = [url, ...filtered].slice(0, MAX_HISTORY);
  localStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

function removeUrlFromHistory(key: string, url: string): string[] {
  const history = loadUrlHistory(key).filter((u) => u !== url);
  localStorage.setItem(key, JSON.stringify(history));
  return history;
}

function getLabelForUrl(url: string): string {
  try {
    const u = new URL(url);
    const filename = u.pathname.split("/").pop();
    if (filename && filename.length > 1) {
      const decoded = decodeURIComponent(filename);
      return decoded.length > 50 ? decoded.slice(0, 47) + "..." : decoded;
    }
    return u.hostname + u.pathname.slice(0, 30);
  } catch {
    return url.length > 50 ? url.slice(0, 47) + "..." : url;
  }
}

type ContainerShape = "circle" | "oval" | "square" | "rectangle";

const shapeStyles: Record<ContainerShape, { borderRadius: string; aspect: string; widthClass: string; heightClass: string }> = {
  circle: { borderRadius: "9999px", aspect: "1/1", widthClass: "w-[180px] sm:w-[220px] md:w-[280px]", heightClass: "h-[180px] sm:h-[220px] md:h-[280px]" },
  oval: { borderRadius: "9999px", aspect: "3/2", widthClass: "w-[270px] sm:w-[330px] md:w-[420px]", heightClass: "h-[180px] sm:h-[220px] md:h-[280px]" },
  square: { borderRadius: "16px", aspect: "1/1", widthClass: "w-[180px] sm:w-[220px] md:w-[280px]", heightClass: "h-[180px] sm:h-[220px] md:h-[280px]" },
  rectangle: { borderRadius: "16px", aspect: "16/9", widthClass: "w-[320px] sm:w-[390px] md:w-[500px]", heightClass: "h-[180px] sm:h-[220px] md:h-[280px]" },
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
  if (parts.length === 1) return Math.max(0, parts[0]);
  return 0;
}

function ColorPickerField({ label, color, onChange, testId }: { label: string; color: string; onChange: (c: string) => void; testId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 text-center font-mono text-xs"
            data-testid={`${testId}-input`}
          />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="w-9 h-9 rounded-md border border-border flex-shrink-0"
            style={{ backgroundColor: color }}
            aria-label={`Pick ${label.toLowerCase()}`}
            data-testid={`${testId}-swatch`}
          />
        </div>
      </div>
      {open && (
        <div className="pt-1">
          <HexColorPicker color={color} onChange={onChange} style={{ width: "100%" }} />
        </div>
      )}
    </div>
  );
}

function AudioVisualizer({ audioRef, isPlaying }: { audioRef: React.RefObject<HTMLAudioElement | null>; isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    const initAnalyser = () => {
      if (contextRef.current) return;
      try {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        contextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
      } catch { /* already connected */ }
    };

    const handlePlay = () => { initAnalyser(); if (contextRef.current?.state === "suspended") contextRef.current.resume(); };
    audio.addEventListener("play", handlePlay);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      if (!analyserRef.current || !canvas) return;
      const ctx2d = canvas.getContext("2d");
      if (!ctx2d) return;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      const barCount = Math.min(bufferLength, 24);
      const gap = 3;
      const barW = (w - (barCount - 1) * gap) / barCount;
      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i] / 255;
        const barH = Math.max(4, val * h * 0.85);
        const x = i * (barW + gap);
        const y = (h - barH) / 2;
        ctx2d.fillStyle = `rgba(255, 255, 255, ${0.4 + val * 0.5})`;
        ctx2d.beginPath();
        ctx2d.roundRect(x, y, barW, barH, 2);
        ctx2d.fill();
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      audio.removeEventListener("play", handlePlay);
    };
  }, [audioRef, isPlaying]);

  return <canvas ref={canvasRef} width={280} height={280} className="absolute inset-0 w-full h-full" />;
}

export default function PlayPage() {
  const [isHovered, setIsHovered] = useState(false);
  const [title, setTitle] = useState("Click the Audio Button");
  const [buttonLabel, setButtonLabel] = useState("Visit Site");
  const [buttonUrl, setButtonUrl] = useState("https://rodbiz.digiucard.com/portfolio");
  const [audioHistory, setAudioHistory] = useState<string[]>(() => loadUrlHistory(AUDIO_URLS_KEY));
  const [audioUrl, setAudioUrl] = useState(() => {
    const history = loadUrlHistory(AUDIO_URLS_KEY);
    return history.length > 0 ? history[0] : DEFAULT_AUDIO_URL;
  });
  const [volume, setVolume] = useState([50]);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [loopStart, setLoopStart] = useState("0:00");
  const [loopEnd, setLoopEnd] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState([0]);
  const [playerReady, setPlayerReady] = useState(false);
  const [shape, setShape] = useState<ContainerShape>("circle");
  const [scale, setScale] = useState([100]);
  const [bgColor, setBgColor] = useState("#667eea");
  const [borderColor, setBorderColor] = useState("#ffffff33");
  const [containerVisible, setContainerVisible] = useState(true);
  const [stemModalOpen, setStemModalOpen] = useState(false);
  const stemIframeRef = useRef<HTMLIFrameElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isLoopingRef = useRef(isLooping);
  const loopStartRef = useRef(0);
  const loopEndRef = useRef(0);
  const durationRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const isSeeking = useRef(false);
  const autoPlayAttempted = useRef(false);

  useEffect(() => {
    if (audioUrl.trim() && audioHistory.length === 0) {
      setAudioHistory(saveUrlToHistory(AUDIO_URLS_KEY, audioUrl));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => {
    const parsed = parseTime(loopStart);
    loopStartRef.current = Math.min(parsed, durationRef.current > 0 ? durationRef.current : Infinity);
  }, [loopStart]);
  useEffect(() => {
    if (loopEnd) {
      const parsed = parseTime(loopEnd);
      const clamped = durationRef.current > 0 ? Math.min(parsed, durationRef.current) : parsed;
      loopEndRef.current = clamped > loopStartRef.current ? clamped : 0;
    } else {
      loopEndRef.current = 0;
    }
  }, [loopEnd]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      const dur = audio.duration;
      if (isFinite(dur) && dur > 0) {
        setDuration(dur);
        setPlayerReady(true);
      }
      if (!autoPlayAttempted.current) {
        autoPlayAttempted.current = true;
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    };
    const onEnded = () => {
      if (isLoopingRef.current) {
        audio.currentTime = loopStartRef.current;
        audio.play().catch(() => {});
      } else {
        setIsPlaying(false);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onDurationChange = () => {
      if (isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("durationchange", onDurationChange);

    if (audio.readyState >= 1) onLoadedMetadata();

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("durationchange", onDurationChange);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!playerReady || !audioRef.current) return;
    const updateProgress = () => {
      const audio = audioRef.current;
      if (!audio || isSeeking.current) return;
      const time = audio.currentTime;
      const dur = audio.duration;
      if (isFinite(dur) && dur > 0) {
        setCurrentTime(time);
        setProgress([(time / dur) * 100]);
        if (isLoopingRef.current && loopEndRef.current > loopStartRef.current && time >= loopEndRef.current) {
          audio.currentTime = loopStartRef.current;
        }
      }
    };
    progressIntervalRef.current = window.setInterval(updateProgress, 200);
    return () => { if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current); };
  }, [playerReady]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume[0] / 100;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.play().catch(() => {});
      else audioRef.current.pause();
    }
  }, [isPlaying]);

  const handleAudioUrlChange = useCallback((value: string) => {
    setAudioUrl(value);
    setCurrentTime(0);
    setProgress([0]);
    setDuration(0);
    setPlayerReady(false);
    setLoopEnd("");
    setLoopStart("0:00");
    autoPlayAttempted.current = false;
  }, []);
  const handleAudioUrlCommit = useCallback(() => {
    if (audioUrl.trim()) setAudioHistory(saveUrlToHistory(AUDIO_URLS_KEY, audioUrl));
  }, [audioUrl]);
  const handleAudioHistorySelect = useCallback((url: string) => {
    setAudioUrl(url);
    setCurrentTime(0);
    setProgress([0]);
    setDuration(0);
    setPlayerReady(false);
    setLoopEnd("");
    setLoopStart("0:00");
    autoPlayAttempted.current = false;
    setAudioHistory(saveUrlToHistory(AUDIO_URLS_KEY, url));
  }, []);
  const handleRemoveAudioUrl = useCallback((url: string) => {
    setAudioHistory(removeUrlFromHistory(AUDIO_URLS_KEY, url));
  }, []);

  const handleClick = useCallback(() => { if (buttonUrl) window.open(buttonUrl, "_blank"); }, [buttonUrl]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (buttonUrl) window.open(buttonUrl, "_blank"); }
  }, [buttonUrl]);
  const triggerUnmutePlay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = false;
      audioRef.current.play().catch(Boolean);
    }
  }, []);
  const handleMuteToggle = useCallback((checked: boolean) => {
    setIsMuted(checked);
    if (!checked && !isPlaying) {
      setIsPlaying(true);
      triggerUnmutePlay();
    }
  }, [isPlaying, triggerUnmutePlay]);
  const handlePlayToggle = useCallback(() => { setIsPlaying((prev) => !prev); }, []);
  const handleLoopToggle = useCallback((checked: boolean) => { setIsLooping(checked); }, []);
  const handleProgressChange = useCallback((value: number[]) => { isSeeking.current = true; setProgress(value); }, []);
  const handleProgressCommit = useCallback((value: number[]) => {
    if (audioRef.current && durationRef.current > 0) {
      const seekTime = (value[0] / 100) * durationRef.current;
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
    isSeeking.current = false;
  }, []);
  const handleSetLoopStartToCurrent = useCallback(() => {
    const clamped = Math.min(currentTime, duration > 0 ? duration : currentTime);
    setLoopStart(formatTime(clamped));
  }, [currentTime, duration]);
  const handleSetLoopEndToCurrent = useCallback(() => {
    const clamped = Math.min(currentTime, duration > 0 ? duration : currentTime);
    if (clamped > parseTime(loopStart)) setLoopEnd(formatTime(clamped));
  }, [currentTime, duration, loopStart]);

  const sendAudioToStem = useCallback(() => {
    const iframe = stemIframeRef.current;
    if (!iframe?.contentWindow || !audioUrl) return;
    iframe.contentWindow.postMessage({ type: "load-audio-url", url: audioUrl }, "*");
  }, [audioUrl]);

  useEffect(() => {
    if (stemModalOpen) sendAudioToStem();
  }, [stemModalOpen, sendAudioToStem]);

  const loopStartSeconds = parseTime(loopStart);
  const loopEndSeconds = loopEnd ? parseTime(loopEnd) : 0;
  const isLoopValid = !loopEnd || (loopEndSeconds > loopStartSeconds && loopEndSeconds <= duration);

  const currentShape = shapeStyles[shape];
  const scaleFactor = scale[0] / 100;

  return (
    <div className="min-h-screen flex items-center justify-center p-5 relative" style={{ backgroundColor: bgColor }}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" crossOrigin="anonymous" />

      <Sheet>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 left-4 text-white"
            aria-label="Open settings menu"
            data-testid="button-menu"
          >
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 flex flex-col h-full overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>
              Customize audio playback and button appearance
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 mt-6 flex-1 overflow-y-auto pb-6">
            <div className="space-y-3">
              <Label htmlFor="audio-url-input" className="text-sm font-medium flex items-center gap-2">
                <Link className="w-4 h-4" />
                Audio URL
              </Label>
              <Input
                id="audio-url-input"
                value={audioUrl}
                onChange={(e) => handleAudioUrlChange(e.target.value)}
                onBlur={handleAudioUrlCommit}
                onKeyDown={(e) => { if (e.key === "Enter") handleAudioUrlCommit(); }}
                placeholder="Audio file URL (.mp3, .mp4, .wav, .ogg...)"
                data-testid="input-audio-url"
              />
              {audioHistory.length > 0 && (
                <div className="space-y-1" data-testid="dropdown-audio-history">
                  <Label className="text-xs text-muted-foreground">Recent Audio URLs</Label>
                  <div className="max-h-32 overflow-y-auto rounded-md border bg-background">
                    {audioHistory.map((url) => (
                      <div
                        key={url}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs hover-elevate cursor-pointer group"
                        onClick={() => handleAudioHistorySelect(url)}
                        data-testid={`audio-history-item`}
                      >
                        <span className="flex-1 text-left truncate" title={url}>
                          {getLabelForUrl(url)}
                        </span>
                        <span
                          className="shrink-0 visibility-hidden group-hover:visibility-visible rounded-sm p-0.5 hover:bg-muted"
                          onClick={(e) => { e.stopPropagation(); handleRemoveAudioUrl(url); }}
                          data-testid="audio-history-remove"
                        >
                          <X className="w-3 h-3" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="title-input" className="text-sm font-medium">Title</Label>
              <Input id="title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter title" data-testid="input-title" />
            </div>

            <div className="space-y-3">
              <Label htmlFor="button-label-input" className="text-sm font-medium">Button Label</Label>
              <Input id="button-label-input" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} placeholder="Enter button label" data-testid="input-button-label" />
            </div>

            <div className="space-y-3">
              <Label htmlFor="button-url-input" className="text-sm font-medium flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Button URL
              </Label>
              <Input
                id="button-url-input"
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
                placeholder="https://example.com"
                data-testid="input-button-url"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Maximize2 className="w-4 h-4" />
                Shape
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {(["circle", "oval", "square", "rectangle"] as ContainerShape[]).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={shape === s ? "default" : "outline"}
                    onClick={() => setShape(s)}
                    className="text-xs capitalize"
                    data-testid={`button-shape-${s}`}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Maximize2 className="w-4 h-4" />
                  Scale
                </Label>
                <span className="text-sm text-muted-foreground">{scale[0]}%</span>
              </div>
              <Slider value={scale} onValueChange={setScale} min={50} max={200} step={5} className="w-full" data-testid="slider-scale" />
            </div>

            <div className="space-y-4 p-3 bg-muted rounded-md">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Colors
              </Label>
              <ColorPickerField label="Page Background" color={bgColor} onChange={setBgColor} testId="color-bg" />
              <ColorPickerField label="Border Color" color={borderColor} onChange={setBorderColor} testId="color-border" />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="visibility-toggle" className="text-sm font-medium flex items-center gap-2">
                {containerVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Container Visible
              </Label>
              <Switch id="visibility-toggle" checked={containerVisible} onCheckedChange={setContainerVisible} data-testid="switch-visibility" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Progress
                </Label>
                <span className="text-sm text-muted-foreground">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              <Slider value={progress} onValueChange={handleProgressChange} onValueCommit={handleProgressCommit} max={100} step={0.1} className="w-full" data-testid="slider-progress" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Volume
                </Label>
                <span className="text-sm text-muted-foreground">{volume[0]}%</span>
              </div>
              <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="w-full" data-testid="slider-volume" />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="mute-toggle" className="text-sm font-medium flex items-center gap-2">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                Muted
              </Label>
              <Switch id="mute-toggle" checked={isMuted} onCheckedChange={handleMuteToggle} data-testid="switch-mute" />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                Transport
              </Label>
              <Button size="sm" variant="outline" onClick={handlePlayToggle} data-testid="button-transport">
                {isPlaying ? (<><Pause className="w-4 h-4 mr-2" />Pause</>) : (<><Play className="w-4 h-4 mr-2" />Play</>)}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="loop-toggle" className="text-sm font-medium flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Loop
              </Label>
              <Switch id="loop-toggle" checked={isLooping} onCheckedChange={handleLoopToggle} data-testid="switch-loop" />
            </div>

            {isLooping && (
              <div className="space-y-4 p-3 bg-muted rounded-md">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Loop Range</Label>
                    <span className="text-sm text-muted-foreground">
                      {formatTime(loopStartSeconds)} - {loopEnd ? formatTime(loopEndSeconds) : formatTime(duration)}
                    </span>
                  </div>
                  <Slider
                    value={[
                      duration > 0 ? (loopStartSeconds / duration) * 100 : 0,
                      duration > 0 ? ((loopEnd ? loopEndSeconds : duration) / duration) * 100 : 100,
                    ]}
                    onValueChange={(values) => {
                      if (duration > 0) {
                        setLoopStart(formatTime((values[0] / 100) * duration));
                        if (values[1] < 100) { setLoopEnd(formatTime((values[1] / 100) * duration)); }
                        else { setLoopEnd(""); }
                      }
                    }}
                    max={100} step={0.5} minStepsBetweenThumbs={1} className="w-full" data-testid="slider-loop-range"
                  />
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-xs text-muted-foreground font-medium">Manual Input</p>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="loop-start" className="text-sm font-medium whitespace-nowrap">Start</Label>
                    <div className="flex items-center gap-2">
                      <Input id="loop-start" value={loopStart} onChange={(e) => setLoopStart(e.target.value)} placeholder="0:00" className="w-20 text-center" data-testid="input-loop-start" />
                      <Button size="sm" variant="outline" onClick={handleSetLoopStartToCurrent} data-testid="button-set-loop-start">Set</Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="loop-end" className="text-sm font-medium whitespace-nowrap">End</Label>
                    <div className="flex items-center gap-2">
                      <Input id="loop-end" value={loopEnd} onChange={(e) => setLoopEnd(e.target.value)} placeholder="End" className={`w-20 text-center ${!isLoopValid ? "border-destructive" : ""}`} data-testid="input-loop-end" />
                      <Button size="sm" variant="outline" onClick={handleSetLoopEndToCurrent} data-testid="button-set-loop-end">Set</Button>
                    </div>
                  </div>
                  {!isLoopValid && <p className="text-xs text-destructive">End time must be after start time</p>}
                  <p className="text-xs text-muted-foreground">Format: minutes:seconds (e.g., 1:30)</p>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Button
        size="icon"
        variant="ghost"
        className="absolute top-14 left-4 bg-red-600 text-white hover:bg-red-700"
        aria-label="Open Stem Separator"
        onClick={() => setStemModalOpen(true)}
        data-testid="button-stem"
      >
        <Music className="w-6 h-6" />
      </Button>

      {stemModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          data-testid="stem-modal-overlay"
        >
          <div className="relative w-[95vw] h-[90vh] max-w-5xl rounded-lg overflow-hidden bg-[#0a0a0f]" data-testid="stem-modal">
            <button
              type="button"
              onClick={() => setStemModalOpen(false)}
              className="absolute top-3 left-3 z-[60] w-8 h-8 rounded-full bg-red-600 flex items-center justify-center cursor-pointer border-none"
              style={{ lineHeight: 0 }}
              aria-label="Close Stem modal"
              data-testid="button-stem-close"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <iframe
              ref={stemIframeRef}
              src="/stem.html"
              className="w-full h-full border-0"
              title="StemSplit - AI Audio Separation"
              allow="autoplay; microphone"
              onLoad={sendAudioToStem}
              data-testid="stem-modal-iframe"
            />
          </div>
        </div>
      )}

      <div className="text-center" style={{ display: containerVisible ? "block" : "none" }}>
        <h1
          className="text-white text-2xl md:text-3xl font-semibold mb-6 md:mb-8"
          style={{ textShadow: "2px 2px 4px rgba(0, 0, 0, 0.2)" }}
          data-testid="text-title"
        >
          {title}
        </h1>

        <button
          type="button"
          className={`relative ${currentShape.widthClass} ${currentShape.heightClass} mx-auto cursor-pointer bg-transparent border-none p-0 block`}
          style={{ transform: `scale(${scaleFactor})`, transformOrigin: "center center" }}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label={`Visit ${buttonUrl || "website"}`}
          data-testid="button-audio"
        >
          <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden transition-all duration-300"
            style={{
              borderRadius: currentShape.borderRadius,
              boxShadow: isHovered
                ? `0 20px 60px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.3), inset 0 -2px 6px rgba(0,0,0,0.2)`
                : `0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25), inset 0 -2px 6px rgba(0,0,0,0.15)`,
              border: `4px solid ${borderColor}`,
              transform: isHovered ? "translateY(-4px)" : "translateY(0)",
              background: "linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.8) 100%)",
            }}
          >
            <AudioVisualizer audioRef={audioRef} isPlaying={isPlaying} />

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
              <Music className="w-12 h-12 md:w-16 md:h-16 text-white/30" />
            </div>

            <div
              className="absolute z-20 pointer-events-auto"
              style={{ bottom: "12%", right: "12%" }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); const willUnmute = isMuted; setIsMuted(!isMuted); if (willUnmute && !isPlaying) { setIsPlaying(true); triggerUnmutePlay(); } }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); const willUnmute = isMuted; setIsMuted(!isMuted); if (willUnmute && !isPlaying) { setIsPlaying(true); triggerUnmutePlay(); } } }}
                className="rounded-full bg-black/50 text-white/80 w-9 h-9 flex items-center justify-center cursor-pointer"
                aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                data-testid="button-mute-overlay"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </div>
            </div>

            <div
              className="absolute inset-0 z-10 flex items-center justify-center transition-all duration-300 pointer-events-none"
              style={{
                background: isHovered
                  ? "radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 70%)"
                  : "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)",
              }}
            >
              <div
                className="flex items-center gap-2 bg-white/90 text-[#667eea] px-4 py-2 md:px-6 md:py-3 rounded-full font-semibold text-xs md:text-sm transition-opacity duration-300"
                style={{ opacity: isHovered ? 1 : 0, visibility: isHovered ? "visible" : "hidden" }}
                data-testid="text-click-indicator"
              >
                <span>{buttonLabel}</span>
                <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
              </div>
            </div>
          </div>
        </button>
      </div>

      {!containerVisible && (
        <HiddenModeControls
          isPlaying={isPlaying}
          isMuted={isMuted}
          currentTime={currentTime}
          loopStartSeconds={loopStartSeconds}
          loopEndSeconds={loopEndSeconds}
          duration={duration}
          volume={volume}
          onPlayToggle={handlePlayToggle}
          onMuteToggle={() => { const willUnmute = isMuted; setIsMuted(!isMuted); if (willUnmute && !isPlaying) { setIsPlaying(true); triggerUnmutePlay(); } }}
          onVolumeChange={setVolume}
          onSeek={(time) => {
            if (audioRef.current) {
              audioRef.current.currentTime = time;
              setCurrentTime(time);
            }
          }}
          title={title}
        />
      )}
    </div>
  );
}

function HiddenModeControls({
  isPlaying,
  isMuted,
  currentTime,
  loopStartSeconds,
  loopEndSeconds,
  duration,
  volume,
  onPlayToggle,
  onMuteToggle,
  onVolumeChange,
  onSeek,
  title,
}: {
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  loopStartSeconds: number;
  loopEndSeconds: number;
  duration: number;
  volume: number[];
  onPlayToggle: () => void;
  onMuteToggle: () => void;
  onVolumeChange: (v: number[]) => void;
  onSeek: (time: number) => void;
  title: string;
}) {
  const rangeStart = loopStartSeconds;
  const rangeEnd = loopEndSeconds > loopStartSeconds ? loopEndSeconds : duration;
  const rangeSpan = rangeEnd - rangeStart;

  const scrubPercent = rangeSpan > 0 ? Math.max(0, Math.min(100, ((currentTime - rangeStart) / rangeSpan) * 100)) : 0;

  const handleScrubChange = useCallback((value: number[]) => {
    if (rangeSpan > 0) {
      const seekTime = rangeStart + (value[0] / 100) * rangeSpan;
      onSeek(seekTime);
    }
  }, [rangeStart, rangeSpan, onSeek]);

  const handleSkipBack = useCallback(() => {
    const newTime = Math.max(rangeStart, currentTime - 5);
    onSeek(newTime);
  }, [rangeStart, currentTime, onSeek]);

  const handleSkipForward = useCallback(() => {
    const newTime = Math.min(rangeEnd, currentTime + 5);
    onSeek(newTime);
  }, [rangeEnd, currentTime, onSeek]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md px-4" data-testid="hidden-mode-controls">
      <h1
        className="text-white text-2xl md:text-3xl font-semibold text-center"
        style={{ textShadow: "2px 2px 4px rgba(0, 0, 0, 0.2)" }}
        data-testid="text-title"
      >
        {title}
      </h1>

      <div className="w-full bg-white/10 backdrop-blur-sm rounded-md p-5 space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-white/70 text-xs font-medium">{formatTime(currentTime)}</span>
            <span className="text-white/70 text-xs font-medium">{formatTime(rangeEnd)}</span>
          </div>
          <Slider
            value={[scrubPercent]}
            onValueChange={handleScrubChange}
            max={100}
            step={0.1}
            className="w-full"
            data-testid="slider-hidden-scrub"
          />
          <div className="text-center">
            <span className="text-white/50 text-xs">
              Loop: {formatTime(rangeStart)} - {formatTime(rangeEnd)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSkipBack}
            className="text-white/80"
            aria-label="Skip back 5 seconds"
            data-testid="button-hidden-skip-back"
          >
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onPlayToggle}
            className="text-white bg-white/20"
            aria-label={isPlaying ? "Pause" : "Play"}
            data-testid="button-hidden-play"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSkipForward}
            className="text-white/80"
            aria-label="Skip forward 5 seconds"
            data-testid="button-hidden-skip-forward"
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={onMuteToggle}
            className="text-white/80 flex-shrink-0"
            aria-label={isMuted ? "Unmute" : "Mute"}
            data-testid="button-hidden-mute"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Slider
            value={volume}
            onValueChange={onVolumeChange}
            max={100}
            step={1}
            className="w-full"
            data-testid="slider-hidden-volume"
          />
          <span className="text-white/60 text-xs w-8 text-right flex-shrink-0">{volume[0]}%</span>
        </div>
      </div>
    </div>
  );
}
