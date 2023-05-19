import fetchWithTimeout from "@/utils/fetcher";
import sleep from "@/utils/sleep";
import { IncomingHttpHeaders } from "http";

interface ApiEndpointError {
    type: keyof typeof ApiEndpointErrorType;
    message: string;
}

enum ApiEndpointErrorType {
    fetch,
    retryLimit,
    executionTimeLimit
}

export interface ApiEndpointResponse {
    data: ApiEndpoint["result"];
    request: {
        url: ApiEndpoint["url"];
        attemots: ApiEndpoint["fetchAttempts"];
        executionTime: number;
        transformationTime: number;
        hasFailed: boolean;
        fetchedFromCache: ApiEndpoint["fetchedFromCache"];
        errors: ApiEndpointError[];
    }
}

export interface ApiEndpointConstructorParams {
    url: ApiEndpoint["url"];
    successKey?: ApiEndpoint["successKey"];
    transform?: ApiEndpoint["transform"];
    headers?: ApiEndpoint["headers"];
    callback?: ApiEndpoint["callback"];
    method?: ApiEndpoint["method"];
    body?: ApiEndpoint["body"];
    maxExecutionTime?: ApiEndpoint["maxExecutionTime"];
    maxRetries?: ApiEndpoint["maxRetries"];
    delay?: ApiEndpoint["delay"];
    dataKey?: ApiEndpoint["dataKey"];
}

export default class ApiEndpoint {
    private fetchAttempts = 0;
    private result = null as Record<string, any> | Record<string, any>[] | null;
    private errors = [] as ApiEndpointError[];
    private fetchedFromCache = false;
    private hasBeenTransformed = false;
    private executionStartTime = 0;
    private executionEndTime = 0;
    private transformationStartTime = 0;
    private transformationEndTime = 0;

    private headers = {} as IncomingHttpHeaders;

    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET';
    body = null as null | object;
    successKey = 'isComplete';
    delay = 200;
    maxRetries = 5;
    cacheTime = 60;
    transform = null as null | CallableFunction;
    failCritically = false;
    maxExecutionTime = 8000 as null | number;
    dataKey = null as null | string;
    callback: (tries: number) => Promise<any>;

    constructor({ url, successKey, transform, headers, callback, method, body, maxExecutionTime, maxRetries, delay, dataKey }: ApiEndpointConstructorParams) {
        this.url = url;
        this.successKey = successKey || this.successKey;
        this.transform = transform || this.transform;
        this.headers = headers ? this.setHeaders(headers) : this.headers;
        this.method = method || this.method;
        this.body = body || this.body;
        this.maxExecutionTime = maxExecutionTime || this.maxExecutionTime;
        this.maxRetries = maxRetries || this.maxRetries;
        this.delay = delay || this.delay;
        this.dataKey = dataKey || this.dataKey;

        this.callback = callback || this.defaultCallback;
    }

    /**
     *
     * @note we use arrow notation here to preserve the `this` context when its later called in continouslyCallCallbackUntilItCompletes
     */
    private defaultCallback = async () => {
        return await fetchWithTimeout(this.url, {
            timeout: this.maxExecutionTime,
            headers: this.headers,
            method: this.method,
            body: this.body ? JSON.stringify(this.body) : null,
        })
            .then((response) => {
                if (response instanceof Response) {
                    return response.json();
                }
                return response;
            });
    }

    public setHeaders(headers: ApiEndpoint["headers"]) {
        this.headers = headers;
        // Unset the following headers to prevent errors
        delete this.headers.host;
        delete this.headers['content-length'];
        delete this.headers['accept-encoding'];
        delete this.headers.connection;
        delete this.headers['keep-alive'];
        return this.headers;
    }

    public validate() {
        if (!this.url || typeof this.url !== 'string' || !this.url.startsWith('http')) {
            throw new Error('Invalid URL. URLs must start with http or https and be valid URLs');
        }

        if (!this.callback || typeof this.callback !== 'function') {
            throw new Error('Invalid callback');
        }

        if (this.transform && typeof this.transform !== 'function') {
            throw new Error('Invalid transform');
        }

        if (!this.successKey || typeof this.successKey !== 'string') {
            throw new Error('Invalid successKey');
        }

        if (this.maxExecutionTime && typeof this.maxExecutionTime !== 'number') {
            throw new Error('Invalid maxExecutionTime');
        }

        if (this.maxExecutionTime && this.maxExecutionTime > 60000) {
            throw new Error('maxExecutionTime is too long');
        }

        if (this.delay && typeof this.delay !== 'number') {
            throw new Error('Invalid delay');
        }

        if (this.delay && this.delay > 60000) {
            throw new Error('Delay is too long');
        } else if (this.delay && this.delay < 100) {
            throw new Error('Delay is too short');
        }

        if (this.maxExecutionTime && this.maxExecutionTime < this.delay) {
            throw new Error(`The maxExecutionTime cannot be smaller than the delay time, which is currently set to ${this.delay}ms`);
        }

        if (this.maxRetries && typeof this.maxRetries !== 'number') {
            throw new Error('Invalid maxRetries');
        }

        if (this.maxRetries && this.maxRetries > 10) {
            throw new Error('maxRetries is too high');
        }
    }

    public async call(): Promise<ApiEndpointResponse> {

        this.validate();

        // If the api endpoint object contains a successKey, we need to call the endpoint until it returns isComplete: true in the response
        this.executionStartTime = Date.now();

        this.result = await this.continouslyCallCallbackUntilItCompletes(
            this.callback,
        );

        this.executionEndTime = Date.now();
        return this.getResultResponse();
    }

    private getResultResponse(): ApiEndpointResponse {
        return {
            data: this.result,
            request: this.getRequestData()
        };
    }

    private getRequestData(): ApiEndpointResponse["request"] {
        return {
            url: this.url,
            attemots: this.fetchAttempts,
            executionTime: this.getExecutionTime(),
            transformationTime: this.getTransformationTime(),
            hasFailed: this.hasRequestFailed(),
            errors: this.errors,
            fetchedFromCache: this.fetchedFromCache,
        };
    }

    public getCountOfErrors() {
        return this.errors.length;
    }

    public getExecutionTime() {
        return this.executionEndTime - this.executionStartTime;
    }

    public getTransformationTime() {
        return this.transformationEndTime - this.transformationStartTime;
    }

    public hasRequestFailed() {
        if (this.fetchAttempts === 0) {
            return false;
        }

        if (this.maxRetries <= this.fetchAttempts) {
            return true;
        }

        if (this.maxExecutionTime && this.getExecutionTime() > this.maxExecutionTime) {
            return true;
        }

        return false;
    }

    public async runTransform() {

        if (!this.result || !this.transform || this.hasBeenTransformed) {
            return this.getResultResponse();
        }

        const transformer = this.transform;

        if (!(transformer instanceof Function)) {
            return this.getResultResponse();
        }

        // If the result is an array, we need to transform each item in the array
        if (Array.isArray(this.result)) {
            this.result = await Promise.all(this.result.map(async (item) => {
                return await transformer(item);
            }));
            this.hasBeenTransformed = true;
            return this.getResultResponse();
        }

        this.transformationStartTime = Date.now();
        try {
            this.result = await transformer(this.result);
            this.hasBeenTransformed = true;
        } catch (error) {
            throw new Error(`Error transforming data from ${this.url}: ${error}`);
        } finally {
            this.transformationEndTime = Date.now();
            return this.getResultResponse();
        }

    }

    /**
   * Continuously calls the callback until it returns a response with isComplete: true
   *
   * @param {Function} callback that will be called and awaited until it returns a response with isComplete: true
   * @param {string} successKey
   * @param {number} delay - The delay to wait before calling the API again
   * @param {number} maxRetries - The maximum number of retries before rejecting the promise
   * @returns {Promise<*>}
   */
    private async continouslyCallCallbackUntilItCompletes(callback: (tries: number) => any): Promise<Record<string, any> | Record<string, any>[]> {
        let tries = 0;

        const startTime = Date.now();

        const searchNonStop: any = async () => {
            if (this.maxExecutionTime && Date.now() - startTime > this.maxExecutionTime) {
                this.errors.push({
                    type: "executionTimeLimit",
                    message: `Max execution time reached, waited for ${this.maxExecutionTime}ms for API to return the successKey '${this.successKey}'`
                });
                return;
            }

            this.fetchAttempts++;

            const data = await callback(tries)
                .catch((error: any) => {
                    this.errors.push({
                        type: "fetch",
                        message: error.message
                    });
                    if (this.failCritically) {
                        throw new Error(
                            `Callback error fetching data from ${this.url}: ${error}`
                        );
                    }
                    return { [this.successKey || 0]: false }
                });
            if (data[this.successKey]) {
                if (this.dataKey) {
                    return data[this.dataKey];
                }
                return data;
            }
            if (tries >= this.maxRetries) {
                this.errors.push({
                    type: "retryLimit",
                    message: `Max retries reached, re-tried ${tries} times to get API to return the successKey '${this.successKey}'`
                });
                return;
            }
            tries++;
            await sleep(this.delay);
            return searchNonStop();
        };

        return searchNonStop();
    }
}