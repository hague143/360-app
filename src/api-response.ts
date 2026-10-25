// Hosting routers can return HTML/plain text even for /api requests. Treat that
// as an unavailable service, rather than exposing JSON parser or server output.
export const SERVICE_UNAVAILABLE =
  "The service is temporarily unavailable. Please try again shortly.";

export function parseApiResponse(
  text: string,
  contentType: string | null,
  status: number,
): any {
  if (!contentType?.toLowerCase().includes("application/json")) {
    throw new Error(SERVICE_UNAVAILABLE);
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(SERVICE_UNAVAILABLE);
  }
  if (status < 200 || status >= 300) {
    throw new Error(
      data && typeof data.error === "string" ? data.error : SERVICE_UNAVAILABLE,
    );
  }
  return data;
}
