import express from 'express';
import { getLogger } from '@/utils/loggers';
import ParallelApiCalls from 'parallel-api-calls/src/scripts/collateApiCalls';
import ApiEndpoint, { ApiEndpointConstructorParams } from 'parallel-api-calls/src/scripts/ApiEndpoint';
import { applyAnyTransformation } from 'parallel-api-calls/src/utils/transformer';
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
  const totalNumberOfEndpointsInGroups = endpointGroups?.reduce((acc, curr) => acc + curr.endpoints.length, 0) ?? 0;
  const totalNumberOfEndpoints = (incomingEndpoints?.length ?? 0) + totalNumberOfEndpointsInGroups;

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
