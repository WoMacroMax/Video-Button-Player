import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Search, X, Link, Clock, Repeat, Loader2, ListPlus, Trash2, ListMusic, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PlaylistItem } from "@shared/schema";

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          playerVars: Record<string, number | string>;
          events: {
            onReady: (event: { target: SearchYTPlayer }) => void;
            onStateChange?: (event: { data: number; target: SearchYTPlayer }) => void;
          };
        }
      ) => SearchYTPlayer;
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

interface SearchYTPlayer {
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

interface SearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channel: string;
  duration: string;
  views: string;
}

const DEFAULT_VIDEO_ID = "Gai7-HR2YZk";
const SEARCH_URLS_KEY = "search-youtube-urls";
const VIEW_URLS_KEY = "view-youtube-urls";
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
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const vParam = u.searchParams.get("v");
      if (vParam) return `youtube.com/watch?v=${vParam}`;
      return u.hostname + u.pathname;
    }
    return u.hostname + u.pathname.slice(0, 30);
  } catch {
    return url.length > 50 ? url.slice(0, 47) + "..." : url;
  }
}

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

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [videoUrl, setVideoUrl] = useState(() => {
    const history = loadUrlHistory(SEARCH_URLS_KEY);
    return history.length > 0 ? history[0] : `https://www.youtube.com/watch?v=${DEFAULT_VIDEO_ID}`;
  });
  const [videoId, setVideoId] = useState(() => {
    const history = loadUrlHistory(SEARCH_URLS_KEY);
    if (history.length > 0) {
      const id = extractVideoId(history[0]);
      return id || DEFAULT_VIDEO_ID;
    }
    return DEFAULT_VIDEO_ID;
  });
  const [nowPlayingTitle, setNowPlayingTitle] = useState("");
  const [urlHistory, setUrlHistory] = useState<string[]>(() => loadUrlHistory(SEARCH_URLS_KEY));

  const [volume, setVolume] = useState([50]);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState([0]);
  const [playerReady, setPlayerReady] = useState(false);

  const playerRef = useRef<SearchYTPlayer | null>(null);
  const playerInitializedRef = useRef(false);
  const currentVideoIdRef = useRef(videoId);
  const progressIntervalRef = useRef<number | null>(null);
  const isSeeking = useRef(false);
  const volumeRef = useRef(50);
  const isLoopingRef = useRef(isLooping);

  const { toast } = useToast();

  const { data: playlist = [], isLoading: playlistLoading } = useQuery<PlaylistItem[]>({
    queryKey: ["/api/playlist"],
  });

  const addToPlaylist = useMutation({
    mutationFn: async (result: SearchResult) => {
      const resp = await apiRequest("POST", "/api/playlist", {
        videoId: result.videoId,
        title: result.title,
        thumbnail: result.thumbnail,
        channel: result.channel,
        duration: result.duration,
      });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlist"] });
      toast({ title: "Saved to playlist" });
    },
    onError: (err: Error) => {
      if (err.message.includes("409")) {
        toast({ title: "Already in playlist", variant: "destructive" });
      } else {
        toast({ title: "Failed to save", variant: "destructive" });
      }
    },
  });

  const removeFromPlaylist = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/playlist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlist"] });
      toast({ title: "Removed from playlist" });
    },
    onError: () => {
      toast({ title: "Failed to remove", variant: "destructive" });
    },
  });

  const handleSaveToPlaylist = useCallback(() => {
    const currentResult = searchResults.find((r) => r.videoId === videoId);
    if (currentResult) {
      addToPlaylist.mutate(currentResult);
    } else if (videoId) {
      addToPlaylist.mutate({
        videoId,
        title: nowPlayingTitle || `Video ${videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        channel: "",
        duration: "",
        views: "",
      });
    }
  }, [searchResults, videoId, nowPlayingTitle, addToPlaylist]);

  const handlePlayFromPlaylist = useCallback((item: PlaylistItem) => {
    const url = `https://www.youtube.com/watch?v=${item.videoId}`;
    setVideoUrl(url);
    setVideoId(item.videoId);
    setNowPlayingTitle(item.title);
    setUrlHistory(saveUrlToHistory(SEARCH_URLS_KEY, url));
  }, []);

  const [, navigate] = useLocation();
  const handleExportToView = useCallback(() => {
    if (!videoUrl.trim()) return;
    saveUrlToHistory(VIEW_URLS_KEY, videoUrl);
    navigate("/view");
  }, [videoUrl, navigate]);

  useEffect(() => {
    if (videoUrl.trim() && urlHistory.length === 0) {
      setUrlHistory(saveUrlToHistory(SEARCH_URLS_KEY, videoUrl));
    }
  }, []);

  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { currentVideoIdRef.current = videoId; }, [videoId]);
  useEffect(() => { volumeRef.current = volume[0]; }, [volume]);

  useEffect(() => {
    if (playerInitializedRef.current) return;
    const initPlayer = () => {
      if (playerRef.current || playerInitializedRef.current) return;
      playerInitializedRef.current = true;
      playerRef.current = new window.YT.Player("search-youtube-player", {
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
              event.target.seekTo(0, true);
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
      if (isSeeking.current) return;
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.getPlayerState !== "function") return;
          const state = playerRef.current.getPlayerState();
          if (state !== 1 && state !== 3) return;
          const time = typeof playerRef.current.getCurrentTime === "function" ? playerRef.current.getCurrentTime() : 0;
          const dur = typeof playerRef.current.getDuration === "function" ? playerRef.current.getDuration() : 0;
          if (dur > 0) {
            setCurrentTime(time);
            setDuration(dur);
            setProgress([(time / dur) * 100]);
          }
        } catch { }
      }
    };
    progressIntervalRef.current = window.setInterval(updateProgress, 200);
    return () => { if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current); };
  }, [playerReady]);

  useEffect(() => {
    if (playerReady && playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      setCurrentTime(0);
      setProgress([0]);
      setDuration(0);
      playerRef.current.loadVideoById(videoId);
      if (typeof playerRef.current.setVolume === "function") playerRef.current.setVolume(volumeRef.current);
      if (isMuted && typeof playerRef.current.mute === "function") playerRef.current.mute();
    }
  }, [videoId, playerReady, isMuted]);

  useEffect(() => {
    if (playerReady && playerRef.current) {
      if (typeof playerRef.current.setVolume === "function") playerRef.current.setVolume(volume[0]);
    }
  }, [volume, playerReady]);

  useEffect(() => {
    if (playerReady && playerRef.current) {
      if (isMuted) { if (typeof playerRef.current.mute === "function") playerRef.current.mute(); }
      else { if (typeof playerRef.current.unMute === "function") playerRef.current.unMute(); if (typeof playerRef.current.setVolume === "function") playerRef.current.setVolume(volumeRef.current); }
    }
  }, [isMuted, playerReady]);

  useEffect(() => {
    if (playerReady && playerRef.current) {
      if (isPlaying) { if (typeof playerRef.current.playVideo === "function") playerRef.current.playVideo(); }
      else { if (typeof playerRef.current.pauseVideo === "function") playerRef.current.pauseVideo(); }
    }
  }, [isPlaying, playerReady]);

  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setIsSearching(true);
    setSearchError("");
    setHasSearched(true);
    try {
      const resp = await fetch(`/api/youtube-search?q=${encodeURIComponent(trimmed)}`);
      if (!resp.ok) throw new Error("Search failed");
      const data = await resp.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchError("Search failed. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleSelectResult = useCallback((result: SearchResult) => {
    const url = `https://www.youtube.com/watch?v=${result.videoId}`;
    setVideoUrl(url);
    setVideoId(result.videoId);
    setNowPlayingTitle(result.title);
    setUrlHistory(saveUrlToHistory(SEARCH_URLS_KEY, url));
  }, []);

  const handleVideoUrlChange = useCallback((value: string) => {
    setVideoUrl(value);
    const extractedId = extractVideoId(value);
    if (extractedId) {
      setVideoId(extractedId);
      setNowPlayingTitle("");
    }
  }, []);

  const handleVideoUrlCommit = useCallback(() => {
    if (videoUrl.trim()) setUrlHistory(saveUrlToHistory(SEARCH_URLS_KEY, videoUrl));
  }, [videoUrl]);

  const handleHistorySelect = useCallback((url: string) => {
    setVideoUrl(url);
    const extractedId = extractVideoId(url);
    if (extractedId) {
      setVideoId(extractedId);
      setNowPlayingTitle("");
    }
    setUrlHistory(saveUrlToHistory(SEARCH_URLS_KEY, url));
  }, []);

  const handleRemoveUrl = useCallback((url: string) => {
    setUrlHistory(removeUrlFromHistory(SEARCH_URLS_KEY, url));
  }, []);

  const handlePlayToggle = useCallback(() => { setIsPlaying((prev) => !prev); }, []);
  const handleMuteToggle = useCallback(() => { setIsMuted((m) => !m); }, []);
  const handleLoopToggle = useCallback(() => { setIsLooping((l) => !l); }, []);

  const handleProgressChange = useCallback((value: number[]) => { isSeeking.current = true; setProgress(value); }, []);
  const handleProgressCommit = useCallback((value: number[]) => {
    if (duration > 0 && playerRef.current) {
      const seekTime = (value[0] / 100) * duration;
      if (typeof playerRef.current.seekTo === "function") playerRef.current.seekTo(seekTime, true);
      setCurrentTime(seekTime);
    }
    isSeeking.current = false;
  }, [duration]);

  const handleSeek = useCallback((seconds: number) => {
    if (duration > 0 && playerRef.current && typeof playerRef.current.seekTo === "function") {
      const newTime = Math.max(0, Math.min(duration, seconds));
      playerRef.current.seekTo(newTime, true);
      setCurrentTime(newTime);
    }
  }, [duration]);

  return (
    <div className="flex flex-col w-full h-screen bg-background" data-testid="search-page">
      <div className="flex shrink-0 gap-2 p-3 bg-muted/50 border-b flex-wrap">
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search YouTube..."
          className="flex-1 min-w-[150px] max-w-md"
          aria-label="Search YouTube"
          data-testid="search-input"
        />
        <Button
          size="sm"
          variant="default"
          onClick={handleSearch}
          disabled={isSearching}
          data-testid="search-button"
        >
          {isSearching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
          Search
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSaveToPlaylist}
          disabled={!videoId || addToPlaylist.isPending}
          data-testid="save-to-playlist-button"
        >
          {addToPlaylist.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ListPlus className="w-4 h-4 mr-1" />}
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportToView}
          disabled={!videoUrl.trim()}
          data-testid="export-to-view-button"
        >
          <ExternalLink className="w-4 h-4 mr-1" />
          Export
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        <div className="flex-1 min-h-0 lg:w-1/2 overflow-y-auto p-3 space-y-2">
          {isSearching && (
            <div className="flex items-center justify-center py-12" data-testid="search-loading">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {searchError && (
            <p className="text-sm text-destructive text-center py-8" data-testid="search-error">{searchError}</p>
          )}

          {!isSearching && !searchError && searchResults.length === 0 && hasSearched && (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="search-no-results">No results found.</p>
          )}

          {!isSearching && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Search className="w-10 h-10 opacity-30" />
              <p className="text-sm">Search for YouTube videos above</p>
            </div>
          )}

          {searchResults.map((result) => (
            <div
              key={result.videoId}
              className={`flex gap-3 p-2 rounded-md cursor-pointer hover-elevate ${result.videoId === videoId ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}
              onClick={() => handleSelectResult(result)}
              data-testid={`search-result-${result.videoId}`}
            >
              <div className="relative shrink-0 w-40 aspect-video rounded-md overflow-hidden bg-muted">
                {result.thumbnail && (
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                {result.duration && (
                  <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">
                    {result.duration}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium leading-tight line-clamp-2" data-testid="search-result-title">{result.title}</p>
                <p className="text-xs text-muted-foreground">{result.channel}</p>
                {result.views && <p className="text-xs text-muted-foreground">{result.views}</p>}
              </div>
            </div>
          ))}

          {playlist.length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-2" data-testid="playlist-section">
              <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                <ListMusic className="w-3 h-3" />
                Playlist ({playlist.length})
              </Label>
              {playlist.map((item) => (
                <div
                  key={item.id}
                  className={`flex gap-3 p-2 rounded-md cursor-pointer hover-elevate group ${item.videoId === videoId ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}
                  onClick={() => handlePlayFromPlaylist(item)}
                  data-testid={`playlist-item-${item.id}`}
                >
                  <div className="relative shrink-0 w-24 aspect-video rounded-md overflow-hidden bg-muted">
                    {item.thumbnail && (
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    {item.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">
                        {item.duration}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium leading-tight line-clamp-2" data-testid={`playlist-item-title-${item.id}`}>{item.title}</p>
                    {item.channel && <p className="text-xs text-muted-foreground">{item.channel}</p>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 invisible group-hover:visible self-center"
                    onClick={(e) => { e.stopPropagation(); removeFromPlaylist.mutate(item.id); }}
                    aria-label="Remove from playlist"
                    data-testid={`playlist-remove-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {playlistLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex flex-col lg:w-1/2 lg:min-h-0 border-t lg:border-t-0 lg:border-l">
          <div className="p-3 border-b space-y-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Link className="w-3 h-3" />
                YouTube URL / Video ID
              </Label>
              <Input
                value={videoUrl}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
                onBlur={handleVideoUrlCommit}
                onKeyDown={(e) => { if (e.key === "Enter") handleVideoUrlCommit(); }}
                placeholder="YouTube URL or Video ID"
                className="text-sm"
                data-testid="search-video-url-input"
              />
            </div>
            {nowPlayingTitle && (
              <p className="text-xs text-muted-foreground truncate" title={nowPlayingTitle} data-testid="search-now-playing">
                Now playing: {nowPlayingTitle}
              </p>
            )}
            {urlHistory.length > 0 && (
              <div className="space-y-1" data-testid="search-url-history">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Recent
                </Label>
                <div className="max-h-24 overflow-y-auto rounded-md border bg-background">
                  {urlHistory.map((url) => (
                    <div
                      key={url}
                      className="flex items-center gap-1 px-2 py-1 text-xs hover-elevate cursor-pointer group"
                      onClick={() => handleHistorySelect(url)}
                      data-testid="search-history-item"
                    >
                      <span className="flex-1 text-left truncate" title={url}>
                        {getLabelForUrl(url)}
                      </span>
                      <span
                        className="shrink-0 invisible group-hover:visible rounded-sm p-0.5"
                        onClick={(e) => { e.stopPropagation(); handleRemoveUrl(url); }}
                        data-testid="search-history-remove"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex-1 min-h-[200px] lg:min-h-0 bg-black flex items-center justify-center">
            <div id="search-youtube-player" className="w-full h-full" data-testid="search-youtube-player" />
          </div>

          <div className="p-3 border-t space-y-2 bg-muted/30">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground" data-testid="search-time-display">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className={`toggle-elevate ${isLooping ? "toggle-elevated" : ""}`}
                  onClick={handleLoopToggle}
                  aria-label={isLooping ? "Disable loop" : "Enable loop"}
                  data-testid="search-button-loop"
                >
                  <Repeat className="w-4 h-4" />
                </Button>
              </div>
              <Slider
                value={progress}
                onValueChange={handleProgressChange}
                onValueCommit={handleProgressCommit}
                max={100}
                step={0.1}
                className="w-full"
                data-testid="search-slider-progress"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleSeek(currentTime - 10)}
                  aria-label="Skip back 10s"
                  data-testid="search-button-skip-back"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handlePlayToggle}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  data-testid="search-button-play"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleSeek(currentTime + 10)}
                  aria-label="Skip forward 10s"
                  data-testid="search-button-skip-forward"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleMuteToggle}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  data-testid="search-button-mute"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Slider
                  value={volume}
                  onValueChange={setVolume}
                  max={100}
                  step={1}
                  className="flex-1"
                  data-testid="search-slider-volume"
                />
                <span className="text-xs text-muted-foreground w-8 text-right">{volume[0]}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
