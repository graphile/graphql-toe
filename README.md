# GraphQL TOE

> Like bumping your toe on something... I usually throw things around after that
> happens  
> -- Pascal Senn, ChilliCream

TOE: **Throw On Error**

## What is it?

Takes a GraphQL response with `data` and `errors` and returns a value equivalent
to the `data` value, except if you read from a field that errored, the error
will be thrown (rather than being `null` and you having to look up the error in
`errors` yourself manually).

This allows you to handle GraphQL errors more naturally in your client code,
e.g. with `try/catch` or via `<ErrorBoundary />`, and also means you can rely on
the "semantic nullability" of your GraphQL schema, rather than the "strict
nullability" (i.e. you need to do fewer null checks since more of your types can
be non-nullable, even if errors might occur there).

See "more details" below for... well... more details.

## Zero-dependencies

This is a simple single-js-file module, it shouldn't add much to your bundle
size (v0.1.1 requires **just 468 bytes** gzipped
[according to bundlephobia](https://bundlephobia.com/package/graphql-toe@0.1.1))
and can be used with any client that will provide you `data` and `errors` - even
`fetch()`!

If you want the errors thrown to be of a particular class (e.g. `GraphQLError`
or just `Error`) then you should map them before feeding to `toe()` - we just
throw the raw error object you pass in.

## Installation

```bash
npm install --save graphql-toe
yarn add graphql-toe
pnpm install --save graphql-toe
```

## Usage

```ts
import { toe } from "graphql-toe";

const data = toe(result);
```

`data` now represents the combination of `result.data` and `result.errors`, such
that it's identical to `result.data` in the case that no errors occur, and
otherwise it's recursively modified to replace errored fields with a getter that
throws. In the case that `data` itself is `null` or undefined, `toe(result)`
itself will throw an error.

e.g.

```ts
import { toe } from "graphql-toe";

// Example data from GraphQL
const result = {
  data: {
    deep: {
      withList: [
        { int: 1 },
        {
          /* `null` because an error occurred */
          int: null,
        },
        { int: 3 },
      ],
    },
  },
  errors: [
    {
      message: "Two!",
      // When you read from this path, an error will be thrown
      path: ["deep", "withList", 1, "int"],
    },
  ],
};

// TOE'd data:
const data = toe(result);

// Returns `3`:
data.deep.withList[2].int;

// Returns an object with the key `int`
data.deep.withList[1];

// Throws the error `Two!`
data.deep.withList[1].int;
```

## More details

On the server side, GraphQL captures errors, replaces them in the returned
`data` with a `null`, and adds them to the `errors` object. Clients typically
then have to look at `data` and `errors` in combination to determine if a `null`
is a "true null" (just a `null` value) or an "error null" (a `null` with a
matching error in the `errors` list). This is unwieldy.

This project re-introduces thrown errors into your data, by walking the data
tree and replacing any errored fields with "getters" which means when you read a
field that has errored, you have an error thrown in your client! This can
therefore leverage JavaScript's natural error handling semantics (i.e.
`try/catch`), and also means that it can integrate naturally with things like
React's `<ErrorBoundary />` component!

## TODO

- [ ] Add support for incremental delivery
- [ ] Add an optimized `toe()` where all inputs are assumed to be null-prototype
      objects, making key traversal faster
- [ ] Add an optimized `toe()` where inputs are modified in-place (mutated) for
      maximum performance

## History

Version 0.1.0 of this module was released from the San Francisco Centre the day
after GraphQLConf, following many fruitful discussions around nullability.
