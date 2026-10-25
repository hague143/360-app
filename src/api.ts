import { parseApiResponse, SERVICE_UNAVAILABLE } from "./api-response";
export async function api<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + url, {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        "X-CarView-Request": "1",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(SERVICE_UNAVAILABLE);
  }
  return parseApiResponse(
    await response.text(),
    response.headers.get("Content-Type"),
    response.status,
  );
}
export const send = (url: string, body: unknown, method = "POST") =>
  api(url, { method, body: JSON.stringify(body) });
export const photoUrl = (id: string, kind = "thumbnail") =>
  `/media/photos/${id}/${kind}`;
export const money = (n: number) => new Intl.NumberFormat("en-PK").format(n);
function multipartUpload(
  url: string,
  form: FormData,
  onProgress: (n: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api" + url);
    xhr.setRequestHeader("X-CarView-Request", "1");
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        resolve(
          parseApiResponse(
            xhr.responseText,
            xhr.getResponseHeader("Content-Type"),
            xhr.status,
          ),
        );
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => reject(new Error("Connection lost. Please retry."));
    xhr.send(form);
  });
}

// Large originals go directly to private Supabase storage. Only small grant and
// completion JSON requests cross the Vercel Function's request-size boundary.
export async function upload(
  url: string,
  form: FormData,
  onProgress: (n: number) => void,
): Promise<any> {
  const runtime = await api<{ directUploads: boolean }>("/runtime");
  if (!runtime.directUploads) return multipartUpload(url, form, onProgress);
  const photoMatch = url.match(/^\/listings\/([^/]+)\/photos$/);
  const kind = photoMatch ? "photo" : url === "/admin/assets" ? "asset" : null;
  if (!kind)
    throw new Error("Direct upload is not supported for this request.");
  const files = (
    photoMatch ? form.getAll("photos") : [form.get("asset")]
  ).filter((v): v is File => v instanceof File);
  if (!files.length) throw new Error("Choose a file to upload.");
  const fields = Object.fromEntries(
    Array.from(form.entries()).filter(([, v]) => typeof v === "string"),
  );
  let result: any;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ticket = await send("/uploads/prepare", {
      ...fields,
      kind,
      listing_id: photoMatch?.[1],
      size: file.size,
    });
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", ticket.url);
      xhr.setRequestHeader(
        "Content-Type",
        file.type || "application/octet-stream",
      );
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          onProgress(
            Math.round(((i + e.loaded / e.total) / files.length) * 95),
          );
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error("Private storage upload failed. Please retry."));
      xhr.onerror = () =>
        reject(new Error("Storage connection lost. Please retry."));
      xhr.send(file);
    });
    result = await send("/uploads/" + ticket.id + "/complete", {});
    onProgress(Math.round(((i + 1) / files.length) * 100));
  }
  return result;
}
