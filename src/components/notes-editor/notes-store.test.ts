import { describe, expect, it } from "vitest";

import { resolveNoteView } from "./notes-store";
import type { NoteEditorBaseline } from "./notes-store";

const baseline = (overrides: Partial<NoteEditorBaseline>): NoteEditorBaseline => ({
  baseVersionId: "user-version",
  contentHash: "hash",
  dirty: false,
  editSeq: 0,
  suppressedReviewVersionId: null,
  ...overrides,
});

describe("resolveNoteView", () => {
  it("shows the history diff over everything else", () => {
    expect(
      resolveNoteView(
        { pendingReviewBaseVersionId: "base", versionId: "agent-version" },
        baseline({}),
        "old-version",
      ),
    ).toEqual({ baseVersionId: "old-version", kind: "history" });
  });

  it("shows the editor when no review is pending", () => {
    expect(
      resolveNoteView(
        { pendingReviewBaseVersionId: null, versionId: "user-version" },
        baseline({}),
        undefined,
      ),
    ).toEqual({ kind: "editor" });
  });

  it("shows the review for a pending review over a clean editor", () => {
    expect(
      resolveNoteView(
        { pendingReviewBaseVersionId: "base", versionId: "agent-version" },
        baseline({}),
        undefined,
      ),
    ).toEqual({ baseVersionId: "base", kind: "review" });
  });

  it("keeps the editor while it has unsaved edits", () => {
    expect(
      resolveNoteView(
        { pendingReviewBaseVersionId: "base", versionId: "agent-version" },
        baseline({ dirty: true }),
        undefined,
      ),
    ).toEqual({ kind: "editor" });
  });

  it("keeps the editor when this review was typed over, until Review allows it", () => {
    expect(
      resolveNoteView(
        { pendingReviewBaseVersionId: "base", versionId: "agent-version" },
        baseline({ suppressedReviewVersionId: "agent-version" }),
        undefined,
      ),
    ).toEqual({ kind: "editor" });
  });

  it("ignores a suppression left over from an older review", () => {
    expect(
      resolveNoteView(
        { pendingReviewBaseVersionId: "base", versionId: "agent-version-2" },
        baseline({ suppressedReviewVersionId: "agent-version-1" }),
        undefined,
      ),
    ).toEqual({ baseVersionId: "base", kind: "review" });
  });
});
