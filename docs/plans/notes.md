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
- There is no commit and no draft: a save writes a version. A user save
  overwrites the latest version when the user wrote it too, and appends a new one
  when the agent wrote last, so an agent's text always survives as its own entry
  to diff against.
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

- Tools: read a note by id, write a note (creating or replacing content, always
  as a new `agent` version), and search.
- Parents get all of them, search only where a topic exists. The worker subagent
  gets read and search. The reader subagent gets read only.
- An agent never sees the user's in-flight typing beyond the last autosave, and
  never moves a note between scopes.
- When a note tool finishes, the client invalidates that note's query, so an open
  editor shows what the agent wrote.

### Retrieval

- Nothing is embedded on save. Notes are few and short, and a write path that
  calls an embedder blocks a keystroke-driven save on a provider round trip.
- Search is FTS5 over note content, scoped to the topic or thread the agent is
  working in. No provider key, no index to maintain, and exact terms — file
  names, identifiers, numbers — match, which is most of what a note holds.
- Embeddings come back with the notes manager, which owns them lazily for
  relationship and staleness work rather than for this search.

### Export

- Download the current content as docx or pdf, rendered on request, not stored.
  Plate ships examples for both.

## Frontend outline

- Two tables, like the files table: notes in a topic and notes in a thread, each
  behind its own endpoint.
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

- [ ] Server functions accept an author (user or agent) and optional starting
      content, so an agent can create and write notes
- [ ] Agent tools: read, write, search — wired per agent as above
- [ ] Note search: FTS5 over note content, scoped
- [ ] List endpoints for a topic's notes and a thread's notes

Frontend:

- [ ] Notes table for a topic and for a thread
- [ ] Version `updatedAt` and per-run version bookkeeping on `thread_run`
- [ ] Timeline endpoint: entries with word counts relative to a selected version
- [ ] Timeline panel with author labels, indicators and collapsed agent blocks
- [ ] Diff viewer, with revert
- [ ] Export to docx and pdf
