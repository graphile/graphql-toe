# GraphQL TOE (Throw On Error)

**The <512 byte solution to your GraphQL ambiguous `null` woes.**

Works with:

- Apollo Client
- URQL
- graffle
- window.fetch()
- _any_ GraphQL client that returns the JSON `{ data, errors }`

Not needed with Relay; it supports error handling natively!

## The problem

You read `null` from a field in GraphQL... but is that a data-null ("that data
explicitly does not exist") or an error-null ("something went wrong")? This is
an important distinction: your boyfriend's profile page showing `Partner: none`
is very different than it showing `Error loading partner`!

If you're not using an error-handling GraphQL client, then for each `null` you
see in a GraphQL response you must check through the `errors` list to determine
if it relates to an error or not. To do so, you need to know the path of the
currently rendering data - instead of just passing the data to your component,
you need to pass the root list of errors, and the path of the data being
rendered.

Managing this yourself is a huge hassle, and most people don't bother - instead
either rejecting requests that include errors (and losing the "partial success"
benefit of GraphQL) or treating all `null` as ambiguous: maybe it errored, maybe
it's null, we don't know. Or worse, they treat error nulls as if they are data
nulls, and cause much heartbreak!

**Well, no more!**

## The solution

GraphQL-TOE transforms your GraphQL response (`{ data: {...}, errors: [...] }`)
into a new object that looks exactly like `data`, except it throws when you
access a position that is `null` due to an error. As such, your application can
never read an error-null (because the error will be thrown if you try) - so if
you read a `null` value you know it's definitely a data-null and can render it
as such. And for the errors... you can handle them as any other throw error:
with native JavaScript methods like `try`/`catch`, or those built on top of them
such as React's `<ErrorBoundary />`!

**Stop writing code that second-guesses your data; re-throw GraphQL errors!**

## Installation

```bash
yarn add graphql-toe
# OR: npm install --save graphql-toe
# OR: pnpm install --save graphql-toe
```

## Usage

```ts
import { toe } from "graphql-toe";

const result = await fetch(/* ... */).then((res) => res.json());
const data = toe(result);
```

If `result.data` is `null` or not present, `toe(result)` will throw immediately.
Otherwise, `data` is a derivative of `result.data` where errored fields are
replaced with throwing getters.

## Zero dependencies

**Under 512 bytes** gzipped
([v1.0.0-rc.0 on bundlephobia](https://bundlephobia.com/package/graphql-toe@1.0.0-rc.0))

Works with _any_ GraphQL client that returns `{ data, errors }`.

Errors are thrown as-is; you can pre-process them to wrap in `Error` or
`GraphQLError` if needed:

```ts
import { GraphQLError } from "graphql";
import { toe } from "graphql-toe";

const mappedResult = {
  ...result,
  errors: result.errors?.map(
    (e) =>
      new GraphQLError(e.message, {
        positions: e.positions,
        path: e.path,
        originalError: e,
        extensions: e.extensions,
      }),
  ),
};
const data = toe(mappedResult);
```

## Example

```ts
import { toe } from "graphql-toe";

// Result of query `{ users(first: 3) { id, name } }`
const graphqlResult = {
  data: {
    users: [
      { id: 1, name: "Alice" },
      null, // < An error occurred
      { id: 3, name: "Caroline" },
    ],
  },
  errors: [
    {
      path: ["users", 1],
      message: "Loading user 2 failed!",
    },
  ],
};

// Return the transformed data that with Throw On Error:
const data = toe(graphqlResult);

console.log(data.users[0]); // Logs { id: 1, name: "Alice" }
console.log(data.users[1]); // Throws "Loading user 2 failed!"
```

## Framework examples

Different frameworks and libraries have different approaches to feeding the
GraphQL result into GraphQL-TOE:

### Apollo Client (React)

```ts
import { useQuery } from "@apollo/client";
import { toe } from "graphql-toe";
import { useMemo } from "react";

function useQueryTOE(document, options) {
  const rawResult = useQuery(document, { ...options, errorPolicy: "all" });
  return useMemo(
    () => toe({ data: rawResult.data, errors: rawResult.error?.graphQLErrors }),
    [rawResult.data, rawResult.error],
  );
}
```

Now simply replace all usages of `useQuery()` with `useQueryTOE()`.

Note: apply similar changes for mutations and subscriptions.

### URQL

Use
[@urql/exchange-throw-on-error](https://github.com/urql-graphql/urql/tree/main/exchanges/throw-on-error):

```ts
import { Client, fetchExchange } from "urql";
import { throwOnErrorExchange } from "@urql/exchange-throw-on-error";

const client = new Client({
  url: "/graphql",
  exchanges: [fetchExchange, throwOnErrorExchange()],
});
```

### graffle

```ts
import { request } from "graffle";

const result = await request("https://api.spacex.land/graphql/", document);
const data = toe(result);
```

### fetch()

```ts
import { toe } from "graphql-toe";

const response = await fetch("/graphql", {
  headers: {
    Accept: "application/graphql-response+json, application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: "{ __schema { queryType { name } } }" }),
});
if (!response.ok) throw new Error("Uh-oh!");
const result = await response.json();
const data = toe(result);
```

### Relay

Relay has native support for error handling via the
[@throwOnFieldError](https://relay.dev/docs/guides/throw-on-field-error-directive/)
and [@catch](https://relay.dev/docs/guides/catch-directive/) directives - use
that instead!

## Semantic nullability

The
[@semanticNonNull](https://specs.apollo.dev/nullability/v0.4/#@semanticNonNull)
directive lets schema designers mark fields where `null` is **never a valid
value**; a `null` in such a position must mean an error occurred (and thus there
will be an entry in the `errors` list matching the path).

With `toe()` you can treat these `@semanticNonNull` fields as non-nullable since
we know error-nulls can never be accessed; and thus your JavaScript/TypeScript
frontend code will need fewer null checks!

In TypeScript, use
[semanticToStrict from graphql-sock](https://github.com/graphile/graphql-sock?tab=readme-ov-file#semantic-to-strict)
to rewrite semantic-non-null to traditional non-null for type generation.

Together, this combination gives you:

- More accurate codegen types
- Improved DX with fewer null checks
- Safer, cleaner client code

## How does it work?

Creates copies of data impacted by errors, using
[getters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get)
to throw when error positions are accessed.

Highly efficient: only response sections impacted by errors are copied; with no
errors the underlying data is returned verbatim.

## Motivation

There's growing consensus amongst the GraphQL Working Group that the future of
GraphQL has errors handled on the client side, with server-side error
propagation disabled. This fixes a number of issues, among them the
proliferation of null types (and the associated nullability checks peppering
client code), and inability to safely write data to normalized caches if that
data came from a request containing errors.

Over time, we hope all major GraphQL clients will integrate error handling deep
into their architecture so that users don't need to think about it. In the mean
time, this project can add support for this future behavior to almost any
GraphQL client by re-introducing thrown errors into your data.

**Handle errors the way your programming language or framework is designed to —
no need for GraphQL-specific logic.**

Read more here on the motivation behind this here:
https://benjie.dev/graphql/nullability/

## Deeper example

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

## TODO

- [ ] Add support for incremental delivery

## History

Version 0.1.0 of this module was released from the San Francisco Centre the day
after GraphQLConf 2024, following many fruitful discussions around nullability.

Version 1.0.0 of this module was released just before GraphQLConf 2025, as the
result of what we call Conference-Driven Development.
