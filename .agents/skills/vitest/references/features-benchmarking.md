---
name: benchmarking
description: Write benchmarks with the Vitest 4.1 top-level bench API (Tinybench)
---

# Benchmarking (Vitest 4.1)

Use `bench` imported from `vitest`, in files matched by `benchmark.include` (default `**/*.{bench,benchmark}.?(c|m)[jt]s?(x)`). Benchmarks are powered by [Tinybench](https://github.com/tinylibs/tinybench).

## Defining Benchmarks

```ts
import { bench, describe } from 'vitest'

const input = '{"items":[1,2,3]}'

describe('parsing', () => {
  bench('JSON.parse', () => {
    JSON.parse(input)
  })
})
```

## Running and Comparing

```bash
vitest bench
vitest bench --run --outputJson=./benchmarks/baseline.json
vitest bench --run --compare=./benchmarks/baseline.json
```

The corresponding options are `benchmark.outputJson` and `benchmark.compare`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    benchmark: {
      include: ['test/**/*.bench.ts'],
      outputJson: './benchmarks/results.json',
      compare: './benchmarks/baseline.json',
    },
  },
})
```

## Key Points

- In 4.1, `bench` is a top-level API, not a test-context fixture with `.run()`.
- Use representative inputs and comparable runtime conditions; a microbenchmark does not establish browser loading or interaction performance.
- Add benchmarks only for a concrete performance question, following the project's test ownership.

<!--
Source references:
- https://v4.vitest.dev/api/#bench
- https://v4.vitest.dev/config/benchmark
-->
