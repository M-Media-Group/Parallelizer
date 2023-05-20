/* The ParallelApiCalls class allows for running multiple API calls in parallel and transforming their
data. */

import ApiEndpoint, { ApiEndpointResponse } from "./ApiEndpoint";

export default class ParallelApiCalls<T> {
    private apiEndpoints: ApiEndpoint[];
    private results: ApiEndpointResponse[];

    constructor(
        apiEndpoints: ApiEndpoint[]
    ) {
        this.apiEndpoints = apiEndpoints;
        this.results = [];
    }

    private reset() {
        this.results = [];
    }

    /**
     * This function makes multiple API requests, transforms the responses, and returns the transformed
     * data.
     * @returns The `run()` method is returning a Promise that resolves to an array of type `T[]`. The
     * array contains the transformed data obtained from the API endpoints.
     */
    public async run(force = false): Promise<ApiEndpointResponse[]> {
        console.time('parallel-api-calls');

        if (this.results.length > 0 && !force) {
            console.log('Returning cached results.');
            console.timeEnd('parallel-api-calls');
            return this.results;
        }

        this.reset();

        const responses = await this.fetchData();
        this.results = await this.transformData(responses);

        console.timeEnd('parallel-api-calls');

        return this.results;
    }

    public getOnlyResultsData() {
        return this.getResults().map((result) => result.data)
            .filter((result) => !!result).flat();
    }

    /**
     * This is an async function that fetches data from multiple API endpoints and returns an array of
     * successful responses.
     * @param [failCritically=false] - The `failCritically` parameter is a boolean flag that determines
     * whether or not to throw an error if there is an error fetching data from an API endpoint. If
     * `failCritically` is set to `true`, an error will be thrown and the function will stop executing.
     * If `failCrit
     * @returns a Promise that resolves to an array of Response objects.
     */
    private async fetchData(): Promise<ApiEndpoint[]> {
        console.time('fetching-data');
        console.log(`Making ${this.apiEndpoints.length} API calls in parallel.`)

        const responses = await Promise.all(
            this.apiEndpoints.map((endpoint) => endpoint.call())
        );

        let totalErrors = 0;

        // Discard any failed requests.
        const successfulResponses = responses.filter((response) => {
            totalErrors += response.request.errors.length;
            return response.data;
        });

        console.timeEnd('fetching-data');

        console.error(`Total errors: ${totalErrors}`);

        console.log(
            `Successfully fetched data from ${successfulResponses.length} of ${this.apiEndpoints.length} API endpoints.`
        );

        return this.apiEndpoints;
    }

    /**
     * This function transforms data from multiple API responses using a provided transform function
     * for each response.
     * @param {ApiEndpointResponse[]} responses - an array of Response objects, which are the results of making
     * HTTP requests to various API endpoints.
     * @returns The `transformData` function returns a Promise that resolves to an array of transformed
     * data. The type of the array elements is `T`, which is a generic type parameter.
     */
    private async transformData(responses: ApiEndpoint[]): Promise<ApiEndpointResponse[]> {
        console.time('transforming-data');

        const data = await Promise.all(
            responses
                .map(async (response, index) =>
                    await response.runTransform()
                )
        );

        console.timeEnd('transforming-data');

        return data;
    }

    /**
     * The function returns an array of type T.
     * @returns An array of type T, which is the type parameter of the class or method that contains
     * this code.
     */
    public getResults(): ApiEndpointResponse[] {
        return this.results;
    }
}
