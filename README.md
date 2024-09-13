# GraphQL TOE

**Throw On Error**

On the server side, GraphQL captures errors, replaces them in the returned
`data` with a `null`, and adds them to the `errors` object. Clients typically
then have to look at `data` and `errors` in combination to determine if a
`null` is a "true null" (just a `null` value) or an "error null" (a `null` with
a matching error in the `errors` list). This is unwieldy.

This project re-introduces thrown errors into your data, by walking the data
tree and replacing any errored fields with "getters" which means when you read
a field that has errored, you have an error thrown in your client! This can
therefore leverage JavaScript's natural error handling semantics (i.e.
`try/catch`), and also means that it can integrate naturally with things like
React's `<ErrorBoundary />` component!

## Installation

```
npm install --save graphql-toe
yarn add graphql-toe
pnpm install --save graphql-toe
```

## Usage

```ts
import { toe } from 'graphql-toe';

const data = toe(result)
```

`data` now represents the combination of `result.data` and `result.errors`,
such that it's identical to `result.data` in the case that no errors occur, and
otherwise it's recursively modified to replace errored fields with a getter
that throws. In the case that `data` itself is `null` or undefined,
`toe(result)` itself will throw an error.

## TODO

- [ ] Add support for incremental delivery
- [ ] Add an optimized `toe()` where all inputs are assumed to be
  null-prototype objects, making key traversal faster
- [ ] Add an optimized `toe()` where inputs are modified in-place (mutated) for
  maximum performance
