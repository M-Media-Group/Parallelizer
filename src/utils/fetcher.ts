/**
  * Make a fetch request or timeout after a set duration.
  *
  * @see https://dmitripavlutin.com/timeout-fetch-request/ thanks for the inspiration!
  * @param url
  * @param options
  * @returns
  */
export default async function fetchWithTimeout(url: string, options = {} as any) {
    const { timeout = 8000 } = options;

    const controller = new AbortController();
    const id = setTimeout(() => timeout ? controller.abort() : undefined, timeout);

    const response = await fetch(url, {
        ...options,
        signal: controller.signal
    });
    clearTimeout(id);

    return response;
}