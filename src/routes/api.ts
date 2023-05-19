import express from 'express';
import { getLogger } from '@/utils/loggers';
import ParallelApiCalls from '@/scripts/collateApiCalls';
import ApiEndpoint, { ApiEndpointConstructorParams } from '@/scripts/ApiEndpoint';
import dotNotationParser from '@/utils/dotNotationParser';
const router = express.Router();
const logger = getLogger('USER_ROUTE');

const API_ENDPOINTS_LIMIT = 500;

/* POST users listing. */
router.post('/fetch', async (req, res, _next) => {
  logger.info('respond with a resource');
  console.time('parallel');

  const incomingEndpoints = req.body.endpoints;
  const endpointGroups = req.body.endpointGroups;
  const totalNumberOfEndpoints = endpointGroups?.reduce((acc: number, curr: any) => acc + curr.endpoints.length, 0);

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

  const applyTransformations = (transformations: any[], incomingData: any) => transformations.map((transform: any) => {
    return { [transform.key]: transform.value ?? dotNotationParser(incomingData, transform.valueKey) };
  })
    .reduce((acc: any, curr: any) => ({ ...acc, ...curr }), {})

  const applyAnyTransformation = (transform: ApiEndpoint["transform"]) => {
    if (transform || req.body.transform) {
      // Data here will come from the API response when the ApiEndpoint calls. This here is the callback function.
      return (data: any) => applyTransformations(transform ?? req.body.transform, data);
    }
    return undefined;
  }

  const buildApiEndpointFromRequest = (requestEndpoint: any, overrides = {} as ApiEndpointConstructorParams) =>
    new ApiEndpoint(
      {
        ...req.body,
        ...overrides,
        ...requestEndpoint,
        transform: applyAnyTransformation(requestEndpoint.transform ?? overrides.transform),
        headers: {
          ...req.headers,
          ...req.body.headers,
          ...requestEndpoint.headers,
          accept: 'application/json',
          'content-type': 'application/json',
        },
      }
    );

  const apiEndpoints = incomingEndpoints?.map(
    (requestEndpoint: any) => buildApiEndpointFromRequest(requestEndpoint)
  ) ?? [];

  const apiEndpointsFromGroups = endpointGroups?.map(
    (group: any) => group.endpoints.map(
      (requestEndpoint: any) => buildApiEndpointFromRequest(requestEndpoint, { ...group, endpoints: undefined })
    )
  ).reduce((acc: any, curr: any) => [...acc, ...curr], []) ?? [];

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
