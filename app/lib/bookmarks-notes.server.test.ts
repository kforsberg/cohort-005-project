import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import {
  getSavedBookmarks,
  getSavedNotes,
  saveNote,
  toggleBookmark,
} from "./bookmarks-notes.server";

const NOW = new Date("2026-10-06T12:00:00.000Z");

let db: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonIds = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

describe("Bookmarks", () => {
  it("toggles a bookmark on and off", () => {
    expect(toggleBookmark(db, base.user.id, lessonIds[0], NOW)).toBe(true);
    expect(getSavedBookmarks(db, base.user.id)).toHaveLength(1);

    expect(toggleBookmark(db, base.user.id, lessonIds[0], NOW)).toBe(false);
    expect(getSavedBookmarks(db, base.user.id)).toHaveLength(0);
  });

  it("lists only the student's bookmarks, newest first, with their Lesson and Course", () => {
    const later = new Date(NOW.getTime() + 1_000);
    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    toggleBookmark(db, base.user.id, lessonIds[1], later);

    const otherStudent = db
      .insert(schema.users)
      .values({
        name: "Other Student",
        email: "other@example.com",
        role: schema.UserRole.Student,
      })
      .returning()
      .get();
    toggleBookmark(db, otherStudent.id, lessonIds[0], later);

    expect(getSavedBookmarks(db, base.user.id)).toMatchObject([
      {
        lessonTitle: "Lesson 2",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
      {
        lessonTitle: "Lesson 1",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
    ]);
  });
});

describe("Notes", () => {
  it("trims a new Note and replaces its body without changing its creation time", () => {
    const first = saveNote(
      db,
      base.user.id,
      lessonIds[0],
      "  First thought.  ",
      NOW
    );
    expect(first).toMatchObject({
      ok: true,
      note: {
        body: "First thought.",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    });

    const later = new Date(NOW.getTime() + 1_000);
    const second = saveNote(
      db,
      base.user.id,
      lessonIds[0],
      "  Revised thought.  ",
      later
    );
    expect(second).toMatchObject({
      ok: true,
      note: {
        body: "Revised thought.",
        createdAt: NOW.toISOString(),
        updatedAt: later.toISOString(),
      },
    });
    expect(getSavedNotes(db, base.user.id)).toHaveLength(1);
  });

  it("moves the edited time forward even when two saves share a timestamp", () => {
    saveNote(db, base.user.id, lessonIds[0], "First.", NOW);

    const result = saveNote(db, base.user.id, lessonIds[0], "Second.", NOW);

    expect(result).toMatchObject({
      ok: true,
      note: {
        body: "Second.",
        updatedAt: new Date(NOW.getTime() + 1).toISOString(),
      },
    });
  });

  it("accepts exactly 2,000 characters and refuses anything longer", () => {
    expect(
      saveNote(db, base.user.id, lessonIds[0], "a".repeat(2_000), NOW).ok
    ).toBe(true);

    expect(
      saveNote(db, base.user.id, lessonIds[0], "b".repeat(2_001), NOW)
    ).toEqual({
      ok: false,
      error: "A note must be 2000 characters or fewer.",
    });
    expect(getSavedNotes(db, base.user.id)).toMatchObject([
      { body: "a".repeat(2_000) },
    ]);
  });

  it("lists only the student's Notes, newest edited first, joined to Lesson and Course", () => {
    saveNote(db, base.user.id, lessonIds[0], "Older note.", NOW);
    const later = new Date(NOW.getTime() + 1_000);
    saveNote(db, base.user.id, lessonIds[1], "Newer note.", later);

    const otherStudent = db
      .insert(schema.users)
      .values({
        name: "Other Student",
        email: "other@example.com",
        role: schema.UserRole.Student,
      })
      .returning()
      .get();
    saveNote(
      db,
      otherStudent.id,
      lessonIds[1],
      "Private to someone else.",
      later
    );

    expect(getSavedNotes(db, base.user.id)).toMatchObject([
      {
        body: "Newer note.",
        lessonTitle: "Lesson 2",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
      {
        body: "Older note.",
        lessonTitle: "Lesson 1",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
    ]);
  });
});
