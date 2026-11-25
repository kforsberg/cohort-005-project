import { and, desc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { bookmarks, courses, lessons, modules, notes } from "~/db/schema";

// ─── Bookmarks and Notes ───
// A Student's private saves on Lessons. Every function takes the database
// first, so the rules can be exercised against an in-memory database.

export type Db = BetterSQLite3Database<typeof schema>;

export const MAX_NOTE_LENGTH = 2_000;

export function getBookmark(db: Db, userId: number, lessonId: number) {
  return db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId)))
    .get();
}

export function toggleBookmark(
  db: Db,
  userId: number,
  lessonId: number,
  now: Date
) {
  const existing = db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId)))
    .get();

  if (existing) {
    db.delete(bookmarks).where(eq(bookmarks.id, existing.id)).run();
    return false;
  }

  db.insert(bookmarks)
    .values({ userId, lessonId, createdAt: now.toISOString() })
    .run();
  return true;
}

export function getNote(db: Db, userId: number, lessonId: number) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
    .get();
}

export type SaveNoteResult =
  { ok: true; note: typeof notes.$inferSelect } | { ok: false; error: string };

export function saveNote(
  db: Db,
  userId: number,
  lessonId: number,
  body: string,
  now: Date
): SaveNoteResult {
  const trimmedBody = body.trim();
  if (trimmedBody.length === 0) {
    return { ok: false, error: "A note cannot be empty." };
  }
  if (trimmedBody.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: `A note must be ${MAX_NOTE_LENGTH} characters or fewer.`,
    };
  }

  const existing = getNote(db, userId, lessonId);
  if (existing) {
    const nowMs = now.getTime();
    const previousMs = new Date(existing.updatedAt).getTime();
    const updatedAt = new Date(Math.max(nowMs, previousMs + 1)).toISOString();
    const note = db
      .update(notes)
      .set({ body: trimmedBody, updatedAt })
      .where(eq(notes.id, existing.id))
      .returning()
      .get();

    return { ok: true, note };
  }

  const createdAt = now.toISOString();
  const note = db
    .insert(notes)
    .values({
      userId,
      lessonId,
      body: trimmedBody,
      createdAt,
      updatedAt: createdAt,
    })
    .returning()
    .get();

  return { ok: true, note };
}

export function deleteNote(db: Db, userId: number, lessonId: number) {
  db.delete(notes)
    .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
    .run();
}

export function getSavedBookmarks(db: Db, userId: number) {
  return db
    .select({
      id: bookmarks.id,
      createdAt: bookmarks.createdAt,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      moduleTitle: modules.title,
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(bookmarks)
    .innerJoin(lessons, eq(bookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt))
    .all();
}

export function getSavedNotes(db: Db, userId: number) {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      updatedAt: notes.updatedAt,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      moduleTitle: modules.title,
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(notes)
    .innerJoin(lessons, eq(notes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt))
    .all();
}
