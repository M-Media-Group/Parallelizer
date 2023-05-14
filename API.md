# API

Call multiple APIs in parallel, transform and unify the results, and return them in a single response!

## Example request
A `POST` request to `/api/v1/fetch` with the following JSON body:
```json
{
    "endpoints": [
        {
            "url": "https://api.chucknorris.io/jokes/random",
            "successKey": "value",
            "transform": [
                {
                    "key": "type",
                    "value": "joke"
                },
                {
                    "key": "text",
                    "valueKey": "value"
                }
            ]
        },
        {
            "url": "https://uselessfacts.jsph.pl/random.json?language=en",
            "successKey": "text",
            "transform": [
                {
                    "key": "type",
                    "value": "fact"
                },
                {
                    "key": "text",
                    "valueKey": "text"
                }
            ]
        }
    ]
}
```

Yields the response (`200 OK`):
```json
[
    {
        "type": "joke",
        "text": "Chuck Norris doesn't read books. He stares them down until he gets the information he wants."
    },
    {
        "type": "fact",
        "text": "The shortest war in history was between Zanzibar and Great Britain. Zanzibar surrendered after 38 minutes."
    }
]

```

## Usage

### `POST /api/v1/fetch`

This endpoint is used to retrieve data from multiple endpoints by sending a POST request with a JSON body containing a list of endpoint objects.

#### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `detailedResponse` | boolean | No | A boolean representing whether or not the full response should be returned. If `true`, the transformed data will be in a `data` key, while information about the request (attempts, errors, and timings) will be in the `request` key. |
| `endpoints` | array | Yes | An array of objects representing the endpoints to retrieve data from. |
| `successKey` | string | Yes | The key in the response body that indicates a successful response. |
| `headers` | object | No | An object of additional headers to pass in the request. |
| `method` | string | No | The HTTP method to use for the request. Defaults to `GET`. |
| `body` | object | No | The body to send with the request. |
| `maxExecutionTime` | number | No | The maximum time any single request should take or fail in miliseconds. |
| `maxRetries` | number | No | The amount of times a request should be retried until it is considered as failed. |
| `delay` | number | No | The time in miliseconds to wait between retries. |
| `transform` | array | No | An array of objects representing the transformations to apply to the response data. |

Each object in `endpoints` should contain the following fields (fields here override the global fields defined in the request body):

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string | Yes | The endpoint URL. |
| `successKey` | string | Yes (if not defined globally) | The key in the response body that indicates a successful response. |
| `headers` | object | No | An object of additional headers to pass in the request. |
| `method` | string | No | The HTTP method to use for the request. Defaults to `GET`. |
| `body` | object | No | The body to send with the request. |
| `maxExecutionTime` | number | No | The maximum time any single request should take or fail in miliseconds. |
| `maxRetries` | number | No | The amount of times a request should be retried until it is considered as failed. |
| `delay` | number | No | The time in miliseconds to wait between retries. |
| `transform` | array | No | An array of objects representing the transformations to apply to the response data. |

Each object in `transform` should contain the following fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `key` | string | Yes | The key to modify in the response data. |
| `value` or `valueKey` | string | Yes | The new value to set for the key in the response data. Use `valueKey` if the value should be taken directly from the response body, or `value` if the value should be a constant string. |

- key: A string representing the key to modify in the response data.
- value or valueKey: The new value to set for the key in the response data. Use value if the value should not be transformed (what you put in is what you get back), or use valueKey if the value should be transformed (what you put in value is a key from the API response).

Note: if the transformation fails, it will fail silently and simply not transform the endpoint's data, instead, it will return the original response data.

The response will be a JSON object containing an array of objects, one for each endpoint specified in the request body. Each object will contain the following fields:

type: A string representing the type of data returned by the endpoint ("joke" or "fact").
text: A string representing the text data returned by the endpoint.

