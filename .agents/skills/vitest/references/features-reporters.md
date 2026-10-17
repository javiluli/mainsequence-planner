---
name: reporters
description: Built-in reporters, default selection, and CI/output configuration
---

# Reporters

Select reporters via `--reporter` or `reporters` config. Configuring `reporters` **replaces** auto-selection. In 4.1, `configDefaults.reporters` is empty; include the desired reporter explicitly.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: ['verbose', ['junit', { suiteName: 'UI tests' }]],
    // request the normal terminal reporter and JSON explicitly:
    // reporters: ['default', 'json'],
  },
})
```

## Default Selection

When `reporters` is unset, Vitest auto-selects:

- `default` for normal terminal runs
- **`minimal` (alias `agent`)** when it detects an **AI coding agent** — only failed tests + errors, no summary or passing logs, optimized to cut token usage
- `github-actions` is added when `process.env.GITHUB_ACTIONS === 'true'`

## Built-in Reporters

| Reporter | Use |
|----------|-----|
| `default` | Summary + collapses passing files; prints full tree for single/failing file |
| `verbose` | One line per finished test (flat list in v4); only reporter that shows annotations on pass |
| `tree` | Like `default` but always shows each test (the old v3 verbose) |
| `dot` | One dot per test; details only for failures |
| `minimal` / `agent` | Failures only; best for AI/LLM workflows |
| `junit` | JUnit XML (templated, see below) |
| `json` | Jest-compatible JSON; includes `coverageMap` when coverage enabled |
| `tap` / `tap-flat` | TAP (nested / flat) |
| `html` | Interactive UI report (needs `@vitest/ui`) |
| `blob` | Serialized results for `--merge-reports` |
| `github-actions` | Workflow annotations + job summary |
| `hanging-process` | Lists processes preventing exit (debugging) |

> v4 removed the `basic` reporter (equivalent to `['default', { summary: false }]`). The old `verbose` flat behavior moved here; use `tree` for the nested view.

## Output Files

```bash
vitest --reporter=json --outputFile=./test-output.json
```

```ts
defineConfig({
  test: {
    reporters: ['junit', 'json'],
    outputFile: { junit: './junit.xml', json: './report.json' },
  },
})
```

## JUnit Templating

```ts
reporters: [['junit', {
  suiteNameTemplate: '{title}',     // {title} {filename} {basename} {displayName}
  classnameTemplate: '{classname}', // {classname} {title} {suitename} {filename} ...
  titleTemplate: '{title}',
  ancestorSeparator: ' > ',
  addFileAttribute: true,
}]]
```

`{filename}` is the **relative** path (use `{basename}` for the bare name). Templates can also be functions receiving all variables.

## HTML Report (Vitest 4.1)

The HTML reporter requires `@vitest/ui` and uses `outputFile` (default `./html/index.html`). This is an optional reference, not a dependency to add during an audit.

```ts
reporters: ['html'],
outputFile: './html/index.html',
```

## Blob & Merge (CI/sharding)

Blobs default to `.vitest-reports`. Use distinct output filenames when collecting results from multiple environments:

```bash
vitest run --reporter=blob --outputFile=reports/blob-1.json
vitest --merge-reports=reports --reporter=junit --reporter=default
```

Blob reports don't include file attachments — merge `attachmentsDir` (`.vitest-attachments`) separately. `--reporter=blob`/`--merge-reports` don't work in watch mode.

## Key Points

- Configuring `reporters` replaces auto-selection; include the desired reporters explicitly
- The `minimal`/`agent` reporter is auto-selected for AI agents and minimizes token usage
- Use `tree` for the nested per-test view (old v3 `verbose`)
- In 4.1, blob reports use `.vitest-reports`, attachments use `.vitest-attachments`, and HTML uses `outputFile`

<!--
Source references:
- https://v4.vitest.dev/guide/reporters
- https://v4.vitest.dev/config/reporters
-->
