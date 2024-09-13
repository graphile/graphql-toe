// @ts-check

import { test } from "node:test";
import * as assert from "node:assert";
import { toe } from "../dist/index.js";
import { graphql, buildSchema } from "graphql";

const schema = buildSchema(/* GraphQL */ `
  type Query {
    mol: Int
    mole: Int
    deep: Deep
  }
  type Deep {
    withList: [ListItem]
  }
  type ListItem {
    int: Int
  }
`);

const rootValue = {
  mol() {
    return 42;
  },
  mole() {
    throw new Error("Fourty two!");
  },
  deep: {
    withList: [
      { int: 1 },
      {
        int() {
          throw new Error("Two!");
        },
      },
      { int: 3 },
    ],
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

test("simple query", async () => {
  const data = await genResult(`{mol}`);
  assert.deepEqual(data, {
    mol: 42,
  });
});

test("simple error", async () => {
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

test("deep error", async () => {
  const data =
    /** @type {{deep: {withList: Array<{int: number}>}}} */
    (await genResult(`{deep{withList{int}}}`));
  assert.deepEqual(data.deep.withList[0], { int: 1 });
  assert.deepEqual(data.deep.withList[2], { int: 3 });
  assert.ok(data.deep.withList[1]);
  assert.ok(typeof data.deep.withList[1], "object");
  let err;
  try {
    console.log(data.deep.withList[1].int);
  } catch (e) {
    err = e;
  }
  assert.ok(err);
  assert.deepEqual(err.path, ["deep", "withList", 1, "int"]);
  assert.deepEqual(err.message, "Two!");
});
