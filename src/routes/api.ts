import express from 'express';
import { getLogger } from '@/utils/loggers';
import ParallelApiCalls from '@/scripts/collateApiCalls';
import ApiEndpoint, { ApiEndpointConstructorParams } from '@/scripts/ApiEndpoint';
import dotNotationParser from '@/utils/dotNotationParser';
const router = express.Router();
const logger = getLogger('USER_ROUTE');

const API_ENDPOINTS_LIMIT = 250;

interface ApiEndpointOptions extends Omit<ApiEndpointConstructorParams, "transform"> {
  /** The transformation object that will be used in the transform method */
  transform?: Record<"key" | "value" | "valueKey", string>[];
}

interface EndpointGroup extends ApiEndpointOptions {
  endpoints: ApiEndpointOptions[];
}

/* POST users listing. */
router.post('/fetch', async (req, res, _next) => {
  logger.info('respond with a resource');
  console.time('parallel');

  const incomingEndpoints = req.body.endpoints as ApiEndpointOptions[] | undefined;
  const endpointGroups = req.body.endpointGroups as EndpointGroup[] | undefined;
  const totalNumberOfEndpoints = endpointGroups?.reduce((acc, curr) => acc + curr.endpoints.length, 0) ?? 0;

  if (totalNumberOfEndpoints === 0) {
    res.status(422).send({ error: 'No endpoints. You must specify at least one endpoint' });
    console.timeEnd('parallel');
    return;
  }

  if (totalNumberOfEndpoints > API_ENDPOINTS_LIMIT) {
    res.status(422).send({ error: `Too many endpoints. Limited to ${API_ENDPOINTS_LIMIT} at a time, got ${totalNumberOfEndpoints}` });
    console.timeEnd('parallel');
    return;
  }

  /**
   *
   * @param transformations
   * @param incomingData This data is the response from the API call. This is the data that will be transformed.
   * @returns
   */
  const applyTransformations = (transformations: ApiEndpointOptions["transform"], incomingData: any) => transformations?.map((transform) => {
    return { [transform.key]: transform.value ?? dotNotationParser(incomingData, transform.valueKey) };
  })
    .reduce((acc, curr) => ({ ...acc, ...curr }), {})

  /**
   *
   * @param transform The transformation object that will be used in the transform method
   * @returns
   */
  const applyAnyTransformation = (transform: ApiEndpointOptions["transform"]) => {
    if (transform || req.body.transform) {
      // Data here will come from the API response when the ApiEndpoint calls. This here is the callback function.
      return (data: any) => applyTransformations(transform ?? req.body.transform, data);
    }
    return undefined;
  }

  const buildApiEndpointFromRequest = (requestEndpoint: ApiEndpointOptions, overrides = {} as ApiEndpointOptions) =>
    new ApiEndpoint(
      {
        ...req.body,
        ...overrides,
        ...requestEndpoint,
        transform: applyAnyTransformation(requestEndpoint.transform ?? overrides.transform),
        headers: {
          ...req.headers,
          ...req.body.headers,
          ...overrides.headers,
          ...requestEndpoint.headers,
          accept: 'application/json',
          'content-type': 'application/json',
        },
      }
    );

  const apiEndpoints = incomingEndpoints?.map(
    (requestEndpoint) => buildApiEndpointFromRequest(requestEndpoint)
  ) ?? [];

  const apiEndpointsFromGroups = endpointGroups?.map(
    (group) => group.endpoints.map(
      (requestEndpoint) => buildApiEndpointFromRequest(requestEndpoint, { ...group })
    )
  ).reduce((acc, curr) => [...acc, ...curr], []) ?? [];

  const apiEndpointsFromGroupsAndEndpoints = [...apiEndpoints, ...apiEndpointsFromGroups];

  const pac = new ParallelApiCalls(
    apiEndpointsFromGroupsAndEndpoints.slice(0, API_ENDPOINTS_LIMIT)
  );

  try {
    await pac.run();
    res.send(req.body.detailedResponse ? pac.getResults() : pac.getOnlyResultsData());
  } catch (error: any) {
    res.send({ error: error.message });
  } finally {
    console.timeEnd('parallel');
  }
});

export default router;
