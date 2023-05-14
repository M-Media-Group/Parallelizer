/**
   * This is an asynchronous function that waits for a specified amount of time before resolving.
   * @param {number} ms - The parameter "ms" is a number representing the duration of time in
   * milliseconds for which the function will wait before resolving the promise.
   * @returns A Promise is being returned.
   */
export default async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}