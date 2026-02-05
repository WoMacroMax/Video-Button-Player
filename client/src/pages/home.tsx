import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowRight, Menu, Volume2, VolumeX, Play, Pause, Repeat } from "lucide-react";
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
  getPlayerState: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
}

const VIDEO_ID = "M7lc1UVf-VE";

export default function Home() {
  const [isHovered, setIsHovered] = useState(false);
  const [title, setTitle] = useState("Click the Video Button");
  const [buttonLabel, setButtonLabel] = useState("Visit Site");
  const [volume, setVolume] = useState([50]);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const isLoopingRef = useRef(isLooping);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerInitializedRef = useRef(false);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    if (playerInitializedRef.current) return;

    const initPlayer = () => {
      if (playerRef.current || playerInitializedRef.current) return;
      playerInitializedRef.current = true;
      
      playerRef.current = new window.YT.Player("youtube-player", {
        videoId: VIDEO_ID,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          showinfo: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          loop: 0,
        },
        events: {
          onReady: (event) => {
            setPlayerReady(true);
            event.target.setVolume(50);
            event.target.mute();
          },
          onStateChange: (event) => {
            if (event.data === 0) {
              if (isLoopingRef.current) {
                event.target.seekTo(0, true);
                event.target.playVideo();
              }
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
    if (playerReady && playerRef.current) {
      playerRef.current.setVolume(volume[0]);
    }
  }, [volume, playerReady]);

  useEffect(() => {
    if (playerReady && playerRef.current) {
      if (isMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
      }
    }
  }, [isMuted, playerReady]);

  useEffect(() => {
    if (playerReady && playerRef.current) {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying, playerReady]);

  const handleClick = useCallback(() => {
    window.open("https://womacromax.com", "_blank");
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.open("https://womacromax.com", "_blank");
    }
  }, []);

  const handleMuteToggle = useCallback((checked: boolean) => {
    setIsMuted(checked);
  }, []);

  const handlePlayToggle = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleLoopToggle = useCallback((checked: boolean) => {
    setIsLooping(checked);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-[#667eea] to-[#764ba2] relative">
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
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>
              Customize video playback and button appearance
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex flex-col gap-6 mt-6">
            <div className="space-y-3">
              <Label htmlFor="title-input" className="text-sm font-medium">
                Title
              </Label>
              <Input
                id="title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title"
                data-testid="input-title"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="button-label-input" className="text-sm font-medium">
                Button Label
              </Label>
              <Input
                id="button-label-input"
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                placeholder="Enter button label"
                data-testid="input-button-label"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Volume
                </Label>
                <span className="text-sm text-muted-foreground">{volume[0]}%</span>
              </div>
              <Slider
                value={volume}
                onValueChange={setVolume}
                max={100}
                step={1}
                className="w-full"
                data-testid="slider-volume"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="mute-toggle" className="text-sm font-medium flex items-center gap-2">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                Muted
              </Label>
              <Switch
                id="mute-toggle"
                checked={isMuted}
                onCheckedChange={handleMuteToggle}
                data-testid="switch-mute"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                Transport
              </Label>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePlayToggle}
                data-testid="button-transport"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Play
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="loop-toggle" className="text-sm font-medium flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Loop
              </Label>
              <Switch
                id="loop-toggle"
                checked={isLooping}
                onCheckedChange={handleLoopToggle}
                data-testid="switch-loop"
              />
            </div>
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
          className="relative w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] md:w-[280px] md:h-[280px] mx-auto cursor-pointer bg-transparent border-none p-0 block"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label="Visit womacromax.com website"
          data-testid="button-video"
        >
          <div 
            ref={containerRef}
            className="relative w-full h-full rounded-full overflow-hidden transition-shadow duration-300"
            style={{
              boxShadow: isHovered 
                ? "0 15px 50px rgba(0, 0, 0, 0.4)" 
                : "0 10px 40px rgba(0, 0, 0, 0.3)",
              border: "4px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            <div 
              className="absolute top-1/2 left-1/2 w-[150%] h-[150%]"
              style={{
                transform: "translate(-50%, -50%)",
              }}
            >
              <div id="youtube-player" className="w-full h-full" />
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
                style={{
                  opacity: isHovered ? 1 : 0,
                  visibility: isHovered ? "visible" : "hidden",
                }}
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
