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
      throw errors[0];
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
  errors: readonly GraphQLErrorWithPath[],
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
