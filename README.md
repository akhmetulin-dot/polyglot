# Полиглот + Карта жизни

This repository holds **two completely independent projects**. They were split
out of a single mixed workspace: nothing is shared between them any more — no
code, no database tables, no build config, no dependencies.

| Folder      | Project                        | What it is                                          |
| ----------- | ------------------------------ | --------------------------------------------------- |
| `polyglot/` | **Полиглот**                   | Vocabulary trainer with session-based spaced repetition |
| `mindmap/`  | **Карта жизни**                | Offline-first mind map PWA                           |

Each folder is a self-contained pnpm workspace with its own `package.json`,
`pnpm-workspace.yaml`, `tsconfig.base.json`, `netlify.toml`, `.env.example`,
lockfile and `docs/`. Neither one references anything outside its own folder.

Start with the project you want to work on:

- [`polyglot/README.md`](polyglot/README.md)
- [`mindmap/README.md`](mindmap/README.md)

## Splitting into two GitHub repositories

Because each folder is already a valid repository root, the split is a move,
not a refactor. For each project:

1. Create the new empty GitHub repository.
2. Copy the folder's contents (not the folder itself) into a fresh clone of it.
3. Delete the root `netlify.toml` and this `README.md` — they only exist to
   keep the two projects side by side here. Everything the project needs is
   already inside its own folder.
4. Commit and push.

To preserve history instead of starting fresh, use `git subtree split`:

```bash
git subtree split --prefix=polyglot -b polyglot-only
git push git@github.com:<you>/polyglot.git polyglot-only:main
```

…and the same with `--prefix=mindmap`.

## Netlify

One Netlify site builds one project. While both live in this repository, the
site's **base directory** selects which:

| Netlify site | Base directory | Config it loads       |
| ------------ | -------------- | --------------------- |
| Полиглот     | `polyglot`     | `polyglot/netlify.toml` |
| Карта жизни  | `mindmap`      | `mindmap/netlify.toml`  |

The root `netlify.toml` only sets `base = "polyglot"` so that a site created
without any configuration builds something sensible. Netlify reads the
`netlify.toml` found in the base directory, which is where the real build
settings live. After the split, each project's `netlify.toml` sits at its own
repository root and works unchanged.
