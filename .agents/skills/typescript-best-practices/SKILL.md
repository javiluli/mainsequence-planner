---
name: typescript-best-practices
description: TypeScript best practices. Use when reading or editing any .ts or .tsx file.
paths: ["**/*.ts", "**/*.tsx"]
disable-model-invocation: true
---

# TypeScript best practices

Apply these rules directly and proportionally to the repository. Prefer its existing type conventions and validation libraries; do not require another skill as a prerequisite.

| Rule | Summary |
|------|---------|
| Discriminated unions | Use a literal discriminant when variants have different requirements. Reuse the existing discriminant; optional fields are valid when independently optional. |
| Branded types | Use brands for a demonstrated risk of mixing domain values. Reuse existing conventions and validate at the boundary. |
| Constructive modeling | Use representations that encode useful invariants, such as `[T, ...T[]]` for non-empty values. Numeric constraints, including non-negative duration, still require runtime validation. |
| Simplest total type | Keep `T[]` while every operation on it stays total. Strengthen to `NonEmpty<T>` only where the loose type forces `!`, a cast, or a "should never happen" throw. |
| `unknown` over `any` | External data is `unknown`. `any` disables type checking everywhere it touches. |
| Schemas before guards | Before hand-writing a property-by-property type guard, use the repository's runtime schema library and infer the type from the schema, such as `z.infer`. |
| Justified assertions | Prefer inference and narrowing. Use assertions for validated boundaries or proven invariants TypeScript cannot express; `as const` is not a runtime validation risk. |
| Narrowing | Choose the mechanism appropriate to the value: discriminants, `in`, `typeof`, `instanceof`, or a verified guard. No universal ranking is required. |
| Type guards | Must verify the claim. A lying guard is worse than `as` because the bug hides behind a name that says it's safe. Name them `isX` or `hasX`. |
| Exhaustiveness | Check exhaustiveness for closed unions, using the repository's existing helper or a `never` assignment. |
| `satisfies` over `as` | Checks assignability at compile time while retaining the inferred type, subject to contextual typing. It does not validate runtime data. |
| Boundary validation | Parse where data crosses in, into a named domain type. `Record<string, unknown>` (however spelled) stops at that parse. Trust types inside. |
| Schema-derived types | Derive from an existing source of truth when it represents the same contract; define an explicit interface when the API should be independent of implementation details. |
| Object args | Use an options object for several ambiguous positional arguments. Keep simple established signatures; assess allocation costs only with measurements. |

Examples: [TypeScript patterns](references/patterns.md).
