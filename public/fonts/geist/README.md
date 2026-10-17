# Geist font assets

`Geist-Variable.woff2` and `GeistMono-Variable.woff2` are locally versioned font assets from the official
[Geist font project](https://github.com/vercel/geist-font), originally distributed through `geist@1.7.1`.

Copyright (c) 2023 Vercel, in collaboration with basement.studio. The font software is distributed under the SIL Open Font License,
Version 1.1; see `LICENSE.txt` in this directory.

The shared monospace role is defined once by Tailwind v4's --font-mono theme token in [src/index.css](../../../src/index.css). Existing font-mono numeric/measurement labels and semantic code, pre, kbd and samp elements use Geist Mono with the same system fallback. Geist Sans remains the interface text family; role sizes, weights and tabular-number settings stay with their existing consumers. Both variable faces retain font-display: swap and load from these local assets without a font package or external service.
