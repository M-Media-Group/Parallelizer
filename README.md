# Parallelizer

With Parallelizer, you can effortlessly call multiple APIs in parallel, transform and unify the results, and receive them in a single response.

## 🚀 Parallelizer API Key Features:

✅ Parallel API Calls: Send a single POST request to the /api/v1/fetch endpoint with a JSON body containing a list of endpoints, and Parallelizer will handle the rest. It will make concurrent API calls, retrieve the data, and combine it into a single response.

✅ Transform and Unify: Customize the response data using transformations. Each endpoint can have its own set of transformations defined, allowing you to extract and modify specific data elements from the API responses.

✅ Efficient and Fast: Parallelizer optimizes the retrieval process by making parallel requests, reducing the overall response time and improving your application's performance.

✅ Easy Integration: The API is straightforward to integrate into your projects. Just send a POST request with the desired endpoints and transformations, and you're good to go!

## 🔗 API Documentation:
Refer to [API.md](API.md) for API documentation for more info.

Try in Postman: [![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/22386333-be60f02c-9284-463c-9141-518a78b486d9?action=collection%2Ffork&collection-url=entityId%3D22386333-be60f02c-9284-463c-9141-518a78b486d9%26entityType%3Dcollection%26workspaceId%3D4cb4b3e0-8401-4c9d-af58-4440164a94f7)

## Development:
Use the provided `devcontainer`.

Run `yarn dev` to start the dev server.

Run `yarn build` to build the project.