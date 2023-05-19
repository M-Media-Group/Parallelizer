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
  const globalSuccessKey = req.body.successKey;
  const globalTransform = req.body.transform;

  const globalHeaders = {
    ...req.headers,
    ...req.body.headers,
    accept: 'application/json',
    'content-type': 'application/json',
  };

  const globalMethod = req.body.method;
  const globalBody = req.body.body;
  const globalMaxExecutionTime = Number(req.body.maxExecutionTime);
  const globalMaxRetries = Number(req.body.maxRetries);
  const globalDelay = Number(req.body.delay);
  const globalDataKey = req.body.dataKey;

  // Validate incoming data
  if (!Array.isArray(incomingEndpoints)) {
    res.status(422).send({ error: 'Invalid data' });
    console.timeEnd('parallel');

    return;
  }

  if (incomingEndpoints.length === 0) {
    res.status(422).send({ error: 'No endpoints. You must specify at least one endpoint' });
    console.timeEnd('parallel');

    return;
  }

  if (incomingEndpoints.length > API_ENDPOINTS_LIMIT) {
    res.status(422).send({ error: `Too many endpoints. Limited to ${API_ENDPOINTS_LIMIT} at a time, got ${incomingEndpoints.length}` });
    console.timeEnd('parallel');

    return;
  }

  const applyTransformations = (transformations: any, incomingData: any) => transformations.map((transform: any) => {
    return { [transform.key]: transform.value ?? dotNotationParser(incomingData, transform.valueKey) };
  })
    .reduce((acc: any, curr: any) => ({ ...acc, ...curr }), {})

  const applyAnyTransformation = (endpoint: ApiEndpoint) => {
    if (endpoint.transform || globalTransform) {
      // Data here will come from the API response when the ApiEndpoint calls. This here is the callback function.
      return (data: any) => applyTransformations(endpoint.transform ?? globalTransform, data);
    }
    return undefined;
  }

  const buildApiEndpointFromRequest = (requestEndpoint: any, overrides = {} as ApiEndpointConstructorParams) =>
    new ApiEndpoint(
      {
        ...req.body,
        ...overrides,
        ...requestEndpoint,
        transform: applyAnyTransformation(requestEndpoint),
      }
    );

  const apiEndpoints = incomingEndpoints.map(
    (requestEndpoint: any) => buildApiEndpointFromRequest(requestEndpoint)
  );

  const pac = new ParallelApiCalls(
    apiEndpoints.slice(0, API_ENDPOINTS_LIMIT)
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
