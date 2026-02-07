import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPlaylistItemSchema } from "@shared/schema";

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channel: string;
  duration: string;
  views: string;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/playlist", async (_req, res) => {
    try {
      const items = await storage.getPlaylistItems();
      res.json(items);
    } catch (err) {
      console.error("Failed to get playlist:", err);
      res.status(500).json({ error: "Failed to get playlist" });
    }
  });

  app.post("/api/playlist", async (req, res) => {
    try {
      const parsed = insertPlaylistItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const existing = await storage.getPlaylistItemByVideoId(parsed.data.videoId);
      if (existing) {
        return res.status(409).json({ error: "Already in playlist", item: existing });
      }
      const item = await storage.addPlaylistItem(parsed.data);
      res.status(201).json(item);
    } catch (err) {
      console.error("Failed to add to playlist:", err);
      res.status(500).json({ error: "Failed to add to playlist" });
    }
  });

  app.delete("/api/playlist/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
      await storage.removePlaylistItem(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to remove from playlist:", err);
      res.status(500).json({ error: "Failed to remove from playlist" });
    }
  });

  app.get("/api/youtube-search", async (req, res) => {
    const query = req.query.q as string;
    if (!query || !query.trim()) {
      return res.json({ results: [] });
    }

    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        return res.status(502).json({ error: "Failed to fetch search results" });
      }

      const html = await response.text();
      const results = parseYouTubeSearchResults(html);
      res.json({ results });
    } catch (err) {
      console.error("YouTube search error:", err);
      res.status(500).json({ error: "Search failed" });
    }
  });

  return httpServer;
}

function parseYouTubeSearchResults(html: string): YouTubeSearchResult[] {
  const results: YouTubeSearchResult[] = [];

  const startMarker = "var ytInitialData = ";
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return results;

  const jsonStart = startIdx + startMarker.length;
  const endMarker = ";</script>";
  const endIdx = html.indexOf(endMarker, jsonStart);
  if (endIdx === -1) return results;

  const jsonStr = html.substring(jsonStart, endIdx);

  try {
    const data = JSON.parse(jsonStr);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents;

    if (!Array.isArray(contents)) return results;

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents;
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const video = item?.videoRenderer;
        if (!video || !video.videoId) continue;

        const title =
          video.title?.runs?.map((r: { text: string }) => r.text).join("") ||
          video.title?.simpleText ||
          "";
        const channel =
          video.ownerText?.runs?.map((r: { text: string }) => r.text).join("") ||
          "";
        const thumbnail =
          video.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || "";
        const duration =
          video.lengthText?.simpleText || "";
        const views =
          video.viewCountText?.simpleText ||
          video.viewCountText?.runs?.map((r: { text: string }) => r.text).join("") ||
          "";

        results.push({ videoId: video.videoId, title, thumbnail, channel, duration, views });

        if (results.length >= 20) break;
      }
      if (results.length >= 20) break;
    }
  } catch (e) {
    console.error("Failed to parse YouTube data:", e);
  }

  return results;
}
