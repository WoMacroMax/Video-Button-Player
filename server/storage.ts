import { type User, type InsertUser, type PlaylistItem, type InsertPlaylistItem, type RouteSettings, type InsertRouteSettings, users, playlistItems, routeSettings } from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, and, asc, sql } from "drizzle-orm";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getPlaylistItems(): Promise<PlaylistItem[]>;
  addPlaylistItem(item: InsertPlaylistItem): Promise<PlaylistItem>;
  removePlaylistItem(id: number): Promise<void>;
  getPlaylistItemByVideoId(videoId: string): Promise<PlaylistItem | undefined>;
  saveRouteSettings(data: InsertRouteSettings): Promise<RouteSettings>;
  getRouteSettings(route: string, width: number): Promise<RouteSettings | undefined>;
  getAllRouteSettings(route: string): Promise<RouteSettings[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getPlaylistItems(): Promise<PlaylistItem[]> {
    return db.select().from(playlistItems).orderBy(desc(playlistItems.addedAt));
  }

  async addPlaylistItem(item: InsertPlaylistItem): Promise<PlaylistItem> {
    const [created] = await db.insert(playlistItems).values(item).returning();
    return created;
  }

  async removePlaylistItem(id: number): Promise<void> {
    await db.delete(playlistItems).where(eq(playlistItems.id, id));
  }

  async getPlaylistItemByVideoId(videoId: string): Promise<PlaylistItem | undefined> {
    const [item] = await db.select().from(playlistItems).where(eq(playlistItems.videoId, videoId));
    return item;
  }

  async saveRouteSettings(data: InsertRouteSettings): Promise<RouteSettings> {
    const existing = await db.select().from(routeSettings)
      .where(and(eq(routeSettings.route, data.route), eq(routeSettings.width, data.width)));
    let result: RouteSettings;
    if (existing.length > 0) {
      const [updated] = await db.update(routeSettings)
        .set({ settings: data.settings, globalUrls: data.globalUrls })
        .where(and(eq(routeSettings.route, data.route), eq(routeSettings.width, data.width)))
        .returning();
      result = updated;
    } else {
      const [created] = await db.insert(routeSettings).values(data).returning();
      result = created;
    }
    await db.update(routeSettings)
      .set({ globalUrls: data.globalUrls })
      .where(and(eq(routeSettings.route, data.route)));
    return result;
  }

  async getRouteSettings(route: string, width: number): Promise<RouteSettings | undefined> {
    const all = await db.select().from(routeSettings).where(eq(routeSettings.route, route));
    if (all.length === 0) return undefined;
    let closest = all[0];
    let minDiff = Math.abs(all[0].width - width);
    for (const row of all) {
      const diff = Math.abs(row.width - width);
      if (diff < minDiff) {
        minDiff = diff;
        closest = row;
      }
    }
    return closest;
  }

  async getAllRouteSettings(route: string): Promise<RouteSettings[]> {
    return db.select().from(routeSettings).where(eq(routeSettings.route, route)).orderBy(asc(routeSettings.width));
  }
}

export const storage = new DatabaseStorage();
