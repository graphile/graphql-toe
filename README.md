# GraphQL TOE (Throw On Error)

> Like bumping your toe on something... I usually throw things!  
> -- Pascal Senn, ChilliCream

**GraphQL gives you `null`... Was that a real `null`, or an error?**

TOE makes GraphQL errors into real JavaScript errors, so you can stop writing
code that second-guesses your data!

Works seamlessly with `try`/`catch`, or your framework's error handling such as
`<ErrorBoundary />` in React or SolidJS. And, with semantic nullability, reduce
the need for null checks in your client code!

## Example

```ts
import { toe } from "graphql-toe";

// Imagine the second user threw an error in your GraphQL request:
const result = await request("/graphql", "{ users(first: 2) { id } }");

// Take the GraphQL response map and convert it into a TOE object:
const data = toe(result);

data.users[0]; // { id: 1 }
data.users[1]; // Throws "Loading user 2 failed!"
```

## How?

Returns a copy of your GraphQL result data that uses
[getters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get)
to throw an error when you read from an errored GraphQL field. And it's
efficient: only the parts of the response that are impacted by errors are copied
(if there are no errors, the underlying data is returned directly).

## Why?

GraphQL replaces errored fields with `null`, so you can't trust a `null` to mean
"nothing"; you must always check to see if a `null` actually represents an error
from the "errors" list.

`toe()` fixes this. It reintroduces errors into your data using getters that
throw when accessed.

That means:

- `try`/`catch` just works
- `<ErrorBoundary />` components can catch data-layer errors
- Your GraphQL types’ [_semantic_ nullability](#semantic-nullability) matters
  again

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

## Framework examples

How to get `result` and feed it to `toe(result)` will depend on the client
you're using. Here are some examples:

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

Note: apply similar changes to mutations and subscriptions.

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
and [@catch](https://relay.dev/docs/guides/catch-directive/) directives.

## Zero dependencies

**Just 468 bytes** gzipped
([v0.1.1 on bundlephobia](https://bundlephobia.com/package/graphql-toe@0.1.1))

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

## Semantic nullability

The
[@semanticNonNull](https://specs.apollo.dev/nullability/v0.4/#@semanticNonNull)
directive lets schema designers mark fields where `null` is **never a valid
value**; so if you see `null`, it means an error occurred.

Normally this intent is lost and clients still need to check for `null`, but
with `toe()` you can treat these fields as non-nullable: a `null` here will
throw.

In TypeScript, use
[semanticToStrict from graphql-sock](https://github.com/graphile/graphql-sock?tab=readme-ov-file#semantic-to-strict)
to rewrite semantic-non-null to traditional non-null for type generation.

Together, this combination gives you:

- More accurate codegen types
- Improved DX with fewer null checks
- Safer, cleaner client code

## Motivation

On the server side, GraphQL captures errors, replaces them in the returned
`data` with a `null`, and adds them to the `errors` array. Clients typically
then have to look at `data` and `errors` in combination to determine if a `null`
is a "true null" (just a `null` value) or an "error null" (a `null` with a
matching error in the `errors` list). This is unwieldy.

I see the future of GraphQL as errors being handled on the client side, and
error propagation being disabled on the server. Over time, I hope all major
GraphQL clients will integrate error handling deep into their architecture, but
in the mean time this project can add support for this future behavior to almost
any GraphQL client by re-introducing thrown errors into your data. Handle errors
the way your programming language or framework is designed to — no need for
GraphQL-specific logic.

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
