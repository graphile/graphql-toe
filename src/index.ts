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

  // Fast path: no errors.
  // Note: `errors.length === 0` is forbidden by the spec, but we'll handle it
  // for wider compatibility.
  if (!errors || errors.length === 0) {
    if (!data) throw new Error("Invalid arguments");
    return data;
  }

  // Beyond here, at least one error happened

  if (!data) throw new AggregateError(errors, errors[0].message);

  // GraphQL spec guarantees if there's data that the errors will have paths
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
  for (const [key, value] of Object.entries(data)) {
    if (keys.includes(key)) {
      if (value == null) {
        // This is where the error is!
        addErrorProperty(errors, depth, key, obj);
      } else {
        // Guaranteed to have at least one entry
        const filteredErrors = errors.filter((e) => e.path[depth] === key);

        // Recurse
        obj[key] = Array.isArray(value)
          ? (toeArr(value, depth + 1, filteredErrors) as any)
          : toeObj(value, depth + 1, filteredErrors);
      }
    } else {
      // Definitely no errors - use verbatim
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
  const obj = new Array<TData>(data.length);
  for (let key = 0, l = data.length; key < l; key++) {
    const value = data[key];
    if (keys.includes(key)) {
      if (value == null) {
        // This is where the error is!
        addErrorProperty(errors, depth, key, obj);
      } else {
        // Guaranteed to have at least one entry
        const filteredErrors = errors.filter((e) => e.path[depth] === key);

        // Recurse
        obj[key] = Array.isArray(value)
          ? (toeArr(value, depth + 1, filteredErrors) as any)
          : toeObj(value, depth + 1, filteredErrors);
      }
    } else {
      // Definitely no errors - use verbatim
      obj[key] = value;
    }
  }
  return obj;
}

function addErrorProperty(
  errors: readonly GraphQLErrorWithPath[],
  depth: number,
  key: number | string,
  obj: object,
) {
  // Assuming the GraphQL implementation stops execution of siblings when an
  // error occurs, the **last** error that matches a path will be the error
  // that caused error propagation to occur. So search backwards.
  let error: GraphQLErrorWithPath;
  for (let i = errors.length - 1; i >= 0; i--) {
    error = errors[i];
    if (error.path[depth] === key) break;
  }

  Object.defineProperty(obj, key, {
    enumerable: true,
    get() {
      throw error;
    },
  });
}
