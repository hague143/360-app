export async function api<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "X-CarView-Request": "1",
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}
export const send = (url: string, body: unknown, method = "POST") =>
  api(url, { method, body: JSON.stringify(body) });
export const photoUrl = (id: string, kind = "thumbnail") =>
  `/media/photos/${id}/${kind}`;
export const money = (n: number) => new Intl.NumberFormat("en-PK").format(n);
export function upload(
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
        const data = JSON.parse(xhr.responseText);
        xhr.status < 300 ? resolve(data) : reject(new Error(data.error));
      } catch {
        reject(new Error("Upload failed. Please try again."));
      }
    };
    xhr.onerror = () => reject(new Error("Connection lost. Please retry."));
    xhr.send(form);
  });
}
