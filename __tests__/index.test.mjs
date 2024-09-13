// @ts-check

import { test } from "node:test";
import * as assert from "node:assert";
import { toe } from "../dist/index.js";
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLList,
} from "graphql";

const Query = new GraphQLObjectType({
  name: "Query",
  fields: {
    mol: {
      type: GraphQLInt,
      resolve() {
        return 42;
      },
    },
    mole: {
      type: GraphQLInt,
      resolve() {
        throw new Error("Fourty two!");
      },
    },
  },
});
const schema = new GraphQLSchema({
  query: Query,
});

/**
 * Fn
 *
 * @param {string} source
 */
async function genResult(source) {
  return graphql({
    schema,
    source,
  });
}

test(async () => {
  const result = await genResult(`{mol}`);
  assert.deepEqual(result, {
    data: {
      mol: 42,
    },
  });
});
