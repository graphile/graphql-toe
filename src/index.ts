interface GraphQLError {
  message: string;
  path: ReadonlyArray<string | number>;
}

export function toe<TData>(result: {
  data: TData;
  errors: GraphQLError[];
}): TData {
  if (!result.errors) {
    return result.data;
  }
  return result.data;
}
