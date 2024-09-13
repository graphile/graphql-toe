interface GraphQLError {
  message: string;
  path: ReadonlyArray<string | number>;
}

export function toe<TData extends Record<string, any>>(result: {
  data: TData;
  errors: readonly GraphQLError[];
}): TData {
  if (!result.errors || result.errors.length === 0) {
    return result.data;
  }
  return toeObj(result.data, 0, result.errors);
}

function toeObj<TData extends Record<string, any>>(
  data: TData,
  depth: number,
  errors: readonly GraphQLError[],
): TData {
  // TODO: would it be faster to rule out duplicates via a set?
  const keys = errors.map((e) => e.path[depth]) as string[];
  const obj = Object.create(null);
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (keys.includes(key)) {
      // Guaranteed to have at least one entry
      const filteredErrors = errors.filter((e) => e.path[depth] === key);

      if (value === null) {
        // CONSIDER: error wrap? E.g. so it's `instanceof Error`?
        const error = filteredErrors[0];
        // This is where the error is!
        // obj[key] = value;
        Object.defineProperty(obj, key, {
          enumerable: true,
          get() {
            throw error;
          },
        });
      } else {
        // Recurse
        if (Array.isArray(value)) {
          obj[key] = toeArr(value, depth + 1, filteredErrors) as any;
        } else {
          obj[key] = toeObj(value, depth + 1, filteredErrors);
        }
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
  errors: readonly GraphQLError[],
): readonly TData[] {
  // TODO: would it be faster to rule out duplicates via a set?
  const keys = errors.map((e) => e.path[depth]) as number[];
  const arr = Object.create(null);
  for (let index = 0, l = data.length; index < l; index++) {
    const value = data[index];
    if (keys.includes(index)) {
      // Guaranteed to have at least one entry
      const filteredErrors = errors.filter((e) => e.path[depth] === index);

      if (value === null) {
        // CONSIDER: error wrap? E.g. so it's `instanceof Error`?
        const error = filteredErrors[0];
        // This is where the error is!
        // arr[index] = value;
        Object.defineProperty(arr, index, {
          enumerable: true,
          get() {
            throw error;
          },
        });
      } else {
        // Recurse
        if (Array.isArray(value)) {
          arr[index] = toeArr(value, depth + 1, filteredErrors);
        } else {
          arr[index] = toeObj(value as any, depth + 1, filteredErrors);
        }
      }
    } else {
      arr[index] = value;
    }
  }
  return arr as readonly TData[];
}
