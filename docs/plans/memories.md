# Memories

A memory is a markdown document the user owns. It is where work done in a thread
becomes something kept: a report the agent wrote, refined by hand or with the
agent, and exported when done. This plan records the decisions that are settled.
Implementation details are left to the commits that land them; tick the boxes as
they do.

## Decisions

### Scope

- A memory belongs to a thread (a conversation or a topic thread) and, through a
  topic thread, to a topic. Conversations have no topic, so their memories can
  never be shared.
- Sharing is a flag only the user can set. A shared memory is visible to every
  thread in its topic and is the only kind that gets embedded. The agent has no
  way to share; the point is that only memories the user cares about spread
  across the topic.
- Deletion is a hard delete and user-only. Agents cannot delete memories. A
  separate AI-assisted review screen for outdated memories comes later, outside
  chat.

### Versions and branches

- History is a linear chain of full snapshots, never stored diffs. Diffs shown in
  the UI are computed from adjacent snapshots with `jsdiff`.
- Two pointers into the chain: `main` and `draft`, with draft always on top of
  main (fast-forward only, so no branch column and no merges).
  - `main` is what the topic sees: searched, embedded when shared, exported by
    default.
  - `draft` is where agents commit. Every agent write is a commit on draft; agents
    never move main.
- The user's typing is a working copy, autosaved but not a version. It never
  becomes a commit on its own.
- The user's commit button targets a chosen branch: commit to draft adds a user
  commit there; commit to main also fast-forwards main to the result and, when
  shared, embeds. Promoting main is the one human gate, and it is a UI action,
  not a tool approval.
- Each version carries an author (user or agent) and an optional message; the
  agent supplies a short summary with its write.
- Revert is a new commit with the old content, not history rewriting.

### Agent access

- Three tools: search (vectors over main of shared memories in the topic), read
  (draft head, which is main when there is no draft — what the user sees), write
  (old-text/new-text edits, each matching exactly once, committed on draft).
- Parents get all three, search only where a topic exists. The worker subagent
  gets read and search. The reader subagent gets read only.
- An agent write applies its edits to the latest text. If a working copy exists
  it is first folded into a user commit so the agent is always editing the
  newest version. An edit whose old text no longer matches once is rejected as a
  normal tool result telling the agent the region changed and to re-read; that is
  the only conflict, and it only happens when the user saved during the tool
  call and touched the same span.
- The other direction — a user autosave whose base is behind draft because the
  agent committed meanwhile — rebases the user's delta onto draft head with
  `jsdiff`, and only discards on overlapping hunks. The client syncs often enough
  that this should be rare; how rare is something to measure before building UI
  for it.

### Embedding

- Own index and a cheap embedder, separate from the file index. Chunked by
  markdown headings. Metadata carries memory, version, topic and user ids.
- Embedding runs on commit to main of a shared memory, on share, and never on
  autosave. Unshare and delete remove the vectors.
- One embed run per memory at a time, claimed before it starts and released only
  if main has not moved since it last checked, so overlapping commits can never
  leave stale vectors behind.
- Not graph RAG. Memories are few, short and already synthesized; plain vector
  search over heading chunks is enough. The index shape stays compatible with
  the graph tool so it is a one-line change if that ever changes.

### Export

- Download of main (or the working copy when present) as docx/pdf, rendered on
  request, not stored.

## Frontend outline

Kept simple; details decided when built.

- One route for a topic's memories (all of them, shared or not) and one for a
  thread's memories, like the files route. A tab in the right-side viewer and an
  expand icon in its header that opens the route.
- Plate markdown editor for the working copy, with autosave.
- Commit button with a branch choice, and a commit list dropdown: click shows a
  stacked diff (diffs.com style), right click offers view, revert and similar.
- Share toggle, export, delete.

## Progress

Backend first.

- [ ] Schema: memory and memory version tables, main/draft pointers, working copy
- [ ] Server functions: list, read, autosave, commit (branch choice), share,
      delete, version list and diff, revert
- [ ] Agent tools: search, read, write, wired per agent as above
- [ ] Embed workflow with per-memory claim
- [ ] Export
- [ ] Frontend: routes and viewer tab
- [ ] Frontend: editor, commit flow, commit list and diffs
