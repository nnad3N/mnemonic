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
- There is no commit and no draft: a save writes a version. The editor is
  always anchored to the latest user version — a save's base can never be an
  agent version. An anchored save overwrites that user version, even when the
  agent has appended past it, so a late autosave lands in the user's own entry
  mid-chain instead of burying the agent's; an editor sitting on the agent's
  latest sends no base and appends a new user version on top. User versions are
  never consecutive, and both invariants are hard-checked server-side.
- A run is the agent's unit, not a tool call: the first note write in a run
  appends a version and later writes in the same run overwrite it. The run
  records which notes it has already versioned on `thread_run`, so no version
  points at a run and deleting run rows breaks nothing.
- Versions carry `createdAt` and `updatedAt`; an overwritten version keeps the
  first timestamp and moves the second, which is what the timeline shows.
- The user's editor autosaves the body on a debounce off the editor's change
  event, comparing the hash of the markdown against the stored one, and the
  title on its own debounce. The two are separate writes so renaming never
  rewrites the body.
- Reading a version and writing it share a transaction; concurrent saves would
  otherwise pick the same sequence number.
- Reverting truncates the chain: the versions above the target are dropped and
  the note goes back to being that version. Failed attempts do not linger in the
  timeline.

### Agent access

- Four tools: search notes, read one, write a new one, update an existing one.
- Only the parent has them. It also reads notes directly instead of delegating:
  a note is the user's curated document, high-quality context worth the parent's
  own attention.
- Scope mirrors the mention menu: the thread's own notes, plus the topic's
  shared notes when the thread is in a topic. A note written in a sibling thread
  stays private to that conversation until the user adds it to the topic. A new
  note is always created in the current thread; update works on any note within
  that scope. An agent never moves a note between scopes.
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

### Diff-based sync

The invariant is in place: every save carries its base version, so a local
edit can never overwrite an agent version — it lands in the user's own entry,
and the diff view resolves the divergence with Commit or Reject, both forward
moves on the chain. Commit stamps the agent version's `reviewedAt` (any agent
write clears it), and the review view derives from that state instead of being
routed, so a refresh restores it from the database. An agent write landing while the review is open resolves
without asking: the review edits are rebased onto the agent's new text with a
line-level three-way merge, overlapping edits going to the agent — whoever
asks the agent to edit a note they are editing has accepted merge semantics.
Saves into the agent version carry the version's `updatedAt` as an
optimistic-concurrency token; a write based on a stale snapshot is refused and
merges first. Still open:

- The note data event carries the agent's change as a diff the client applies
  to the editor directly. The user sees the change the moment the tool
  finishes, instead of after the invalidation round trip; invalidation stays as
  reconciliation, not as the way changes arrive.
- The merge reseeds the diff document, which drops the cursor; a finer-grained
  rebase of editor operations would keep it.

### Retrieval

- Nothing is embedded on save. Notes are few and short, and a write path that
  calls an embedder blocks a keystroke-driven save on a provider round trip.
- Search is Postgres full text search over the note title and the latest
  version's content, covering the current thread's notes and, when the thread is
  in a topic, the topic's shared notes. A sibling thread's notes stay out: they
  belong to that conversation until the user adds them to the topic. No provider
  key, and exact terms — file names, identifiers, numbers — match, which is most
  of what a note holds.
- The version row carries two generated `tsvector` columns, one stemmed as
  English and one unstemmed, so no write path has to maintain either. The agent
  says which of the two to search: English stems, everything else matches
  literal word forms, since a note in French or Polish would otherwise lose
  words to the English stemmer and stop list. Notes may mix languages, which the
  unstemmed vector handles on its own.
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
      update note (exact once-only text replacement, or overwrite of the whole
      content, which is the only way into a note the user created empty) — every
      write an `agent` version, with the run-scoped overwrite recorded on
      `thread_run`
- [x] `note_version.updatedAt`, moved by the run-scoped overwrite
- [x] Note search tool: Postgres full text search over the title and the latest
      version's content, ranked, with `ts_headline` snippets, over this thread's
      notes and the topic's, against the English or the unstemmed vector as the
      agent asks
- [x] `listNotes` over a thread or topic scope, with search and pagination
- [x] Anchored saves: a user save declares its intent as a variant — overwrite,
      carrying the latest user version's id (valid even mid-chain below an
      agent latest), or append, valid only on top of an agent latest. The shape
      makes other combinations unrepresentable and the server rejects stale
      ones
- [x] Timeline word counts diff the text extracted from the markdown-it token
      stream, so syntax-only edits count as no change

Frontend:

- [x] Notes table for a topic and for a thread
- [x] Diff-based sync when an agent writes a note that is open in the editor —
      the review view is derived from data, not routed: an uncommitted agent
      latest (`reviewedAt` null) over a non-empty user version renders the diff
      in place of the editor. A clean editor swaps immediately; with local
      edits a floating banner offers Review, and saves keep landing in the
      user's version. The diff renders through `@platejs/diff` in the editor's
      own typography and is editable inline, with edits saving on a debounce
      into the agent's latest version (keeping its authorship). Commit marks
      the version reviewed and exits; Reject appends the user's base text as a
      new version on top, the agent's surviving below. Editor dirtiness and the
      save baseline live in a zustand store keyed by note id
- [x] History diff from the timeline: one URL id — the old version — diffed
      against the current document, editable when the user's version is the
      latest, with edits saving into it; a Close button exits
- [x] Notes in the mention menu: the mentions query is keyed by the thread and the
      server resolves its topic; a topic thread lists the topic's files, its
      shared notes, this thread's own notes and the topic's threads, a
      standalone thread only its own notes.
      Adding or clicking a note mention opens it in the panel, and a response link
      with a `mention:note::…` href renders as a mention chip
- [x] Timeline endpoint: entries with word counts relative to a selected version
- [x] Timeline panel with author labels, indicators and collapsed agent blocks,
      as a column inside the notes panel; the selected comparison version and
      the panel toggle live in URL search params
- [x] Diff viewer (revert still pending)
- [x] Revert from the timeline
- [x] Export to markdown and docx, print to pdf
