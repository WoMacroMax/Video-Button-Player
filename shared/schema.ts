import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const playlistItems = pgTable("playlist_items", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull(),
  title: text("title").notNull(),
  thumbnail: text("thumbnail").notNull().default(""),
  channel: text("channel").notNull().default(""),
  duration: text("duration").notNull().default(""),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertPlaylistItemSchema = createInsertSchema(playlistItems).omit({
  id: true,
  addedAt: true,
});

export type InsertPlaylistItem = z.infer<typeof insertPlaylistItemSchema>;
export type PlaylistItem = typeof playlistItems.$inferSelect;

export const routeSettings = pgTable("route_settings", {
  id: serial("id").primaryKey(),
  route: text("route").notNull(),
  width: integer("width").notNull(),
  settings: jsonb("settings").notNull(),
  globalUrls: jsonb("global_urls").notNull().default({}),
});

export const insertRouteSettingsSchema = createInsertSchema(routeSettings).omit({
  id: true,
});

export type InsertRouteSettings = z.infer<typeof insertRouteSettingsSchema>;
export type RouteSettings = typeof routeSettings.$inferSelect;
