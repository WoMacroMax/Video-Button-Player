import { type User, type InsertUser, type PlaylistItem, type InsertPlaylistItem, users, playlistItems } from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc } from "drizzle-orm";
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
}

export const storage = new DatabaseStorage();
