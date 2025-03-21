interface GraphQLError {
  message: string;
  path: ReadonlyArray<string | number> | undefined;
}
interface GraphQLErrorWithPath extends GraphQLError {
  path: ReadonlyArray<string | number>;
}

export function toe<TData extends Record<string, any>>(result: {
  data?: TData | null | undefined;
  errors?: readonly GraphQLError[] | undefined;
}): TData {
  const { data, errors } = result;
  if (!data) {
    if (!errors) {
      throw new Error(
        "Invalid call to graphql-toe; neither data nor errors were present",
      );
    } else {
      throw typeof AggregateError === "undefined"
        ? errors[0]
        : new AggregateError(errors, errors[0].message);
    }
  }
  if (!errors || errors.length === 0) {
    return data;
  }
  return toeObj(data, 0, errors as readonly GraphQLErrorWithPath[]);
}

function toeObj<TData extends Record<string, any>>(
  data: TData,
  depth: number,
  errors: readonly GraphQLErrorWithPath[],
): TData {
  // TODO: would it be faster to rule out duplicates via a set?
  const keys = errors.map((e) => e.path[depth]) as string[];
  const obj = Object.create(null);
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (keys.includes(key)) {
      if (value == null) {
        const error = errors.find((e) => e.path[depth] === key);
        // This is where the error is!
        // obj[key] = value;
        Object.defineProperty(obj, key, {
          enumerable: true,
          get() {
            throw error;
          },
        });
      } else {
        // Guaranteed to have at least one entry
        const filteredErrors = errors.filter((e) => e.path[depth] === key);
        // Recurse
        obj[key] = Array.isArray(value)
          ? (toeArr(value, depth + 1, filteredErrors) as any)
          : toeObj(value, depth + 1, filteredErrors);
      }
    } else {
      obj[key] = value;
    }
  }
  return obj as TData;
}

function toeArr<TData>(
  data: readonly TData[],
  depth: number,
  errors: readonly GraphQLErrorWithPath[],
): readonly TData[] {
  // TODO: would it be faster to rule out duplicates via a set?
  const keys = errors.map((e) => e.path[depth]) as number[];
  const arr = new Array<TData>(data.length);
  for (let index = 0, l = data.length; index < l; index++) {
    const value = data[index];
    if (keys.includes(index)) {
      if (value == null) {
        const error = errors.find((e) => e.path[depth] === index);
        // This is where the error is!
        // arr[index] = value;
        Object.defineProperty(arr, index, {
          enumerable: true,
          get() {
            throw error;
          },
        });
      } else {
        // Guaranteed to have at least one entry
        const filteredErrors = errors.filter((e) => e.path[depth] === index);
        // Recurse
        arr[index] = Array.isArray(value)
          ? toeArr(value, depth + 1, filteredErrors)
          : toeObj(value as any, depth + 1, filteredErrors);
      }
    } else {
      arr[index] = value;
    }
  }
  return arr;
}
