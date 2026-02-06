import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowRight, Menu, Volume2, VolumeX, Play, Pause, Repeat, Link, Clock, Maximize2, Palette, ExternalLink } from "lucide-react";
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

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          playerVars: Record<string, number | string>;
          events: {
            onReady: (event: { target: YouTubePlayer }) => void;
            onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
          };
        }
      ) => YouTubePlayer;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  isMuted: () => boolean;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  cueVideoById: (videoId: string) => void;
  loadVideoById: (videoId: string) => void;
  destroy: () => void;
}

const DEFAULT_VIDEO_ID = "M7lc1UVf-VE";

type ContainerShape = "circle" | "oval" | "square" | "rectangle";

const shapeStyles: Record<ContainerShape, { borderRadius: string; aspect: string; widthClass: string; heightClass: string }> = {
  circle: { borderRadius: "9999px", aspect: "1/1", widthClass: "w-[180px] sm:w-[220px] md:w-[280px]", heightClass: "h-[180px] sm:h-[220px] md:h-[280px]" },
  oval: { borderRadius: "9999px", aspect: "3/2", widthClass: "w-[270px] sm:w-[330px] md:w-[420px]", heightClass: "h-[180px] sm:h-[220px] md:h-[280px]" },
  square: { borderRadius: "16px", aspect: "1/1", widthClass: "w-[180px] sm:w-[220px] md:w-[280px]", heightClass: "h-[180px] sm:h-[220px] md:h-[280px]" },
  rectangle: { borderRadius: "16px", aspect: "16/9", widthClass: "w-[320px] sm:w-[390px] md:w-[500px]", heightClass: "h-[180px] sm:h-[220px] md:h-[280px]" },
};

function extractVideoId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

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

export default function Home() {
  const [isHovered, setIsHovered] = useState(false);
  const [title, setTitle] = useState("Click the Video Button");
  const [buttonLabel, setButtonLabel] = useState("Visit Site");
  const [buttonUrl, setButtonUrl] = useState("https://womacromax.com");
  const [videoUrl, setVideoUrl] = useState(`https://www.youtube.com/watch?v=${DEFAULT_VIDEO_ID}`);
  const [videoId, setVideoId] = useState(DEFAULT_VIDEO_ID);
  const [volume, setVolume] = useState([50]);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
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
  const playerRef = useRef<YouTubePlayer | null>(null);
  const isLoopingRef = useRef(isLooping);
  const loopStartRef = useRef(0);
  const loopEndRef = useRef(0);
  const durationRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerInitializedRef = useRef(false);
  const currentVideoIdRef = useRef(videoId);
  const progressIntervalRef = useRef<number | null>(null);
  const isSeeking = useRef(false);
  const volumeRef = useRef(50);

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
  useEffect(() => { currentVideoIdRef.current = videoId; }, [videoId]);
  useEffect(() => { volumeRef.current = volume[0]; }, [volume]);

  useEffect(() => {
    if (playerInitializedRef.current) return;
    const initPlayer = () => {
      if (playerRef.current || playerInitializedRef.current) return;
      playerInitializedRef.current = true;
      playerRef.current = new window.YT.Player("youtube-player", {
        videoId: currentVideoIdRef.current,
        playerVars: { autoplay: 1, mute: 1, controls: 0, showinfo: 0, rel: 0, modestbranding: 1, playsinline: 1, loop: 0 },
        events: {
          onReady: (event) => {
            setPlayerReady(true);
            event.target.setVolume(volumeRef.current);
            event.target.mute();
            const dur = event.target.getDuration();
            if (dur > 0) setDuration(dur);
          },
          onStateChange: (event) => {
            if (event.data === 1) {
              const dur = event.target.getDuration();
              if (dur > 0) setDuration(dur);
              setIsPlaying(true);
            } else if (event.data === 2) {
              setIsPlaying(false);
            }
            if (event.data === 0 && isLoopingRef.current) {
              event.target.seekTo(loopStartRef.current, true);
              event.target.playVideo();
            }
          },
        },
      });
    };
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }
      const existingCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (existingCallback) existingCallback();
        initPlayer();
      };
    }
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        playerInitializedRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!playerReady || !playerRef.current) return;
    const updateProgress = () => {
      if (!playerRef.current || isSeeking.current) return;
      try {
        const state = playerRef.current.getPlayerState();
        if (state !== 1 && state !== 3) return;
        const time = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        if (dur > 0) {
          setCurrentTime(time);
          setDuration(dur);
          setProgress([(time / dur) * 100]);
          if (isLoopingRef.current && loopEndRef.current > loopStartRef.current && time >= loopEndRef.current) {
            playerRef.current.seekTo(loopStartRef.current, true);
          }
        }
      } catch { /* Player may not be ready */ }
    };
    progressIntervalRef.current = window.setInterval(updateProgress, 200);
    return () => { if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current); };
  }, [playerReady]);

  useEffect(() => {
    if (playerReady && playerRef.current) {
      setCurrentTime(0);
      setProgress([0]);
      setDuration(0);
      playerRef.current.loadVideoById(videoId);
      playerRef.current.setVolume(volumeRef.current);
      if (isMuted) playerRef.current.mute();
      setLoopEnd("");
      setLoopStart("0:00");
    }
  }, [videoId, playerReady, isMuted]);

  useEffect(() => {
    if (playerReady && playerRef.current) playerRef.current.setVolume(volume[0]);
  }, [volume, playerReady]);

  useEffect(() => {
    if (playerReady && playerRef.current) {
      if (isMuted) { playerRef.current.mute(); }
      else { playerRef.current.unMute(); playerRef.current.setVolume(volumeRef.current); }
    }
  }, [isMuted, playerReady]);

  useEffect(() => {
    if (playerReady && playerRef.current) {
      if (isPlaying) playerRef.current.playVideo();
      else playerRef.current.pauseVideo();
    }
  }, [isPlaying, playerReady]);

  const handleClick = useCallback(() => { if (buttonUrl) window.open(buttonUrl, "_blank"); }, [buttonUrl]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (buttonUrl) window.open(buttonUrl, "_blank"); }
  }, [buttonUrl]);
  const handleVideoUrlChange = useCallback((value: string) => {
    setVideoUrl(value);
    const extractedId = extractVideoId(value);
    if (extractedId) setVideoId(extractedId);
  }, []);
  const handleMuteToggle = useCallback((checked: boolean) => { setIsMuted(checked); }, []);
  const handlePlayToggle = useCallback(() => { setIsPlaying((prev) => !prev); }, []);
  const handleLoopToggle = useCallback((checked: boolean) => { setIsLooping(checked); }, []);
  const handleProgressChange = useCallback((value: number[]) => { isSeeking.current = true; setProgress(value); }, []);
  const handleProgressCommit = useCallback((value: number[]) => {
    if (playerRef.current && durationRef.current > 0) {
      const seekTime = (value[0] / 100) * durationRef.current;
      playerRef.current.seekTo(seekTime, true);
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

  const loopStartSeconds = parseTime(loopStart);
  const loopEndSeconds = loopEnd ? parseTime(loopEnd) : 0;
  const isLoopValid = !loopEnd || (loopEndSeconds > loopStartSeconds && loopEndSeconds <= duration);

  const currentShape = shapeStyles[shape];
  const scaleFactor = scale[0] / 100;

  return (
    <div className="min-h-screen flex items-center justify-center p-5 relative" style={{ backgroundColor: bgColor }}>
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
              Customize video playback and button appearance
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 mt-6 flex-1 overflow-y-auto pb-6">
            <div className="space-y-3">
              <Label htmlFor="video-url-input" className="text-sm font-medium flex items-center gap-2">
                <Link className="w-4 h-4" />
                Video URL
              </Label>
              <Input
                id="video-url-input"
                value={videoUrl}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
                placeholder="YouTube URL or Video ID"
                data-testid="input-video-url"
              />
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

      <div className="text-center">
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
          data-testid="button-video"
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
            }}
          >
            <div
              className="absolute top-1/2 left-1/2 w-[200%] h-[200%] pointer-events-none"
              style={{ transform: "translate(-50%, -50%)" }}
            >
              <div id="youtube-player" className="w-full h-full pointer-events-none" />
            </div>

            <div
              className="absolute z-20 pointer-events-auto"
              style={{ bottom: "12%", right: "12%" }}
            >
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); setIsMuted((prev) => !prev); }}
                className="rounded-full bg-black/50 text-white/80"
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                data-testid="button-mute-overlay"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
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
    </div>
  );
}
