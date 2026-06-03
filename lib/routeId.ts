export function resolveRouteId(
  prefix: string,
  paramId: string | undefined,
  pathname: string | null,
  queryId?: string | null
) {
  if (paramId && paramId !== "__placeholder__") return paramId;
  if (queryId) return queryId;

  if (typeof window !== "undefined") {
    const queryId = new URLSearchParams(window.location.search).get("id");
    if (queryId) return queryId;
  }

  const path = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const [, firstSegment, secondSegment] = path.split("/");
  if (firstSegment !== prefix || !secondSegment) return "";

  return decodeURIComponent(secondSegment);
}

export function productPath(id: string) {
  return `/p?id=${encodeURIComponent(id)}`;
}

export function editProductPath(id: string) {
  return `/edit?id=${encodeURIComponent(id)}`;
}

export function categoryPath(id: string) {
  return `/category?id=${encodeURIComponent(id)}`;
}
