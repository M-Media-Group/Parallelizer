import fetchWithTimeout from "@/utils/fetcher";
import sleep from "@/utils/sleep";

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
    data: any;
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

export default class ApiEndpoint {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET';
    body = null as any;
    private fetchAttempts = 0;
    private result = null as any;
    private errors = [] as ApiEndpointError[];
    successKey = 'isComplete';
    delay = 200;
    maxRetries = 5;
    headers = {};
    cacheTime = 60;
    private fetchedFromCache = false;
    transform = null as null | CallableFunction;
    private hasBeenTransformed = false;
    failCritically = false;
    maxExecutionTime = 8000 as null | number;
    private executionStartTime = 0;
    private executionEndTime = 0;
    private transformationStartTime = 0;
    private transformationEndTime = 0;
    callback: (tries: number) => any;

    constructor(
        url: ApiEndpoint["url"],
        successKey?: ApiEndpoint["successKey"],
        transform?: ApiEndpoint["transform"],
        headers?: ApiEndpoint["headers"],
        callback?: ApiEndpoint["callback"],
        method?: ApiEndpoint["method"],
        body?: ApiEndpoint["body"],
    ) {
        this.url = url;
        this.successKey = successKey || this.successKey;
        this.transform = transform || this.transform;
        this.headers = headers || this.headers;
        this.method = method || this.method;
        this.body = body || this.body;

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

    public validate() {
        if (!this.url || typeof this.url !== 'string' || !this.url.startsWith('http')) {
            throw new Error('Invalid URL');
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
        }

        if (this.maxExecutionTime && this.maxExecutionTime < this.delay) {
            throw new Error('Invalid maxExecutionTime');
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

        if (!(this.transform instanceof Function)) {
            return this.getResultResponse();
        }

        this.transformationStartTime = Date.now();
        try {
            this.result = await this.transform(this.result);
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
    private async continouslyCallCallbackUntilItCompletes(callback: (tries: number) => any) {
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