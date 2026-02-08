import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowRight, Menu, Volume2, VolumeX, Play, Pause, Square, Repeat, Link, Clock, Maximize2, Palette, ExternalLink, Eye, EyeOff, SkipBack, SkipForward, Music, Film, X, GripHorizontal, ImageIcon, Minus, Plus, QrCode, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { MicroAdjustButton } from "@/components/ui/micro-adjust-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DraggableResizablePanel } from "@/components/ui/draggable-resizable-panel";

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

/** Parse loop start/end string (milliseconds) to seconds. */
function parseLoopMs(msStr: string): number {
  if (!msStr.trim()) return 0;
  const n = Number(msStr.replace(/\D/g, ""));
  return isNaN(n) || n < 0 ? 0 : n / 1000;
}

/** Format seconds as milliseconds string for loop inputs. */
function formatMs(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0";
  return String(Math.round(seconds * 1000));
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

export default function PlayPage({ standalone }: { standalone?: boolean } = {}) {
  const [isHovered, setIsHovered] = useState(false);
  const [title, setTitle] = useState("Click the Audio Button");
  const [buttonLabel, setButtonLabel] = useState("Visit Site");
  const [buttonUrl, setButtonUrl] = useState("https://rodbiz.digiucard.com/portfolio");
  const [buttonColor, setButtonColor] = useState("#667eea");
  const [buttonPosX, setButtonPosX] = useState(50);
  const [buttonPosY, setButtonPosY] = useState(50);
  const [buttonScale, setButtonScale] = useState([100]);
  const [audioHistory, setAudioHistory] = useState<string[]>(() => loadUrlHistory(AUDIO_URLS_KEY));
  const [audioUrl, setAudioUrl] = useState(() => {
    const history = loadUrlHistory(AUDIO_URLS_KEY);
    return history.length > 0 ? history[0] : DEFAULT_AUDIO_URL;
  });
  const [volume, setVolume] = useState([50]);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [loopStart, setLoopStart] = useState("0");
  const [loopEnd, setLoopEnd] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState([0]);
  const [playerReady, setPlayerReady] = useState(false);
  const [shape, setShape] = useState<ContainerShape>("circle");
  const [containerRounded, setContainerRounded] = useState(true);
  const [iframe1Rounded, setIframe1Rounded] = useState(true);
  const [iframe2Rounded, setIframe2Rounded] = useState(true);
  const [lockIframe1ScrollY, setLockIframe1ScrollY] = useState(true);
  const [lockIframe1ScrollX, setLockIframe1ScrollX] = useState(true);
  const [lockIframe2ScrollY, setLockIframe2ScrollY] = useState(true);
  const [lockIframe2ScrollX, setLockIframe2ScrollX] = useState(true);
  const [iframe1ZIndex, setIframe1ZIndex] = useState(10);
  const [iframe2ZIndex, setIframe2ZIndex] = useState(20);
  const [scale, setScale] = useState([100]);
  const [containerPosX, setContainerPosX] = useState(50);
  const [containerPosY, setContainerPosY] = useState(20);
  const [containerWidth, setContainerWidth] = useState([100]);
  const [containerHeight, setContainerHeight] = useState([100]);
  const [lockViewportScrollY, setLockViewportScrollY] = useState(false);
  const [lockViewportScrollX, setLockViewportScrollX] = useState(false);
  const [mediaZIndex, setMediaZIndex] = useState(10);
  const [bgColor, setBgColor] = useState("#667eea");
  const [borderColor, setBorderColor] = useState("#ffffff33");
  const [containerVisible, setContainerVisible] = useState(true);

  const [iframe1Url, setIframe1Url] = useState("");
  const [iframe1PosX, setIframe1PosX] = useState(25);
  const [iframe1PosY, setIframe1PosY] = useState(50);
  const [iframe1Scale, setIframe1Scale] = useState([100]);
  const [iframe1Width, setIframe1Width] = useState([400]);
  const [iframe1Height, setIframe1Height] = useState([300]);
  const [iframe1Visible, setIframe1Visible] = useState(true);

  const [iframe2Url, setIframe2Url] = useState("");
  const [iframe2PosX, setIframe2PosX] = useState(75);
  const [iframe2PosY, setIframe2PosY] = useState(50);
  const [iframe2Scale, setIframe2Scale] = useState([100]);
  const [iframe2Width, setIframe2Width] = useState([400]);
  const [iframe2Height, setIframe2Height] = useState([300]);
  const [iframe2Visible, setIframe2Visible] = useState(true);

  const [displayMode, setDisplayMode] = useState<"visualizer" | "image">("visualizer");
  const [imageUrl, setImageUrl] = useState("");
  const [stemModalOpen, setStemModalOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visitModalWidth, setVisitModalWidth] = useState(50);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrButtonPosY, setQrButtonPosY] = useState(92);
  const [qrButtonVisible, setQrButtonVisible] = useState(true);
  const [qrButtonColor, setQrButtonColor] = useState("#7c3aed");
  const [ctaAsButton, setCtaAsButton] = useState(false);
  const [ctaX, setCtaX] = useState(50);
  const [ctaY, setCtaY] = useState(20);
  const [ctaScale, setCtaScale] = useState([10]);
  const [ctaVisible, setCtaVisible] = useState(true);
  const [ctaFadeInSeconds, setCtaFadeInSeconds] = useState(1);
  const [ctaImageUrl, setCtaImageUrl] = useState("");
  const [ctaShape, setCtaShape] = useState<"circle" | "oval" | "square" | "rectangle">("circle");
  const [ctaBorderColor, setCtaBorderColor] = useState("#ffffff33");
  const [ctaBorderThickness, setCtaBorderThickness] = useState(4);
  const [ctaShadow3d, setCtaShadow3d] = useState(true);
  const [ctaGlow, setCtaGlow] = useState(false);
  const [ctaFadeComplete, setCtaFadeComplete] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const { toast } = useToast();
  const settingsLoadedRef = useRef(false);

  const collectSettings = useCallback(() => {
    const settings: Record<string, unknown> = {
      title, buttonLabel, buttonColor, buttonPosX, buttonPosY, buttonScale,
      visitModalWidth, qrButtonPosY, qrButtonVisible, qrButtonColor,
      ctaAsButton, ctaX, ctaY, ctaScale, ctaVisible, ctaFadeInSeconds,
      ctaShape, ctaBorderColor, ctaBorderThickness, ctaShadow3d, ctaGlow,
      volume, isMuted, isLooping, loopStart, loopEnd,
      shape, containerRounded, scale, containerPosX, containerPosY,
      containerWidth, containerHeight, lockViewportScrollY, lockViewportScrollX,
      mediaZIndex, bgColor, borderColor, containerVisible,
      displayMode,
      iframe1PosX, iframe1PosY, iframe1Scale, iframe1Width, iframe1Height, iframe1Visible,
      iframe1Rounded, lockIframe1ScrollY, lockIframe1ScrollX, iframe1ZIndex,
      iframe2PosX, iframe2PosY, iframe2Scale, iframe2Width, iframe2Height, iframe2Visible,
      iframe2Rounded, lockIframe2ScrollY, lockIframe2ScrollX, iframe2ZIndex,
    };
    const globalUrls: Record<string, string> = {
      buttonUrl, audioUrl: audioUrl || "",
      ctaImageUrl, imageUrl, iframe1Url, iframe2Url,
    };
    return { settings, globalUrls };
  }, [title, buttonLabel, buttonColor, buttonPosX, buttonPosY, buttonScale,
    visitModalWidth, qrButtonPosY, qrButtonVisible, qrButtonColor,
    ctaAsButton, ctaX, ctaY, ctaScale, ctaVisible, ctaFadeInSeconds,
    ctaShape, ctaBorderColor, ctaBorderThickness, ctaShadow3d, ctaGlow,
    volume, isMuted, isLooping, loopStart, loopEnd,
    shape, containerRounded, scale, containerPosX, containerPosY,
    containerWidth, containerHeight, lockViewportScrollY, lockViewportScrollX,
    mediaZIndex, bgColor, borderColor, containerVisible,
    displayMode,
    iframe1PosX, iframe1PosY, iframe1Scale, iframe1Width, iframe1Height, iframe1Visible,
    iframe1Rounded, lockIframe1ScrollY, lockIframe1ScrollX, iframe1ZIndex,
    iframe2PosX, iframe2PosY, iframe2Scale, iframe2Width, iframe2Height, iframe2Visible,
    iframe2Rounded, lockIframe2ScrollY, lockIframe2ScrollX, iframe2ZIndex,
    buttonUrl, audioUrl, ctaImageUrl, imageUrl, iframe1Url, iframe2Url]);

  const handleSaveSettings = useCallback(async () => {
    const width = window.innerWidth;
    const { settings, globalUrls } = collectSettings();
    try {
      await apiRequest("POST", "/api/route-settings", {
        route: "play", width, settings, globalUrls,
      });
      toast({ title: "Settings saved", description: `Saved for width ${width}px` });
    } catch {
      toast({ title: "Save failed", description: "Could not save settings", variant: "destructive" });
    }
  }, [collectSettings, toast]);

  const applySettings = useCallback((data: { settings: Record<string, unknown>; globalUrls: Record<string, string> }) => {
    const s = data.settings;
    const u = data.globalUrls;
    if (s.title !== undefined) setTitle(s.title as string);
    if (s.buttonLabel !== undefined) setButtonLabel(s.buttonLabel as string);
    if (s.buttonColor !== undefined) setButtonColor(s.buttonColor as string);
    if (s.buttonPosX !== undefined) setButtonPosX(s.buttonPosX as number);
    if (s.buttonPosY !== undefined) setButtonPosY(s.buttonPosY as number);
    if (s.buttonScale !== undefined) setButtonScale(s.buttonScale as number[]);
    if (s.visitModalWidth !== undefined) setVisitModalWidth(s.visitModalWidth as number);
    if (s.qrButtonPosY !== undefined) setQrButtonPosY(s.qrButtonPosY as number);
    if (s.qrButtonVisible !== undefined) setQrButtonVisible(s.qrButtonVisible as boolean);
    if (s.qrButtonColor !== undefined) setQrButtonColor(s.qrButtonColor as string);
    if (s.ctaAsButton !== undefined) setCtaAsButton(s.ctaAsButton as boolean);
    if (s.ctaX !== undefined) setCtaX(s.ctaX as number);
    if (s.ctaY !== undefined) setCtaY(s.ctaY as number);
    if (s.ctaScale !== undefined) setCtaScale(s.ctaScale as number[]);
    if (s.ctaVisible !== undefined) setCtaVisible(s.ctaVisible as boolean);
    if (s.ctaFadeInSeconds !== undefined) setCtaFadeInSeconds(s.ctaFadeInSeconds as number);
    if (s.ctaShape !== undefined) setCtaShape(s.ctaShape as "circle" | "oval" | "square" | "rectangle");
    if (s.ctaBorderColor !== undefined) setCtaBorderColor(s.ctaBorderColor as string);
    if (s.ctaBorderThickness !== undefined) setCtaBorderThickness(s.ctaBorderThickness as number);
    if (s.ctaShadow3d !== undefined) setCtaShadow3d(s.ctaShadow3d as boolean);
    if (s.ctaGlow !== undefined) setCtaGlow(s.ctaGlow as boolean);
    if (s.volume !== undefined) setVolume(s.volume as number[]);
    if (s.isMuted !== undefined) setIsMuted(s.isMuted as boolean);
    if (s.isLooping !== undefined) setIsLooping(s.isLooping as boolean);
    if (s.loopStart !== undefined) setLoopStart(s.loopStart as string);
    if (s.loopEnd !== undefined) setLoopEnd(s.loopEnd as string);
    if (s.shape !== undefined) setShape(s.shape as ContainerShape);
    if (s.containerRounded !== undefined) setContainerRounded(s.containerRounded as boolean);
    if (s.scale !== undefined) setScale(s.scale as number[]);
    if (s.containerPosX !== undefined) setContainerPosX(s.containerPosX as number);
    if (s.containerPosY !== undefined) setContainerPosY(s.containerPosY as number);
    if (s.containerWidth !== undefined) setContainerWidth(s.containerWidth as number[]);
    if (s.containerHeight !== undefined) setContainerHeight(s.containerHeight as number[]);
    if (s.lockViewportScrollY !== undefined) setLockViewportScrollY(s.lockViewportScrollY as boolean);
    if (s.lockViewportScrollX !== undefined) setLockViewportScrollX(s.lockViewportScrollX as boolean);
    if (s.mediaZIndex !== undefined) setMediaZIndex(s.mediaZIndex as number);
    if (s.bgColor !== undefined) setBgColor(s.bgColor as string);
    if (s.borderColor !== undefined) setBorderColor(s.borderColor as string);
    if (s.containerVisible !== undefined) setContainerVisible(s.containerVisible as boolean);
    if (s.displayMode !== undefined) setDisplayMode(s.displayMode as "visualizer" | "image");
    if (s.iframe1PosX !== undefined) setIframe1PosX(s.iframe1PosX as number);
    if (s.iframe1PosY !== undefined) setIframe1PosY(s.iframe1PosY as number);
    if (s.iframe1Scale !== undefined) setIframe1Scale(s.iframe1Scale as number[]);
    if (s.iframe1Width !== undefined) setIframe1Width(s.iframe1Width as number[]);
    if (s.iframe1Height !== undefined) setIframe1Height(s.iframe1Height as number[]);
    if (s.iframe1Visible !== undefined) setIframe1Visible(s.iframe1Visible as boolean);
    if (s.iframe1Rounded !== undefined) setIframe1Rounded(s.iframe1Rounded as boolean);
    if (s.lockIframe1ScrollY !== undefined) setLockIframe1ScrollY(s.lockIframe1ScrollY as boolean);
    if (s.lockIframe1ScrollX !== undefined) setLockIframe1ScrollX(s.lockIframe1ScrollX as boolean);
    if (s.iframe1ZIndex !== undefined) setIframe1ZIndex(s.iframe1ZIndex as number);
    if (s.iframe2PosX !== undefined) setIframe2PosX(s.iframe2PosX as number);
    if (s.iframe2PosY !== undefined) setIframe2PosY(s.iframe2PosY as number);
    if (s.iframe2Scale !== undefined) setIframe2Scale(s.iframe2Scale as number[]);
    if (s.iframe2Width !== undefined) setIframe2Width(s.iframe2Width as number[]);
    if (s.iframe2Height !== undefined) setIframe2Height(s.iframe2Height as number[]);
    if (s.iframe2Visible !== undefined) setIframe2Visible(s.iframe2Visible as boolean);
    if (s.iframe2Rounded !== undefined) setIframe2Rounded(s.iframe2Rounded as boolean);
    if (s.lockIframe2ScrollY !== undefined) setLockIframe2ScrollY(s.lockIframe2ScrollY as boolean);
    if (s.lockIframe2ScrollX !== undefined) setLockIframe2ScrollX(s.lockIframe2ScrollX as boolean);
    if (s.iframe2ZIndex !== undefined) setIframe2ZIndex(s.iframe2ZIndex as number);
    if (u.buttonUrl !== undefined) setButtonUrl(u.buttonUrl);
    if (u.audioUrl !== undefined) setAudioUrl(u.audioUrl);
    if (u.ctaImageUrl !== undefined) setCtaImageUrl(u.ctaImageUrl);
    if (u.imageUrl !== undefined) setImageUrl(u.imageUrl);
    if (u.iframe1Url !== undefined) setIframe1Url(u.iframe1Url);
    if (u.iframe2Url !== undefined) setIframe2Url(u.iframe2Url);
  }, []);

  useEffect(() => {
    if (settingsLoadedRef.current) return;
    settingsLoadedRef.current = true;
    const width = window.innerWidth;
    fetch(`/api/route-settings/play?width=${width}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.settings) {
          applySettings({ settings: data.settings as Record<string, unknown>, globalUrls: (data.globalUrls || {}) as Record<string, string> });
        }
      })
      .catch(() => {});
  }, [applySettings]);

  useEffect(() => {
    if (audioUrl.trim() && audioHistory.length === 0) {
      setAudioHistory(saveUrlToHistory(AUDIO_URLS_KEY, audioUrl));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => {
    const parsed = parseLoopMs(loopStart);
    loopStartRef.current = Math.min(parsed, durationRef.current > 0 ? durationRef.current : Infinity);
  }, [loopStart]);
  useEffect(() => {
    if (loopEnd) {
      const parsed = parseLoopMs(loopEnd);
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
    if (!ctaAsButton) {
      setCtaFadeComplete(false);
      return;
    }
    if (ctaFadeInSeconds <= 0) {
      setCtaFadeComplete(true);
      return;
    }
    const t = setTimeout(() => setCtaFadeComplete(true), ctaFadeInSeconds * 1000);
    return () => clearTimeout(t);
  }, [ctaAsButton, ctaFadeInSeconds]);

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

  // Mute is independent of play: only toggle sound, never play/pause
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
    setLoopStart("0");
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
    setLoopStart("0");
    autoPlayAttempted.current = false;
    setAudioHistory(saveUrlToHistory(AUDIO_URLS_KEY, url));
  }, []);
  const handleRemoveAudioUrl = useCallback((url: string) => {
    setAudioHistory(removeUrlFromHistory(AUDIO_URLS_KEY, url));
  }, []);

  const handleClick = useCallback(() => { if (buttonUrl) setVisitModalOpen(true); }, [buttonUrl]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (buttonUrl) setVisitModalOpen(true); }
  }, [buttonUrl]);
  const handleMuteToggle = useCallback((checked: boolean) => {
    setIsMuted(checked); // Mute only: does not affect play/stop
  }, []);
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
    setLoopStart(formatMs(clamped));
  }, [currentTime, duration]);
  const handleSetLoopEndToCurrent = useCallback(() => {
    const clamped = Math.min(currentTime, duration > 0 ? duration : currentTime);
    if (clamped > parseLoopMs(loopStart)) setLoopEnd(formatMs(clamped));
  }, [currentTime, duration, loopStart]);

  const sendAudioToStem = useCallback(() => {
    const iframe = stemIframeRef.current;
    if (!iframe?.contentWindow || !audioUrl) return;
    iframe.contentWindow.postMessage({ type: "load-audio-url", url: audioUrl }, "*");
  }, [audioUrl]);

  useEffect(() => {
    if (stemModalOpen) sendAudioToStem();
  }, [stemModalOpen, sendAudioToStem]);

  useEffect(() => {
    const prevX = document.body.style.overflowX;
    const prevY = document.body.style.overflowY;
    if (containerVisible) {
      document.body.style.overflowX = lockViewportScrollX ? "hidden" : "";
      document.body.style.overflowY = lockViewportScrollY ? "hidden" : "";
    } else {
      document.body.style.overflowX = "";
      document.body.style.overflowY = "";
    }
    return () => {
      document.body.style.overflowX = prevX;
      document.body.style.overflowY = prevY;
    };
  }, [containerVisible, lockViewportScrollX, lockViewportScrollY]);

  const loopStartSeconds = parseLoopMs(loopStart);
  const loopEndSeconds = loopEnd ? parseLoopMs(loopEnd) : 0;
  const isLoopValid = !loopEnd || (loopEndSeconds > loopStartSeconds && loopEndSeconds <= duration);

  const currentShape = shapeStyles[shape];
  const scaleFactor = scale[0] / 100;

  return (
    <div className="min-h-screen flex items-center justify-center p-5 relative" style={{ backgroundColor: bgColor }}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" crossOrigin="anonymous" />

      {!standalone && (
      <div className="absolute top-4 left-4 right-4 flex flex-row items-center gap-2 z-10 flex-wrap">
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen} modal={false}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="text-white scale-[1.2]"
              aria-label="Open settings menu"
              data-testid="button-menu"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
        <SheetContent
          side="left"
          allowBackdropInteraction
          className="!inset-0 !left-0 !top-0 !right-0 !bottom-0 !h-full !w-full !max-w-none !border-0 !p-0 !bg-transparent !shadow-none [&>button]:hidden"
        >
          <DraggableResizablePanel
            onClose={() => setSettingsOpen(false)}
            title="Settings"
            description="Customize audio playback and button appearance"
          >
          <div className="flex flex-col gap-6">
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
              <Label className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Container Display
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant={displayMode === "visualizer" ? "default" : "outline"}
                  onClick={() => setDisplayMode("visualizer")}
                  data-testid="button-mode-visualizer"
                >
                  <Music className="w-4 h-4 mr-1" />
                  Visualizer
                </Button>
                <Button
                  size="sm"
                  variant={displayMode === "image" ? "default" : "outline"}
                  onClick={() => setDisplayMode("image")}
                  data-testid="button-mode-image"
                >
                  <ImageIcon className="w-4 h-4 mr-1" />
                  Image
                </Button>
              </div>
              {displayMode === "image" && (
                <div className="space-y-1">
                  <Label htmlFor="image-url-input" className="text-xs text-muted-foreground">Image URL</Label>
                  <Input
                    id="image-url-input"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/cover.jpg"
                    data-testid="input-image-url"
                  />
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

            <div className="space-y-4 p-3 bg-muted rounded-md">
              <Label className="text-sm font-medium">Launch-site button</Label>
              <ColorPickerField label="Color" color={buttonColor} onChange={setButtonColor} testId="color-launch-button" />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">X position (%)</Label>
                  <span className="text-xs text-muted-foreground">{buttonPosX}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MicroAdjustButton step={() => setButtonPosX(Math.max(0, Math.min(100, buttonPosX - 0.01)))} aria-label="Decrease X" data-testid="micro-button-pos-x-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                  <Slider value={[buttonPosX]} onValueChange={(v) => setButtonPosX(v[0])} min={0} max={100} step={0.01} className="flex-1" data-testid="slider-button-pos-x" />
                  <MicroAdjustButton step={() => setButtonPosX(Math.max(0, Math.min(100, buttonPosX + 0.01)))} aria-label="Increase X" data-testid="micro-button-pos-x-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Y position (%)</Label>
                  <span className="text-xs text-muted-foreground">{buttonPosY}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MicroAdjustButton step={() => setButtonPosY(Math.max(0, Math.min(100, buttonPosY - 0.01)))} aria-label="Decrease Y" data-testid="micro-button-pos-y-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                  <Slider value={[buttonPosY]} onValueChange={(v) => setButtonPosY(v[0])} min={0} max={100} step={0.01} className="flex-1" data-testid="slider-button-pos-y" />
                  <MicroAdjustButton step={() => setButtonPosY(Math.max(0, Math.min(100, buttonPosY + 0.01)))} aria-label="Increase Y" data-testid="micro-button-pos-y-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Scale</Label>
                  <span className="text-xs text-muted-foreground">{buttonScale[0]}%</span>
                </div>
                <Slider value={buttonScale} onValueChange={setButtonScale} min={50} max={200} step={5} className="w-full" data-testid="slider-button-scale" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Launch modal width (%)</Label>
                  <span className="text-xs text-muted-foreground">{visitModalWidth}%</span>
                </div>
                <Slider value={[visitModalWidth]} onValueChange={(v) => setVisitModalWidth(v[0])} min={30} max={100} step={5} className="w-full" data-testid="slider-visit-modal-width" />
              </div>
            </div>

            <div className="space-y-4 p-3 bg-muted rounded-md">
              <Label className="text-sm font-medium">QR Share section</Label>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Visibility</Label>
                <Switch checked={qrButtonVisible} onCheckedChange={setQrButtonVisible} data-testid="switch-qr-button-visible" />
              </div>
              <ColorPickerField label="Color" color={qrButtonColor} onChange={setQrButtonColor} testId="color-qr-button" />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Y position (%)</Label>
                  <span className="text-xs text-muted-foreground">{qrButtonPosY}</span>
                </div>
                <Slider value={[qrButtonPosY]} onValueChange={(v) => setQrButtonPosY(v[0])} min={0} max={100} step={0.5} className="w-full" data-testid="slider-qr-button-y" />
              </div>
            </div>

            <div className="space-y-4 p-3 bg-muted rounded-md">
              <Label className="text-sm font-medium">CTA section</Label>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Use section as clickable button</Label>
                <Switch checked={ctaAsButton} onCheckedChange={setCtaAsButton} data-testid="switch-cta-as-button" />
              </div>
              {ctaAsButton && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">X (%)</Label>
                      <span className="text-xs text-muted-foreground">{ctaX}</span>
                    </div>
                    <Slider value={[ctaX]} onValueChange={(v) => setCtaX(v[0])} min={0} max={100} step={0.5} className="w-full" data-testid="slider-cta-x" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Y (%)</Label>
                      <span className="text-xs text-muted-foreground">{ctaY}</span>
                    </div>
                    <Slider value={[ctaY]} onValueChange={(v) => setCtaY(v[0])} min={0} max={100} step={0.5} className="w-full" data-testid="slider-cta-y" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Scale (%)</Label>
                      <span className="text-xs text-muted-foreground">{ctaScale[0]}</span>
                    </div>
                    <Slider value={ctaScale} onValueChange={setCtaScale} min={5} max={200} step={5} className="w-full" data-testid="slider-cta-scale" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Visibility</Label>
                    <Switch checked={ctaVisible} onCheckedChange={setCtaVisible} data-testid="switch-cta-visible" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs" title="Duration for the fade-in visibility animation">Fade in (seconds)</Label>
                      <span className="text-xs text-muted-foreground">{ctaFadeInSeconds}</span>
                    </div>
                    <Slider value={[ctaFadeInSeconds]} onValueChange={(v) => setCtaFadeInSeconds(v[0])} min={0} max={10} step={0.5} className="w-full" data-testid="slider-cta-fade-in" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Glow animation</Label>
                    <Switch checked={ctaGlow} onCheckedChange={setCtaGlow} data-testid="switch-cta-glow" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Button image URL</Label>
                    <Input value={ctaImageUrl} onChange={(e) => setCtaImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" className="text-xs" data-testid="input-cta-image-url" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Button shape</Label>
                    <div className="grid grid-cols-4 gap-1">
                      {(["circle", "oval", "square", "rectangle"] as const).map((s) => (
                        <Button key={s} size="sm" variant={ctaShape === s ? "default" : "outline"} onClick={() => setCtaShape(s)} className="text-xs capitalize" data-testid={`button-cta-shape-${s}`}>{s}</Button>
                      ))}
                    </div>
                  </div>
                  <ColorPickerField label="Border color" color={ctaBorderColor} onChange={setCtaBorderColor} testId="color-cta-border" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Border thickness</Label>
                      <span className="text-xs text-muted-foreground">{ctaBorderThickness}px</span>
                    </div>
                    <Slider value={[ctaBorderThickness]} onValueChange={(v) => setCtaBorderThickness(v[0])} min={0} max={20} step={1} className="w-full" data-testid="slider-cta-border-thickness" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">3D shadow</Label>
                    <Switch checked={ctaShadow3d} onCheckedChange={setCtaShadow3d} data-testid="switch-cta-shadow-3d" />
                  </div>
                </>
              )}
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
              <div className="flex items-center justify-between pt-2">
                <Label className="text-xs">Rounded edges (media container)</Label>
                <Switch checked={containerRounded} onCheckedChange={setContainerRounded} data-testid="switch-container-rounded" />
              </div>
            </div>

            <div className="space-y-4 p-3 bg-muted rounded-md">
              <Label className="text-sm font-medium">Position & scale (entire view space)</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Scale</Label>
                  <span className="text-xs text-muted-foreground">{scale[0]}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <MicroAdjustButton step={() => setScale([Math.max(50, Math.min(200, scale[0] - 0.01))])} aria-label="Decrease scale" data-testid="micro-scale-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                  <Slider value={scale} onValueChange={setScale} min={50} max={200} step={0.01} className="flex-1" data-testid="slider-scale" />
                  <MicroAdjustButton step={() => setScale([Math.max(50, Math.min(200, scale[0] + 0.01))])} aria-label="Increase scale" data-testid="micro-scale-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">X position (%)</Label>
                  <span className="text-xs text-muted-foreground">{containerPosX}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MicroAdjustButton step={() => setContainerPosX(Math.max(0, Math.min(100, containerPosX - 0.01)))} aria-label="Decrease X position" data-testid="micro-pos-x-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                  <Slider value={[containerPosX]} onValueChange={(v) => setContainerPosX(v[0])} min={0} max={100} step={0.01} className="flex-1" data-testid="slider-container-pos-x" />
                  <MicroAdjustButton step={() => setContainerPosX(Math.max(0, Math.min(100, containerPosX + 0.01)))} aria-label="Increase X position" data-testid="micro-pos-x-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Y position (%)</Label>
                  <span className="text-xs text-muted-foreground">{containerPosY}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MicroAdjustButton step={() => setContainerPosY(Math.max(0, Math.min(100, containerPosY - 0.01)))} aria-label="Decrease Y position" data-testid="micro-pos-y-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                  <Slider value={[containerPosY]} onValueChange={(v) => setContainerPosY(v[0])} min={0} max={100} step={0.01} className="flex-1" data-testid="slider-container-pos-y" />
                  <MicroAdjustButton step={() => setContainerPosY(Math.max(0, Math.min(100, containerPosY + 0.01)))} aria-label="Increase Y position" data-testid="micro-pos-y-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Width (%)</Label>
                  <span className="text-xs text-muted-foreground">{containerWidth[0]}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <MicroAdjustButton step={() => setContainerWidth([Math.max(50, Math.min(200, containerWidth[0] - 0.01))])} aria-label="Decrease width" data-testid="micro-width-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                  <Slider value={containerWidth} onValueChange={setContainerWidth} min={50} max={200} step={0.01} className="flex-1" data-testid="slider-container-width" />
                  <MicroAdjustButton step={() => setContainerWidth([Math.max(50, Math.min(200, containerWidth[0] + 0.01))])} aria-label="Increase width" data-testid="micro-width-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Height (%)</Label>
                  <span className="text-xs text-muted-foreground">{containerHeight[0]}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <MicroAdjustButton step={() => setContainerHeight([Math.max(50, Math.min(200, containerHeight[0] - 0.01))])} aria-label="Decrease height" data-testid="micro-height-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                  <Slider value={containerHeight} onValueChange={setContainerHeight} min={50} max={200} step={0.01} className="flex-1" data-testid="slider-container-height" />
                  <MicroAdjustButton step={() => setContainerHeight([Math.max(50, Math.min(200, containerHeight[0] + 0.01))])} aria-label="Increase height" data-testid="micro-height-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Lock vertical scroll</Label>
                <Switch checked={lockViewportScrollY} onCheckedChange={setLockViewportScrollY} data-testid="switch-lock-viewport-scroll-y" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Lock horizontal scroll</Label>
                <Switch checked={lockViewportScrollX} onCheckedChange={setLockViewportScrollX} data-testid="switch-lock-viewport-scroll-x" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Z-order (overlap)</Label>
                <Select value={String(mediaZIndex)} onValueChange={(v) => setMediaZIndex(Number(v))} data-testid="select-media-z-index">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Z-order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Bottom</SelectItem>
                    <SelectItem value="20">Middle</SelectItem>
                    <SelectItem value="30">Top</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                      {loopStart} - {loopEnd || formatMs(duration)} ms
                    </span>
                  </div>
                  <Slider
                    value={[
                      duration > 0 ? (loopStartSeconds / duration) * 100 : 0,
                      duration > 0 ? ((loopEnd ? loopEndSeconds : duration) / duration) * 100 : 100,
                    ]}
                    onValueChange={(values) => {
                      if (duration > 0) {
                        setLoopStart(formatMs((values[0] / 100) * duration));
                        if (values[1] < 100) { setLoopEnd(formatMs((values[1] / 100) * duration)); }
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
                    <div className="flex items-center gap-1">
                      <MicroAdjustButton step={() => { const ms = parseFloat(loopStart || "0") - 0.01; setLoopStart(String(Math.max(0, ms))); }} aria-label="Decrease start" data-testid="micro-loop-start-input-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                      <Input id="loop-start" value={loopStart} onChange={(e) => setLoopStart(e.target.value)} placeholder="0" className="w-24 text-center" data-testid="input-loop-start" />
                      <MicroAdjustButton step={() => { const maxMs = duration > 0 ? duration * 1000 : 0; const ms = parseFloat(loopStart || "0") + 0.01; setLoopStart(String(Math.min(maxMs, ms))); }} aria-label="Increase start" data-testid="micro-loop-start-input-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                      <Button size="sm" variant="outline" onClick={handleSetLoopStartToCurrent} data-testid="button-set-loop-start">Set</Button>
                      <Button size="sm" variant="secondary" className="text-muted-foreground" onClick={() => setLoopStart("0")} data-testid="button-clear-loop-start">Clear</Button>
                      <span className="text-xs text-muted-foreground ml-1 whitespace-nowrap" title="Fine adjust ±0.001 ms">Fine</span>
                      <MicroAdjustButton step={() => { const ms = parseFloat(loopStart || "0") - 0.001; setLoopStart(String(Math.max(0, ms))); }} aria-label="Fine decrease start (0.001 ms)" data-testid="fine-loop-start-minus" className="bg-neutral-400 text-neutral-900 border-2 border-neutral-500 border-b-neutral-600 border-r-neutral-600 shadow-[0_2px_0_0_#374151] active:translate-y-[1px] active:shadow-none hover:bg-neutral-300"><Minus className="w-4 h-4" /></MicroAdjustButton>
                      <MicroAdjustButton step={() => { const maxMs = duration > 0 ? duration * 1000 : 0; const ms = parseFloat(loopStart || "0") + 0.001; setLoopStart(String(Math.min(maxMs, ms))); }} aria-label="Fine increase start (0.001 ms)" data-testid="fine-loop-start-plus" className="bg-neutral-400 text-neutral-900 border-2 border-neutral-500 border-b-neutral-600 border-r-neutral-600 shadow-[0_2px_0_0_#374151] active:translate-y-[1px] active:shadow-none hover:bg-neutral-300"><Plus className="w-4 h-4" /></MicroAdjustButton>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="loop-end" className="text-sm font-medium whitespace-nowrap">End</Label>
                    <div className="flex items-center gap-1">
                      <MicroAdjustButton step={() => { const ms = parseFloat(loopEnd || "0") - 0.01; setLoopEnd(String(Math.max(0, ms))); }} aria-label="Decrease end" data-testid="micro-loop-end-input-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                      <Input id="loop-end" value={loopEnd} onChange={(e) => setLoopEnd(e.target.value)} placeholder="e.g. 24000" className={`w-24 text-center ${!isLoopValid ? "border-destructive" : ""}`} data-testid="input-loop-end" />
                      <MicroAdjustButton step={() => { const maxMs = duration > 0 ? duration * 1000 : 0; const ms = parseFloat(loopEnd || String(maxMs)) + 0.01; setLoopEnd(String(Math.min(maxMs, ms))); }} aria-label="Increase end" data-testid="micro-loop-end-input-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                      <Button size="sm" variant="outline" onClick={handleSetLoopEndToCurrent} data-testid="button-set-loop-end">Set</Button>
                      <Button size="sm" variant="secondary" className="text-muted-foreground" onClick={() => setLoopEnd("")} data-testid="button-clear-loop-end">Clear</Button>
                      <span className="text-xs text-muted-foreground ml-1 whitespace-nowrap" title="Fine adjust ±0.001 ms">Fine</span>
                      <MicroAdjustButton step={() => { const ms = parseFloat(loopEnd || "0") - 0.001; setLoopEnd(String(Math.max(0, ms))); }} aria-label="Fine decrease end (0.001 ms)" data-testid="fine-loop-end-minus" className="bg-neutral-400 text-neutral-900 border-2 border-neutral-500 border-b-neutral-600 border-r-neutral-600 shadow-[0_2px_0_0_#374151] active:translate-y-[1px] active:shadow-none hover:bg-neutral-300"><Minus className="w-4 h-4" /></MicroAdjustButton>
                      <MicroAdjustButton step={() => { const maxMs = duration > 0 ? duration * 1000 : 0; const ms = parseFloat(loopEnd || String(maxMs)) + 0.001; setLoopEnd(String(Math.min(maxMs, ms))); }} aria-label="Fine increase end (0.001 ms)" data-testid="fine-loop-end-plus" className="bg-neutral-400 text-neutral-900 border-2 border-neutral-500 border-b-neutral-600 border-r-neutral-600 shadow-[0_2px_0_0_#374151] active:translate-y-[1px] active:shadow-none hover:bg-neutral-300"><Plus className="w-4 h-4" /></MicroAdjustButton>
                    </div>
                  </div>
                  {!isLoopValid && <p className="text-xs text-destructive">End time must be after start time</p>}
                  <p className="text-xs text-muted-foreground">Enter time in milliseconds (e.g., 20000 for 20 seconds). ±0.01 ms with +/−; Fine adjust ±0.001 ms</p>
                </div>
              </div>
            )}
            <div className="border-t border-border pt-4 space-y-4">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                iFrame Container 1
              </Label>
              <div className="space-y-3 p-3 bg-muted rounded-md">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    {iframe1Visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    Visible
                  </Label>
                  <Switch checked={iframe1Visible} onCheckedChange={setIframe1Visible} data-testid="switch-iframe1-visible" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Rounded edges</Label>
                  <Switch checked={iframe1Rounded} onCheckedChange={setIframe1Rounded} data-testid="switch-iframe1-rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Lock vertical scroll</Label>
                  <Switch checked={lockIframe1ScrollY} onCheckedChange={setLockIframe1ScrollY} data-testid="switch-iframe1-lock-scroll-y" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Lock horizontal scroll</Label>
                  <Switch checked={lockIframe1ScrollX} onCheckedChange={setLockIframe1ScrollX} data-testid="switch-iframe1-lock-scroll-x" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Z-order (overlap)</Label>
                  <Select value={String(iframe1ZIndex)} onValueChange={(v) => setIframe1ZIndex(Number(v))} data-testid="select-iframe1-z-index">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Z-order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">Bottom</SelectItem>
                      <SelectItem value="20">Middle</SelectItem>
                      <SelectItem value="30">Top</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL Source</Label>
                  <Input value={iframe1Url} onChange={(e) => setIframe1Url(e.target.value)} placeholder="https://example.com" data-testid="input-iframe1-url" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">X position (%)</Label>
                    <span className="text-xs text-muted-foreground">{iframe1PosX}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MicroAdjustButton step={() => setIframe1PosX(Math.max(0, Math.min(100, iframe1PosX - 0.01)))} aria-label="Decrease X" data-testid="micro-iframe1-pos-x-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                    <Slider value={[iframe1PosX]} onValueChange={(v) => setIframe1PosX(v[0])} min={0} max={100} step={0.01} className="flex-1" data-testid="slider-iframe1-pos-x" />
                    <MicroAdjustButton step={() => setIframe1PosX(Math.max(0, Math.min(100, iframe1PosX + 0.01)))} aria-label="Increase X" data-testid="micro-iframe1-pos-x-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Y position (%)</Label>
                    <span className="text-xs text-muted-foreground">{iframe1PosY}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MicroAdjustButton step={() => setIframe1PosY(Math.max(0, Math.min(100, iframe1PosY - 0.01)))} aria-label="Decrease Y" data-testid="micro-iframe1-pos-y-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                    <Slider value={[iframe1PosY]} onValueChange={(v) => setIframe1PosY(v[0])} min={0} max={100} step={0.01} className="flex-1" data-testid="slider-iframe1-pos-y" />
                    <MicroAdjustButton step={() => setIframe1PosY(Math.max(0, Math.min(100, iframe1PosY + 0.01)))} aria-label="Increase Y" data-testid="micro-iframe1-pos-y-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Scale (%)</Label>
                    <span className="text-xs text-muted-foreground">{iframe1Scale[0]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MicroAdjustButton step={() => setIframe1Scale([Math.max(10, Math.min(300, iframe1Scale[0] - 0.01))])} aria-label="Decrease scale" data-testid="micro-iframe1-scale-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                    <Slider value={iframe1Scale} onValueChange={setIframe1Scale} min={10} max={300} step={0.01} className="flex-1" data-testid="slider-iframe1-scale" />
                    <MicroAdjustButton step={() => setIframe1Scale([Math.max(10, Math.min(300, iframe1Scale[0] + 0.01))])} aria-label="Increase scale" data-testid="micro-iframe1-scale-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Width (px)</Label>
                    <span className="text-xs text-muted-foreground">{iframe1Width[0]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MicroAdjustButton step={() => setIframe1Width([Math.max(100, Math.min(2000, iframe1Width[0] - 0.01))])} aria-label="Decrease width" data-testid="micro-iframe1-width-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                    <Slider value={iframe1Width} onValueChange={setIframe1Width} min={100} max={2000} step={0.01} className="flex-1" data-testid="slider-iframe1-width" />
                    <MicroAdjustButton step={() => setIframe1Width([Math.max(100, Math.min(2000, iframe1Width[0] + 0.01))])} aria-label="Increase width" data-testid="micro-iframe1-width-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Height (px)</Label>
                    <span className="text-xs text-muted-foreground">{iframe1Height[0]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MicroAdjustButton step={() => setIframe1Height([Math.max(50, Math.min(900, iframe1Height[0] - 0.01))])} aria-label="Decrease height" data-testid="micro-iframe1-height-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                    <Slider value={iframe1Height} onValueChange={setIframe1Height} min={50} max={900} step={0.01} className="flex-1" data-testid="slider-iframe1-height" />
                    <MicroAdjustButton step={() => setIframe1Height([Math.max(50, Math.min(900, iframe1Height[0] + 0.01))])} aria-label="Increase height" data-testid="micro-iframe1-height-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                iFrame Container 2
              </Label>
              <div className="space-y-3 p-3 bg-muted rounded-md">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    {iframe2Visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    Visible
                  </Label>
                  <Switch checked={iframe2Visible} onCheckedChange={setIframe2Visible} data-testid="switch-iframe2-visible" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Rounded edges</Label>
                  <Switch checked={iframe2Rounded} onCheckedChange={setIframe2Rounded} data-testid="switch-iframe2-rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Lock vertical scroll</Label>
                  <Switch checked={lockIframe2ScrollY} onCheckedChange={setLockIframe2ScrollY} data-testid="switch-iframe2-lock-scroll-y" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Lock horizontal scroll</Label>
                  <Switch checked={lockIframe2ScrollX} onCheckedChange={setLockIframe2ScrollX} data-testid="switch-iframe2-lock-scroll-x" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Z-order (overlap)</Label>
                  <Select value={String(iframe2ZIndex)} onValueChange={(v) => setIframe2ZIndex(Number(v))} data-testid="select-iframe2-z-index">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Z-order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">Bottom</SelectItem>
                      <SelectItem value="20">Middle</SelectItem>
                      <SelectItem value="30">Top</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL Source</Label>
                  <Input value={iframe2Url} onChange={(e) => setIframe2Url(e.target.value)} placeholder="https://example.com" data-testid="input-iframe2-url" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">X position (%)</Label>
                    <span className="text-xs text-muted-foreground">{iframe2PosX}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MicroAdjustButton step={() => setIframe2PosX(Math.max(0, Math.min(100, iframe2PosX - 0.01)))} aria-label="Decrease X" data-testid="micro-iframe2-pos-x-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                    <Slider value={[iframe2PosX]} onValueChange={(v) => setIframe2PosX(v[0])} min={0} max={100} step={0.01} className="flex-1" data-testid="slider-iframe2-pos-x" />
                    <MicroAdjustButton step={() => setIframe2PosX(Math.max(0, Math.min(100, iframe2PosX + 0.01)))} aria-label="Increase X" data-testid="micro-iframe2-pos-x-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Y position (%)</Label>
                    <span className="text-xs text-muted-foreground">{iframe2PosY}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MicroAdjustButton step={() => setIframe2PosY(Math.max(0, Math.min(100, iframe2PosY - 0.01)))} aria-label="Decrease Y" data-testid="micro-iframe2-pos-y-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                    <Slider value={[iframe2PosY]} onValueChange={(v) => setIframe2PosY(v[0])} min={0} max={100} step={0.01} className="flex-1" data-testid="slider-iframe2-pos-y" />
                    <MicroAdjustButton step={() => setIframe2PosY(Math.max(0, Math.min(100, iframe2PosY + 0.01)))} aria-label="Increase Y" data-testid="micro-iframe2-pos-y-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Scale (%)</Label>
                    <span className="text-xs text-muted-foreground">{iframe2Scale[0]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MicroAdjustButton step={() => setIframe2Scale([Math.max(10, Math.min(300, iframe2Scale[0] - 0.01))])} aria-label="Decrease scale" data-testid="micro-iframe2-scale-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                    <Slider value={iframe2Scale} onValueChange={setIframe2Scale} min={10} max={300} step={0.01} className="flex-1" data-testid="slider-iframe2-scale" />
                    <MicroAdjustButton step={() => setIframe2Scale([Math.max(10, Math.min(300, iframe2Scale[0] + 0.01))])} aria-label="Increase scale" data-testid="micro-iframe2-scale-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Width (px)</Label>
                    <span className="text-xs text-muted-foreground">{iframe2Width[0]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MicroAdjustButton step={() => setIframe2Width([Math.max(100, Math.min(2000, iframe2Width[0] - 0.01))])} aria-label="Decrease width" data-testid="micro-iframe2-width-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                    <Slider value={iframe2Width} onValueChange={setIframe2Width} min={100} max={2000} step={0.01} className="flex-1" data-testid="slider-iframe2-width" />
                    <MicroAdjustButton step={() => setIframe2Width([Math.max(100, Math.min(2000, iframe2Width[0] + 0.01))])} aria-label="Increase width" data-testid="micro-iframe2-width-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Height (px)</Label>
                    <span className="text-xs text-muted-foreground">{iframe2Height[0]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MicroAdjustButton step={() => setIframe2Height([Math.max(50, Math.min(900, iframe2Height[0] - 0.01))])} aria-label="Decrease height" data-testid="micro-iframe2-height-minus"><Minus className="w-4 h-4" /></MicroAdjustButton>
                    <Slider value={iframe2Height} onValueChange={setIframe2Height} min={50} max={900} step={0.01} className="flex-1" data-testid="slider-iframe2-height" />
                    <MicroAdjustButton step={() => setIframe2Height([Math.max(50, Math.min(900, iframe2Height[0] + 0.01))])} aria-label="Increase height" data-testid="micro-iframe2-height-plus"><Plus className="w-4 h-4" /></MicroAdjustButton>
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={handleSaveSettings} className="w-full mt-4" data-testid="button-save-settings">
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </div>
          </DraggableResizablePanel>
        </SheetContent>
      </Sheet>
        <div className="flex items-center gap-2 rounded-md bg-black/30 px-2 py-1.5 text-white shrink-0">
          <Label htmlFor="visibility-toggle-page" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
            {containerVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Container Visible
          </Label>
          <Switch id="visibility-toggle-page" checked={containerVisible} onCheckedChange={setContainerVisible} data-testid="switch-visibility-page" />
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="text-white bg-amber-500 border-2 border-amber-400 border-b-amber-700 border-r-amber-700 rounded-lg shrink-0 shadow-[0_4px_0_0_#b45309,0_6px_8px_rgba(0,0,0,0.25)] active:translate-y-[2px] active:shadow-[0_1px_0_0_#b45309,0_2px_4px_rgba(0,0,0,0.2)] transition-all hover:bg-amber-400"
          aria-label="Go to View (video) page"
          asChild
        >
          <a href="/view/config" data-testid="button-launch-view">
            <Film className="w-6 h-6" />
          </a>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="bg-red-500 text-white border-2 border-red-400 border-b-red-700 border-r-red-700 rounded-lg shrink-0 shadow-[0_4px_0_0_#b91c1c,0_6px_8px_rgba(0,0,0,0.25)] active:translate-y-[2px] active:shadow-[0_1px_0_0_#b91c1c,0_2px_4px_rgba(0,0,0,0.2)] transition-all hover:bg-red-400"
          aria-label="Open Stem Separator"
          onClick={() => {
            setIsPlaying(false);
            if (audioRef.current) audioRef.current.pause();
            setStemModalOpen(true);
          }}
          data-testid="button-stem"
        >
          <Music className="w-6 h-6" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-white bg-emerald-600 border-2 border-emerald-500 border-b-emerald-800 border-r-emerald-800 rounded-lg shrink-0 shadow-[0_4px_0_0_#065f46,0_6px_8px_rgba(0,0,0,0.25)] active:translate-y-[2px] active:shadow-[0_1px_0_0_#065f46,0_2px_4px_rgba(0,0,0,0.2)] transition-all hover:bg-emerald-500"
          aria-label={isPlaying ? "Stop" : "Play"}
          onClick={handlePlayToggle}
          data-testid="button-floating-play"
        >
          {isPlaying ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </Button>
      </div>
      )}

      {stemModalOpen && (
        <StemModal
          audioUrl={audioUrl}
          stemIframeRef={stemIframeRef}
          onLoad={sendAudioToStem}
          onClose={() => setStemModalOpen(false)}
        />
      )}

      <div className="relative w-full min-h-screen" style={{ display: containerVisible ? "block" : "none" }}>
        {ctaAsButton && (
          <button
            type="button"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={`absolute cursor-pointer border-none p-0 z-[15] ${ctaGlow ? "animate-cta-glow" : ""}`}
            style={{
              left: `${ctaX}%`,
              top: `${ctaY}%`,
              width: "80%",
              height: "70%",
              transform: `translate(-50%, -50%) scale(${ctaScale[0] / 100})`,
              opacity: ctaVisible ? (ctaFadeComplete || ctaFadeInSeconds <= 0 ? 1 : 0) : 0,
              visibility: ctaVisible ? "visible" : "hidden",
              transition: `opacity ${ctaFadeInSeconds}s ease-out`,
              border: `${ctaBorderThickness}px solid ${ctaBorderColor}`,
              borderRadius: ctaShape === "circle" || ctaShape === "oval" ? "50%" : ctaShape === "square" ? "0" : "12px",
              background: ctaImageUrl ? `center/cover no-repeat url(${ctaImageUrl})` : "transparent",
              boxShadow: !ctaGlow && ctaShadow3d ? "0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25)" : !ctaGlow ? "none" : undefined,
            }}
            aria-label={`Visit ${buttonUrl || "website"}`}
            data-testid="cta-button"
          />
        )}
        <div className="grid grid-rows-[auto_1fr] w-full min-h-screen gap-0 text-center">
          <div className="flex items-center justify-center pt-24 sm:pt-16 md:pt-6 pb-0 shrink-0">
            <h1
              className="text-white text-2xl md:text-3xl font-semibold"
              style={{ textShadow: "2px 2px 4px rgba(0, 0, 0, 0.2)" }}
              data-testid="text-title"
            >
              {title}
            </h1>
          </div>

          <div className="relative w-full min-h-0 flex items-stretch justify-stretch">
            <button
            type="button"
            className={`absolute cursor-pointer bg-transparent border-none p-0 transition-transform duration-300 ${currentShape.widthClass} ${currentShape.heightClass}`}
            style={{
              left: `${containerPosX}%`,
              top: `${containerPosY}%`,
              transform: `translate(-50%, -50%) scale(${(scaleFactor * containerWidth[0]) / 100}, ${(scaleFactor * containerHeight[0]) / 100}) ${isHovered ? "translateY(-4px)" : "translateY(0)"}`,
              transformOrigin: "center center",
              zIndex: mediaZIndex,
            }}
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
              borderRadius: containerRounded ? currentShape.borderRadius : "0",
              boxShadow: isHovered
                ? `0 20px 60px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.3), inset 0 -2px 6px rgba(0,0,0,0.2)`
                : `0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25), inset 0 -2px 6px rgba(0,0,0,0.15)`,
              border: `4px solid ${borderColor}`,
              background: "linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.8) 100%)",
              animation: shape === "circle" && isPlaying ? "spin-record 4s linear infinite" : "none",
            }}
          >
            {displayMode === "image" && imageUrl ? (
              <img
                src={imageUrl}
                alt="Cover"
                className="absolute inset-0 w-full h-full object-cover"
                data-testid="img-cover"
              />
            ) : (
              <>
                <AudioVisualizer audioRef={audioRef} isPlaying={isPlaying} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
                  <Music className="w-12 h-12 md:w-16 md:h-16 text-white/30" />
                </div>
              </>
            )}

            <div
              className="absolute inset-0 z-20 pointer-events-none"
              style={{
                animation: shape === "circle" && isPlaying ? "spin-record-reverse 4s linear infinite" : "none",
              }}
            >
              <div
                className="absolute pointer-events-auto"
                style={{ bottom: "12%", right: "12%" }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setIsMuted((m) => !m); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setIsMuted((m) => !m); } }}
                  className="rounded-full bg-black/50 text-white/80 w-9 h-9 flex items-center justify-center cursor-pointer"
                  aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                  title={isMuted ? "Unmute (sound only, does not change play/stop)" : "Mute (sound only, does not change play/stop)"}
                  data-testid="button-mute-overlay"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </div>
              </div>

              <div
                className="absolute inset-0 z-10 transition-all duration-300 pointer-events-none"
                style={{
                  background: isHovered
                    ? "radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 70%)"
                    : "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)",
                }}
              >
                <div
                  className="absolute flex items-center gap-2 text-white px-4 py-2 md:px-6 md:py-3 rounded-full font-semibold text-xs md:text-sm transition-opacity duration-300 pointer-events-auto"
                  style={{
                    left: `${buttonPosX}%`,
                    top: `${buttonPosY}%`,
                    transform: `translate(-50%, -50%) scale(${buttonScale[0] / 100})`,
                    backgroundColor: buttonColor,
                    opacity: isHovered && (!ctaAsButton || !ctaVisible) ? 1 : 0,
                    visibility: isHovered && (!ctaAsButton || !ctaVisible) ? "visible" : "hidden",
                  }}
                  data-testid="text-click-indicator"
                >
                  <span>{buttonLabel}</span>
                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                </div>
              </div>
            </div>
          </div>
        </button>

          {iframe1Visible && iframe1Url && (
            <div
              className="absolute pointer-events-auto"
              style={{
                left: `${iframe1PosX}%`,
                top: `${iframe1PosY}%`,
                transform: `translate(-50%, -50%) scale(${iframe1Scale[0] / 100})`,
                width: `${iframe1Width[0]}px`,
                height: `${iframe1Height[0]}px`,
                borderRadius: iframe1Rounded ? "12px" : 0,
                overflowX: lockIframe1ScrollX ? "hidden" : "auto",
                overflowY: lockIframe1ScrollY ? "hidden" : "auto",
                zIndex: iframe1ZIndex,
              }}
              data-testid="iframe1-container"
            >
              <iframe
                src={iframe1Url}
                className="w-full h-full border-0 shadow-lg"
                title="iFrame Container 1"
                allow="autoplay; fullscreen"
                data-testid="iframe1"
              />
            </div>
          )}

          {iframe2Visible && iframe2Url && (
            <div
              className="absolute pointer-events-auto"
              style={{
                left: `${iframe2PosX}%`,
                top: `${iframe2PosY}%`,
                transform: `translate(-50%, -50%) scale(${iframe2Scale[0] / 100})`,
                width: `${iframe2Width[0]}px`,
                height: `${iframe2Height[0]}px`,
                borderRadius: iframe2Rounded ? "12px" : 0,
                overflowX: lockIframe2ScrollX ? "hidden" : "auto",
                overflowY: lockIframe2ScrollY ? "hidden" : "auto",
                zIndex: iframe2ZIndex,
              }}
              data-testid="iframe2-container"
            >
              <iframe
                src={iframe2Url}
                className="w-full h-full border-0 shadow-lg"
                title="iFrame Container 2"
                allow="autoplay; fullscreen"
                data-testid="iframe2"
              />
            </div>
          )}
        </div>
      </div>
      </div>

      {qrButtonVisible && (
        <div
          className="fixed z-[14] flex flex-row items-center gap-3"
          style={{
            left: "50%",
            top: `${qrButtonPosY}%`,
            transform: "translate(-50%, -50%)",
          }}
          data-testid="qr-share-grid"
          role="group"
          aria-label="QR Share grid"
        >
          <button
            type="button"
            onClick={() => setContainerVisible((prev) => !prev)}
            className="w-12 h-12 rounded-full border-0 flex items-center justify-center text-white shadow-lg cursor-pointer flex-shrink-0"
            style={{
              background: "#2563eb",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
            }}
            aria-label={containerVisible ? "Hide container" : "Show container"}
            data-testid="button-qr-grid-visibility"
          >
            {containerVisible ? <Eye className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
          </button>
          <button
            type="button"
            onClick={() => setQrModalOpen(true)}
            className="w-14 h-14 rounded-full border-0 flex items-center justify-center text-white shadow-lg cursor-pointer flex-shrink-0"
            style={{
              background: qrButtonColor,
              boxShadow: `0 4px 14px ${qrButtonColor}66`,
            }}
            aria-label="Share page (QR)"
            data-testid="button-qr-share"
          >
            <QrCode className="w-7 h-7" />
          </button>
          <button
            type="button"
            onClick={handlePlayToggle}
            className="w-12 h-12 rounded-full border-0 flex items-center justify-center text-white shadow-lg cursor-pointer flex-shrink-0"
            style={{
              background: isPlaying ? "#dc2626" : "#22c55e",
              boxShadow: isPlaying ? "0 4px 14px rgba(220, 38, 38, 0.4)" : "0 4px 14px rgba(34, 197, 94, 0.4)",
            }}
            aria-label={isPlaying ? "Stop" : "Play"}
            data-testid="button-qr-grid-play"
          >
            {isPlaying ? <Square className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>
        </div>
      )}

      {qrModalOpen && <QRShareModal shareUrl={typeof window !== "undefined" ? window.location.href : ""} onClose={() => setQrModalOpen(false)} />}

      {!containerVisible && (
        <HiddenModeControls
          isPlaying={isPlaying}
          isMuted={isMuted}
          isLooping={isLooping}
          currentTime={currentTime}
          loopStartSeconds={loopStartSeconds}
          loopEndSeconds={loopEndSeconds}
          duration={duration}
          volume={volume}
          onPlayToggle={handlePlayToggle}
          onMuteToggle={() => setIsMuted((m) => !m)}
          onVolumeChange={setVolume}
          onSeek={(time) => {
            if (audioRef.current) {
              audioRef.current.currentTime = time;
              setCurrentTime(time);
            }
          }}
          onSetLoopStart={handleSetLoopStartToCurrent}
          onSetLoopEnd={handleSetLoopEndToCurrent}
          onLoopStartChange={(s) => setLoopStart(formatMs(s))}
          onLoopEndChange={(s) => setLoopEnd(formatMs(s))}
          onClearLoopStart={() => setLoopStart("0")}
          onClearLoopEnd={() => setLoopEnd("")}
          title={title}
        />
      )}

      {visitModalOpen && <VisitSiteModal url={buttonUrl} width={visitModalWidth} onClose={() => setVisitModalOpen(false)} />}
    </div>
  );
}

function HiddenModeControls({
  isPlaying,
  isMuted,
  isLooping,
  currentTime,
  loopStartSeconds,
  loopEndSeconds,
  duration,
  volume,
  onPlayToggle,
  onMuteToggle,
  onVolumeChange,
  onSeek,
  onSetLoopStart,
  onSetLoopEnd,
  onLoopStartChange,
  onLoopEndChange,
  onClearLoopStart,
  onClearLoopEnd,
  title,
}: {
  isPlaying: boolean;
  isMuted: boolean;
  isLooping: boolean;
  currentTime: number;
  loopStartSeconds: number;
  loopEndSeconds: number;
  duration: number;
  volume: number[];
  onPlayToggle: () => void;
  onMuteToggle: () => void;
  onVolumeChange: (v: number[]) => void;
  onSeek: (time: number) => void;
  onSetLoopStart: () => void;
  onSetLoopEnd: () => void;
  onLoopStartChange: (seconds: number) => void;
  onLoopEndChange: (seconds: number) => void;
  onClearLoopStart: () => void;
  onClearLoopEnd: () => void;
  title: string;
}) {
  const scrubBarRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ handle: "start" | "end"; pointerId: number } | null>(null);

  const rangeStart = loopStartSeconds;
  const rangeEnd = loopEndSeconds > loopStartSeconds ? loopEndSeconds : duration;

  const scrubPercent = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;
  const loopStartPercent = duration > 0 ? (loopStartSeconds / duration) * 100 : 0;
  const loopEndPercent = duration > 0 ? ((loopEndSeconds > loopStartSeconds ? loopEndSeconds : duration) / duration) * 100 : 100;

  const handleLoopHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!scrubBarRef.current || !duration || !draggingRef.current) return;
      const rect = scrubBarRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const seconds = (percent / 100) * duration;
      if (draggingRef.current.handle === "start") {
        const endSec = loopEndSeconds > loopStartSeconds ? loopEndSeconds : duration;
        onLoopStartChange(Math.min(seconds, Math.max(0, endSec - 0.01)));
      } else {
        onLoopEndChange(Math.max(seconds, loopStartSeconds + 0.01));
      }
    },
    [duration, loopStartSeconds, loopEndSeconds, onLoopStartChange, onLoopEndChange]
  );

  const handleLoopHandlePointerUp = useCallback((e: React.PointerEvent) => {
    if (draggingRef.current?.pointerId === e.pointerId) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      draggingRef.current = null;
    }
  }, []);

  const handleScrubChange = useCallback((value: number[]) => {
    if (duration > 0) {
      const seekTime = (value[0] / 100) * duration;
      onSeek(seekTime);
    }
  }, [duration, onSeek]);

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
            <span className="text-white/70 text-xs font-medium">{formatTime(duration)}</span>
          </div>
          <div className="relative w-full" ref={scrubBarRef}>
            {isLooping && duration > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 h-2 bg-white/20 rounded-full pointer-events-none z-0"
                style={{ left: `${loopStartPercent}%`, width: `${loopEndPercent - loopStartPercent}%` }}
                data-testid="loop-region-indicator"
              />
            )}
            {isLooping && duration > 0 && (
              <>
                <div
                  role="slider"
                  aria-valuenow={loopStartSeconds}
                  aria-valuemin={0}
                  aria-valuemax={duration}
                  aria-label="Loop start"
                  tabIndex={0}
                  className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-3 h-8 rounded-full bg-green-400 border-2 border-green-200 shadow-md cursor-grab active:cursor-grabbing z-30 touch-none select-none"
                  style={{ left: `${loopStartPercent}%` }}
                  data-testid="loop-start-marker"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    draggingRef.current = { handle: "start", pointerId: e.pointerId };
                  }}
                  onPointerMove={handleLoopHandlePointerMove}
                  onPointerUp={handleLoopHandlePointerUp}
                  onPointerCancel={handleLoopHandlePointerUp}
                />
                <div
                  role="slider"
                  aria-valuenow={loopEndSeconds > loopStartSeconds ? loopEndSeconds : duration}
                  aria-valuemin={loopStartSeconds}
                  aria-valuemax={duration}
                  aria-label="Loop end"
                  tabIndex={0}
                  className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-3 h-8 rounded-full bg-red-400 border-2 border-red-200 shadow-md cursor-grab active:cursor-grabbing z-30 touch-none select-none"
                  style={{ left: `${loopEndPercent}%` }}
                  data-testid="loop-end-marker"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    draggingRef.current = { handle: "end", pointerId: e.pointerId };
                  }}
                  onPointerMove={handleLoopHandlePointerMove}
                  onPointerUp={handleLoopHandlePointerUp}
                  onPointerCancel={handleLoopHandlePointerUp}
                />
              </>
            )}
            <Slider
              value={[scrubPercent]}
              onValueChange={handleScrubChange}
              max={100}
              step={0.1}
              className="w-full relative z-20"
              data-testid="slider-hidden-scrub"
            />
          </div>
          {isLooping && (
            <div className="text-center">
              <span className="text-white/50 text-xs">
                Loop: {formatTime(rangeStart)} - {formatTime(rangeEnd)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSkipBack}
            className="text-white bg-blue-500 border-2 border-blue-400 border-b-blue-700 border-r-blue-700 rounded-lg shadow-[0_4px_0_0_#1d4ed8,0_6px_8px_rgba(0,0,0,0.25)] active:translate-y-[2px] active:shadow-[0_1px_0_0_#1d4ed8,0_2px_4px_rgba(0,0,0,0.2)] transition-all hover:bg-blue-400"
            aria-label="Skip back 5 seconds"
            data-testid="button-hidden-skip-back"
          >
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onPlayToggle}
            className="text-white bg-emerald-500 border-2 border-emerald-400 border-b-emerald-700 border-r-emerald-700 rounded-lg shadow-[0_4px_0_0_#047857,0_6px_8px_rgba(0,0,0,0.25)] active:translate-y-[2px] active:shadow-[0_1px_0_0_#047857,0_2px_4px_rgba(0,0,0,0.2)] transition-all hover:bg-emerald-400"
            aria-label={isPlaying ? "Pause" : "Play"}
            data-testid="button-hidden-play"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSkipForward}
            className="text-white bg-amber-500 border-2 border-amber-400 border-b-amber-700 border-r-amber-700 rounded-lg shadow-[0_4px_0_0_#b45309,0_6px_8px_rgba(0,0,0,0.25)] active:translate-y-[2px] active:shadow-[0_1px_0_0_#b45309,0_2px_4px_rgba(0,0,0,0.2)] transition-all hover:bg-amber-400"
            aria-label="Skip forward 5 seconds"
            data-testid="button-hidden-skip-forward"
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start w-full">
          <div className="flex flex-col items-center gap-2 justify-self-start">
            {isLooping && (
              <>
                <Repeat className="w-3 h-3 text-white/50" />
                <div className="grid grid-cols-[auto_auto_auto_auto] gap-1.5 w-full max-w-[320px]">
                  <Button size="sm" variant="ghost" onClick={onSetLoopStart} className="text-white/70 text-xs rounded-md border border-white/20" style={{ boxShadow: "3px 3px 0 #3b82f6, 1px 1px 0 rgba(59,130,246,0.5)" }} data-testid="button-hidden-set-loop-start">
                    Set Start
                  </Button>
                  <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" onClick={() => onLoopStartChange(Math.max(0, loopStartSeconds - 0.1))} className="text-white/70 w-7 h-7 text-xs rounded-md border border-white/20" data-testid="button-loop-start-minus">
                      <span className="text-sm font-bold">-</span>
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onLoopStartChange(Math.min(duration, loopStartSeconds + 0.1))} className="text-white/70 w-7 h-7 text-xs rounded-md border border-white/20" data-testid="button-loop-start-plus">
                      <span className="text-sm font-bold">+</span>
                    </Button>
                  </div>
                  <Button size="sm" variant="secondary" onClick={onClearLoopStart} className="text-muted-foreground text-xs rounded-md border border-white/20" style={{ boxShadow: "3px 3px 0 #6b7280, 1px 1px 0 rgba(107,114,128,0.5)" }} data-testid="button-hidden-clear-loop-start">
                    Clear
                  </Button>
                  <div className="flex items-center gap-0.5" title="Fine adjust ±0.001 s">
                    <span className="text-white/50 text-[10px] mr-0.5">Fine</span>
                    <Button size="icon" variant="ghost" onClick={() => onLoopStartChange(Math.max(0, loopStartSeconds - 0.001))} className="w-7 h-7 text-xs rounded-md bg-neutral-400 text-neutral-900 border-2 border-neutral-500 border-b-neutral-600 border-r-neutral-600 shadow-[0_2px_0_0_#374151] active:translate-y-[1px] active:shadow-none hover:bg-neutral-300" aria-label="Fine decrease start" data-testid="button-hidden-fine-loop-start-minus"><Minus className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onLoopStartChange(Math.min(duration, loopStartSeconds + 0.001))} className="w-7 h-7 text-xs rounded-md bg-neutral-400 text-neutral-900 border-2 border-neutral-500 border-b-neutral-600 border-r-neutral-600 shadow-[0_2px_0_0_#374151] active:translate-y-[1px] active:shadow-none hover:bg-neutral-300" aria-label="Fine increase start" data-testid="button-hidden-fine-loop-start-plus"><Plus className="w-3 h-3" /></Button>
                  </div>
                  <Button size="sm" variant="ghost" onClick={onSetLoopEnd} className="text-white/70 text-xs rounded-md border border-white/20" style={{ boxShadow: "3px 3px 0 #10b981, 1px 1px 0 rgba(16,185,129,0.5)" }} data-testid="button-hidden-set-loop-end">
                    Set End
                  </Button>
                  <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" onClick={() => onLoopEndChange(Math.max(0, (loopEndSeconds > loopStartSeconds ? loopEndSeconds : duration) - 0.1))} className="text-white/70 w-7 h-7 text-xs rounded-md border border-white/20" data-testid="button-loop-end-minus">
                      <span className="text-sm font-bold">-</span>
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onLoopEndChange(Math.min(duration, (loopEndSeconds > loopStartSeconds ? loopEndSeconds : duration) + 0.1))} className="text-white/70 w-7 h-7 text-xs rounded-md border border-white/20" data-testid="button-loop-end-plus">
                      <span className="text-sm font-bold">+</span>
                    </Button>
                  </div>
                  <Button size="sm" variant="secondary" onClick={onClearLoopEnd} className="text-muted-foreground text-xs rounded-md border border-white/20" style={{ boxShadow: "3px 3px 0 #f59e0b, 1px 1px 0 rgba(245,158,11,0.5)" }} data-testid="button-hidden-clear-loop-end">
                    Clear
                  </Button>
                  <div className="flex items-center gap-0.5" title="Fine adjust ±0.001 s">
                    <span className="text-white/50 text-[10px] mr-0.5">Fine</span>
                    <Button size="icon" variant="ghost" onClick={() => onLoopEndChange(Math.max(0, (loopEndSeconds > loopStartSeconds ? loopEndSeconds : duration) - 0.001))} className="w-7 h-7 text-xs rounded-md bg-neutral-400 text-neutral-900 border-2 border-neutral-500 border-b-neutral-600 border-r-neutral-600 shadow-[0_2px_0_0_#374151] active:translate-y-[1px] active:shadow-none hover:bg-neutral-300" aria-label="Fine decrease end" data-testid="button-hidden-fine-loop-end-minus"><Minus className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onLoopEndChange(Math.min(duration, (loopEndSeconds > loopStartSeconds ? loopEndSeconds : duration) + 0.001))} className="w-7 h-7 text-xs rounded-md bg-neutral-400 text-neutral-900 border-2 border-neutral-500 border-b-neutral-600 border-r-neutral-600 shadow-[0_2px_0_0_#374151] active:translate-y-[1px] active:shadow-none hover:bg-neutral-300" aria-label="Fine increase end" data-testid="button-hidden-fine-loop-end-plus"><Plus className="w-3 h-3" /></Button>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="hidden md:flex flex-col items-center gap-2 justify-self-end" data-testid="volume-control-vertical">
            <div className="flex items-center justify-between w-full max-w-[48px]">
              <span className="text-white/60 text-xs">{volume[0]}%</span>
            </div>
            <div className="h-28 flex flex-col items-center">
              <Slider
                orientation="vertical"
                variant="volume"
                value={volume}
                onValueChange={onVolumeChange}
                max={100}
                step={1}
                className="h-full"
                data-testid="slider-hidden-volume"
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={onMuteToggle}
              className="text-white bg-white/20 hover:bg-white/30 rounded-full w-9 h-9 border border-white/30"
              aria-label={isMuted ? "Unmute" : "Mute"}
              title={isMuted ? "Unmute (sound only, does not change play/stop)" : "Mute (sound only, does not change play/stop)"}
              data-testid="button-hidden-mute"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex md:hidden flex-row items-center gap-3 w-full pt-2 border-t border-white/20" data-testid="volume-control-horizontal">
          <span className="text-white/60 text-xs w-10 shrink-0">{volume[0]}%</span>
          <Slider
            orientation="horizontal"
            variant="volume"
            value={volume}
            onValueChange={onVolumeChange}
            max={100}
            step={1}
            className="flex-1"
            data-testid="slider-hidden-volume-mobile"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={onMuteToggle}
            className="text-white bg-white/20 hover:bg-white/30 rounded-full w-9 h-9 shrink-0 border border-white/30"
            aria-label={isMuted ? "Unmute" : "Mute"}
            title={isMuted ? "Unmute (sound only, does not change play/stop)" : "Mute (sound only, does not change play/stop)"}
            data-testid="button-hidden-mute-mobile"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </div>

      </div>
    </div>
  );
}

const LAUNCH_MODAL_SLIDE_MS = 500;
const VISIT_MODAL_CLOSE_THRESHOLD = 70; // sheet top % - when released past this, close and release

function QRShareModal({ shareUrl, onClose }: { shareUrl: string; onClose: () => void }) {
  const [sheetY, setSheetY] = useState(10);
  const [isDragging, setIsDragging] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const startY = useRef(0);
  const startSheetY = useRef(0);
  const sheetYRef = useRef(sheetY);
  useEffect(() => { sheetYRef.current = sheetY; }, [sheetY]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setHasEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
  }, [isClosing]);

  useEffect(() => {
    if (!isClosing) return;
    const t = setTimeout(() => { onCloseRef.current(); }, LAUNCH_MODAL_SLIDE_MS);
    return () => clearTimeout(t);
  }, [isClosing]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startSheetY.current = sheetY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [sheetY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaPercent = ((e.clientY - startY.current) / window.innerHeight) * 100;
    const newY = Math.max(0, Math.min(85, startSheetY.current + deltaPercent));
    setSheetY(newY);
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    if (sheetYRef.current >= VISIT_MODAL_CLOSE_THRESHOLD) setIsClosing(true);
  }, []);

  const transition = isDragging ? "none" : "transform 0.5s ease-out, top 0.3s ease";
  const slideDown = !hasEntered || isClosing;

  const handleCopyLink = useCallback(() => {
    if (shareUrl) navigator.clipboard.writeText(shareUrl).catch(() => {});
  }, [shareUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={handleClose} data-testid="qr-modal-overlay" aria-label="QR Share modal">
      <div
        className="absolute left-1/2 bottom-0 bg-background rounded-t-xl flex flex-col max-h-[85vh]"
        style={{
          left: "50%",
          width: "min(400px, 95vw)",
          top: `${sheetY}%`,
          transition,
          transform: slideDown ? "translate(-50%, 100%)" : "translate(-50%, 0)",
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="qr-modal"
      >
        <div
          className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing select-none flex-shrink-0 border-b"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          data-testid="qr-modal-handle"
        >
          <div className="w-8 h-8" />
          <div className="flex-1 flex justify-center">
            <GripHorizontal className="w-8 h-5 text-muted-foreground" />
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0 hover:bg-red-600"
            aria-label="Close"
            data-testid="button-qr-modal-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <h2 className="text-lg font-bold text-center mb-4">Share This Page</h2>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-3 rounded-lg inline-block">
              <QRCodeSVG value={shareUrl} size={200} level="M" />
            </div>
            <div className="w-full">
              <div className="bg-muted rounded-md px-3 py-2 text-sm text-muted-foreground break-all" data-testid="qr-modal-link">
                {shareUrl}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-3 rounded-lg text-white font-semibold transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)" }}
              data-testid="button-qr-copy-link"
            >
              Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VisitSiteModal({ url, width = 100, onClose }: { url: string; width?: number; onClose: () => void }) {
  const [sheetY, setSheetY] = useState(10);
  const [isDragging, setIsDragging] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const startY = useRef(0);
  const startSheetY = useRef(0);
  const sheetYRef = useRef(sheetY);
  useEffect(() => { sheetYRef.current = sheetY; }, [sheetY]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setHasEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
  }, [isClosing]);

  useEffect(() => {
    if (!isClosing) return;
    const t = setTimeout(() => { onCloseRef.current(); }, LAUNCH_MODAL_SLIDE_MS);
    return () => clearTimeout(t);
  }, [isClosing]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startSheetY.current = sheetY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [sheetY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaPercent = ((e.clientY - startY.current) / window.innerHeight) * 100;
    const newY = Math.max(0, Math.min(85, startSheetY.current + deltaPercent));
    setSheetY(newY);
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    if (sheetYRef.current >= VISIT_MODAL_CLOSE_THRESHOLD) setIsClosing(true);
  }, []);

  const transition = isDragging ? "none" : "transform 0.5s ease-out, top 0.3s ease";
  const slideDown = !hasEntered || isClosing;

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={handleClose} data-testid="visit-modal-overlay" aria-label="Launch modal">
      <div
        className="absolute left-1/2 bottom-0 bg-background rounded-t-xl flex flex-col"
        style={{
          width: `${width}%`,
          top: `${sheetY}%`,
          marginLeft: `${-width / 2}%`,
          transition,
          transform: slideDown ? "translateY(100%)" : "translateY(0)",
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="visit-modal"
        data-modal="launch-modal"
      >
        <div
          className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          data-testid="visit-modal-handle"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0"
              aria-label="Close"
              data-testid="button-visit-modal-close"
            >
              <X className="w-4 h-4" />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-400 text-black hover:bg-yellow-500 shrink-0"
              aria-label="Open in new window"
              data-testid="link-visit-modal-new-window"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="flex-1 flex justify-center">
            <GripHorizontal className="w-8 h-5 text-muted-foreground" />
          </div>
          <div className="w-8" />
        </div>
        <iframe
          src={url}
          className="flex-1 w-full border-0"
          title="Visit Site"
          allow="autoplay; fullscreen"
          data-testid="visit-modal-iframe"
        />
      </div>
    </div>
  );
}

function StemModal({ audioUrl, stemIframeRef, onLoad, onClose }: { audioUrl: string; stemIframeRef: React.MutableRefObject<HTMLIFrameElement | null>; onLoad: () => void; onClose: () => void }) {
  const [sheetY, setSheetY] = useState(5);
  const [isDragging, setIsDragging] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const startY = useRef(0);
  const startSheetY = useRef(0);
  const sheetYRef = useRef(sheetY);
  useEffect(() => { sheetYRef.current = sheetY; }, [sheetY]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setHasEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
  }, [isClosing]);

  useEffect(() => {
    if (!isClosing) return;
    const t = setTimeout(() => { onCloseRef.current(); }, LAUNCH_MODAL_SLIDE_MS);
    return () => clearTimeout(t);
  }, [isClosing]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startSheetY.current = sheetY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [sheetY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaPercent = ((e.clientY - startY.current) / window.innerHeight) * 100;
    const newY = Math.max(0, Math.min(85, startSheetY.current + deltaPercent));
    setSheetY(newY);
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    if (sheetYRef.current >= VISIT_MODAL_CLOSE_THRESHOLD) setIsClosing(true);
  }, []);

  const transition = isDragging ? "none" : "transform 0.5s ease-out, top 0.3s ease";
  const slideDown = !hasEntered || isClosing;

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={handleClose} data-testid="stem-modal-overlay">
      <div
        className="absolute left-1/2 bottom-0 bg-[#0a0a0f] rounded-t-xl flex flex-col"
        style={{
          width: "100%",
          top: `${sheetY}%`,
          marginLeft: "-50%",
          transition,
          transform: slideDown ? "translateY(100%)" : "translateY(0)",
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="stem-modal"
      >
        <div
          className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          data-testid="stem-modal-handle"
        >
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0"
            aria-label="Close Stem modal"
            data-testid="button-stem-close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex-1 flex justify-center">
            <GripHorizontal className="w-8 h-5 text-muted-foreground" />
          </div>
          <div className="w-8" />
        </div>
        <iframe
          ref={stemIframeRef}
          src="/stem.html"
          className="flex-1 w-full border-0"
          title="StemSplit - AI Audio Separation"
          allow="autoplay; microphone"
          onLoad={onLoad}
          data-testid="stem-modal-iframe"
        />
      </div>
    </div>
  );
}
