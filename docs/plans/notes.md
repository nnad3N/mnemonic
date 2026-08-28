# Notes

A note is a markdown document the user owns. It is where work done in a thread
becomes something kept: a report the agent wrote, refined by hand or with the
agent, and exported when done. This plan records the decisions that are settled.
Implementation details are left to the commits that land them; tick the boxes as
they do.

"Note" is the name in code and in the UI. "Memory" stays reserved for Mastra's
agent memory, which the user never sees.

## Decisions

### Scope

- A note is scoped by exactly one of two ids: the thread it was written in, or a
  topic. A database check keeps at least one of them set, and reads resolve the
  topic when there is one and the thread otherwise.
- "Add to topic" is a one-way move done by the user: the note leaves its thread
  and lives in the topic from then on. There is no toggle back, and an agent
  cannot move a note.
- Deletion is a hard delete and user-only. Agents cannot delete notes. A
  separate AI-assisted review screen for outdated notes comes later, outside
  chat.

### Versions

- One linear chain of full snapshots, never stored diffs. Each version carries
  its content, a hash of it, and the author (user or agent).
- There is no commit and no draft: a save writes a version, carrying the id of
  the version the editor is based on. A user save overwrites that base version
  when the user wrote it — even when the agent has appended past it, so a late
  autosave lands in the user's own entry mid-chain instead of burying the
  agent's — and appends a new version when the base is the agent's latest, so an
  agent's text always survives as its own entry to diff against.
- A run is the agent's unit, not a tool call: the first note write in a run
  appends a version and later writes in the same run overwrite it. The run
  records which notes it has already versioned on `thread_run`, so no version
  points at a run and deleting run rows breaks nothing.
- Versions carry `createdAt` and `updatedAt`; an overwritten version keeps the
  first timestamp and moves the second, which is what the timeline shows.
- The user's editor autosaves the body on a timer, comparing the hash of the
  markdown against the stored one, and the title on a debounce. The two are
  separate writes so renaming never rewrites the body.
- Reading a version and writing it share a transaction; concurrent saves would
  otherwise pick the same sequence number.
- Reverting truncates the chain: the versions above the target are dropped and
  the note goes back to being that version. Failed attempts do not linger in the
  timeline.

### Agent access

- Three tools: read a note, write a new note, update an existing one. Search
  comes later; until then the model only learns of notes through mentions.
- Only the parent has them. It also reads notes directly instead of delegating:
  a note is the user's curated document, high-quality context worth the parent's
  own attention.
- Scope mirrors the mention menu: the thread's notes, plus the topic's and its
  threads' notes when the thread is in a topic. A new note is always created in
  the current thread; update works on any note within that scope. An agent never
  moves a note between scopes.
- An agent never sees the user's in-flight typing beyond the last autosave.
- When a note tool finishes, the client invalidates that note's query, and an
  open editor with no local edits adopts what the agent wrote at its next
  autosave tick. The editor tracks the version it is based on (id and content
  hash), so a cache that moved off that baseline reseeds the editor instead of
  being treated as local edits — without this the autosave pushed its stale
  bytes back and silently reverted the agent's update. When the user did type
  in the same window, their saves land in that base version and the agent's
  version stays the latest; the editor keeps showing the user's text, with
  nothing on screen pointing at the agent's newer version until the diff-based
  sync below lands.

### Diff-based sync (direction, not yet settled)

Ideas for making agent edits robust once version diffing lands; recorded so
they are not lost, details to be worked out then.

- The note data event carries the agent's change as a diff the client applies
  to the editor directly. The user sees the change the moment the tool
  finishes, instead of after the invalidation round trip; invalidation stays as
  reconciliation, not as the way changes arrive.
- The editor shows the agent's change as a diff against the version the user
  was looking at, so what the agent did is visible at a glance rather than the
  content just being different.
- Sync becomes an invariant instead of a race: the agent's version is always
  the base. An agent edit is a replacement anchored in a known version, so it
  is always safe to build on; the user's uncommitted edits are what get rebased
  onto it, non-overlapping ones preserved, overlapping ones rejected. The
  base-version save already gives half of this invariant — local edits can no
  longer overwrite an agent version; the rebase of user edits onto it is what
  remains.

### Retrieval

- Nothing is embedded on save. Notes are few and short, and a write path that
  calls an embedder blocks a keystroke-driven save on a provider round trip.
- Search is FTS5 over note content, scoped to the topic or thread the agent is
  working in. No provider key, no index to maintain, and exact terms — file
  names, identifiers, numbers — match, which is most of what a note holds.
- Embeddings come back with the notes manager, which owns them lazily for
  relationship and staleness work rather than for this search.

### Export

- Download the current content as markdown or docx, rendered on request, not
  stored. PDF goes through the browser's print dialog on the rendered note, so
  the text stays selectable instead of being an image of the editor.

## Frontend outline

- Two tables, like the files table: notes in a topic and notes in a thread, both
  reading one `listNotes` that takes the scope as a union. Rows carry the title,
  who wrote last and when, with view, add to topic and delete in a row menu.
- The right-hand panel holds the editor: tabs for the open notes, a toolbar, a
  title and the body. Which notes are open lives in the URL, separately from
  whether the panel is open.
- A timeline of the version chain rather than a commit list: versions have no
  messages, so each entry previews what changed on its own — an author label,
  the time, and added, replaced and removed word counts behind coloured
  indicators.
- The timeline is a toggle in the note's actions menu and opens its own panel on
  the right, exclusive with the sidebar.
- Selecting an entry makes it the point of comparison: every other entry's
  counts are relative to the selected version, so standing at the oldest one
  shows what has been added since. The counts are computed on the server, and the
  client keys that query by the selected version id.
- Consecutive agent versions collapse into one iteration block: writing, judging
  the result, rolling back and trying again is one piece of work no matter how
  many runs it took. A collapsed block shows the counts of its newest version
  and expands to the versions inside, so any of them can be selected or reverted
  to. User versions are never consecutive, so nothing groups them.
- Opening an entry shows the diff, and revert lives there.
- Export, add to topic and delete live in the note's actions menu.

## Progress

Done:

- [x] Schema: note and note version tables, scope check, content hash
- [x] Server functions: create, read, autosave body, rename, add to topic, delete
- [x] Editor panel: tabs, toolbar, title, body, autosave

Backend:

- [x] Parent agent tools: read note, write note (creates in the current thread),
      update note (exact once-only text replacement) — every write an `agent`
      version, with the run-scoped overwrite recorded on `thread_run`
- [x] `note_version.updatedAt`, moved by the run-scoped overwrite
- [ ] Note search tool: FTS5 over note content, scoped
- [x] `listNotes` over a thread or topic scope, with search and pagination
- [x] Base-version saves: a user save carries the version id it is based on and
      the server routes it — overwrite the base, append after the agent's
      latest, or land mid-chain when the agent moved past it
- [ ] A save whose base is an agent version the agent has since replaced is
      dropped: the editor detaches and those edits live only until the note
      closes. Needs a real home — rebasing them onto the agent's latest — when
      diff-based sync lands

Frontend:

- [x] Notes table for a topic and for a thread
- [ ] Diff-based sync when an agent writes a note that is open in the editor —
      today a clean editor adopts the agent's write, and concurrent local edits
      land in the user's base version below the agent's latest, invisibly until
      the note reopens; see the diff-based sync section for the intended model
- [x] Notes in the mention menu: the mentions query is keyed by the thread and the
      server resolves its topic; a topic thread lists the topic's files, notes,
      the topic's threads and their notes, a standalone thread only its own notes.
      Adding or clicking a note mention opens it in the panel, and a response link
      with a `mention:note::…` href renders as a mention chip
- [ ] Timeline endpoint: entries with word counts relative to a selected version
- [ ] Timeline panel with author labels, indicators and collapsed agent blocks
- [ ] Diff viewer, with revert
- [x] Export to markdown and docx, print to pdf
