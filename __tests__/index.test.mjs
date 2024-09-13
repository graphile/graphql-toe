// @ts-check

import { test } from "node:test";
import * as assert from "node:assert";
import { toe } from "../dist/index.js";
import { graphql, buildSchema } from "graphql";

const schema = buildSchema(`
type Query {
mol: Int
mole: Int
}
`);

const rootValue = {
  mol() {
    return 42;
  },
  mole() {
    throw new Error("Fourty two!");
  },
};

/**
 * Fn
 *
 * @param {string} source
 */
async function genResult(source) {
  return toe(
    await graphql({
      schema,
      source,
      rootValue,
    }),
  );
}

test(async () => {
  const data = await genResult(`{mol}`);
  assert.deepEqual(data, {
    mol: 42,
  });
});

test(async () => {
  const data = await genResult(`{mole}`);
  let err;
  try {
    console.log(data.mole);
  } catch (e) {
    err = e;
  }
  assert.ok(err);
  assert.deepEqual(err.path, ["mole"]);
  assert.deepEqual(err.message, "Fourty two!");
});
