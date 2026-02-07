import { useState, useCallback } from "react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [iframeQuery, setIframeQuery] = useState("");

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    setIframeQuery(trimmed);
  }, [query]);

  const iframeSrc =
    iframeQuery === ""
      ? "https://m.youtube.com"
      : `https://m.youtube.com/results?search_query=${encodeURIComponent(iframeQuery)}`;

  return (
    <div className="flex flex-col w-full h-screen bg-background" data-testid="search-page">
      <div className="flex shrink-0 gap-2 p-3 bg-muted/50 border-b">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search YouTube..."
          className="flex-1 max-w-md px-3 py-2 rounded-md border bg-background text-sm"
          aria-label="Search YouTube"
          data-testid="search-input"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          data-testid="search-button"
        >
          Search
        </button>
      </div>
      <iframe
        src={iframeSrc}
        className="flex-1 w-full min-h-0 border-0"
        title="YouTube Search (m.youtube)"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        data-testid="search-iframe"
      />
    </div>
  );
}
