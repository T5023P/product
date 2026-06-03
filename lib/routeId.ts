export function resolveRouteId(
  prefix: string,
  paramId: string | undefined,
  pathname: string | null
) {
  if (paramId && paramId !== "__placeholder__") return paramId;

  const path = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const [, firstSegment, secondSegment] = path.split("/");
  if (firstSegment !== prefix || !secondSegment) return "";

  return decodeURIComponent(secondSegment);
}
