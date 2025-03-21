# GraphQL TOE (Throw On Error)

> Like bumping your toe on something... I usually throw things!  
> -- Pascal Senn, ChilliCream

**Stop manually checking if `null` is an error.** And, with semantic
nullability, reduce the need for null checks in your client code!

TOE makes GraphQL errors behave like real JavaScript errors: it throws when you
read from a field that failed. Works seamlessly with `try`/`catch`, or your
frameworks' error handling such as `<ErrorBoundary />` in React or SolidJS.

Uses
[getters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get)
to rewrite your GraphQL result so when you read from an errored GraphQL field an
error is thrown.

## Example

```ts
import { toe } from "graphql-toe";

// Imagine the second user threw an error in your GraphQL request:
const graphqlResponse = await request("/graphql", "{ users(first: 2) { id } }");

// Take the GraphQL response map and convert it into a TOE object:
const data = toe(graphqlResponse);

data.users[0]; // { id: 1 }
data.users[1]; // Throws "Loading user 2 failed!"
```

## Why?

GraphQL replaces errored fields with `null`, so you can never trust a `null` to
be simply a `null`, you must always check the `"errors"` list to see if it's
actually an error... Not fun!

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

### Apollo Client

```ts
import { useQuery } from "@apollo/client";
import { toe } from "graphql-toe";

function useQueryTOE(document, options) {
  const result = useQuery(document, { ...options, errorPolicy: "all" });
  return toe({ data: result.data, errors: result.error?.graphQLErrors });
}
```

Note: similar changes should be made to mutation and subscription operations.

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

const graphqlResponse = await request(
  "https://api.spacex.land/graphql/",
  document,
);
const data = toe(graphqlResponse);
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
const graphqlResponse = await response.json();
const data = toe(graphqlResponse);
```

### Relay

Don't use this! Use
[@throwOnFieldError](https://relay.dev/docs/guides/throw-on-field-error-directive/)
instead!

## Zero dependencies

**Just 468 bytes** gzipped
([v0.1.1 on bundlephobia](https://bundlephobia.com/package/graphql-toe@0.1.1))

Works with _any_ GraphQL client that returns `{ data, errors }`.

Errors are thrown as-is; you can pre-process them to wrapp in `Error` or
`GraphQLError` if needed:

```ts
import { GraphQLError } from "graphql";
import { toe } from "graphql-toe";

const mappedResponse = {
  ...graphqlResponse,
  errors: graphqlResponse.errors?.map(
    (e) =>
      new GraphQLError(e.message, {
        positions: e.positions,
        path: e.path,
        originalError: e,
        extensions: e.extensions,
      }),
  ),
};
const data = toe(mappedResponse);
```

## Semantic nullability

With the
[@semanticNonNull](https://specs.apollo.dev/nullability/v0.4/#@semanticNonNull)
directive, schema designers can indicate positions that will only be `null` if
an error occurs (i.e. the underlying data is never null in the server's
stores) - we call these positions _semantically_ non-nullable.

With `toe()` these semantically non-nullable positions can be treated as
non-null - you know that you can never read a `null` from them since they're
null only on error, and `toe()` will throw that error if you attempt to read
them.

Use
[semanticToStrict from graphql-sock](https://github.com/graphile/graphql-sock?tab=readme-ov-file#semantic-to-strict)
to replace semantic non-null with strict (traditional) non-null so your type
generator can put non-nullable in more positions, reducing the number of null
checks you need to do in client code.

## Motivation

On the server side, GraphQL captures errors, replaces them in the returned
`data` with a `null`, and adds them to the `errors` object. Clients typically
then have to look at `data` and `errors` in combination to determine if a `null`
is a "true null" (just a `null` value) or an "error null" (a `null` with a
matching error in the `errors` list). This is unwieldy.

I see the future of GraphQL as errors being handled on the client side, and
error propagation being disabled on the server. Over time, I hope all major
GraphQL clients will integrate error handling deep into their architecture, but
in the mean time this project can add support for this future behavior to almost
any GraphQL client by re-introducing thrown errors into your data. Handle errors
the way your programming language or framework is designed to, they don't need
to be GraphQL-specific!

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
