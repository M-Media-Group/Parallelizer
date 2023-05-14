import express from 'express';
import { getLogger } from '@/utils/loggers';
import ParallelApiCalls from '@/scripts/collateApiCalls';
import ApiEndpoint from '@/scripts/ApiEndpoint';
import dotNotationParser from '@/utils/dotNotationParser';
const router = express.Router();
const logger = getLogger('USER_ROUTE');

/* POST users listing. */
router.post('/fetch', async (req, res, _next) => {
  logger.info('respond with a resource');
  console.time('parallel');

  const incomingData = req.body.endpoints;
  const globalSuccessKey = req.body.successKey;
  const globalTransform = req.body.transform;
  const globalHeaders = req.body.headers;
  const globalMethod = req.body.method;
  const globalBody = req.body.body;
  const globalMaxExecutionTime = Number(req.body.maxExecutionTime);
  const globalMaxRetries = Number(req.body.maxRetries);
  const globalDelay = Number(req.body.delay);

  // Validate incoming data
  if (!Array.isArray(incomingData)) {
    res.status(422).send({ error: 'Invalid data' });
    return;
  }

  if (incomingData.length > 100) {
    res.status(422).send({ error: 'Too many endpoints' });
    return;
  }

  if (incomingData.length === 0) {
    res.status(422).send({ error: 'No endpoints' });
    return;
  }

  const applyTransformations = (transformations: any, incomingData: any) => transformations.map((transform: any) => {
    return { [transform.key]: transform.value ?? dotNotationParser(incomingData, transform.valueKey) };
  })
    .reduce((acc: any, curr: any) => ({ ...acc, ...curr }), {})

  const applyAnyTransformation = (hotel: any) => {
    if (hotel.transform || globalTransform) {
      // Data here will come from the API response when the ApiEndpoint calls. This here is the callback function.
      return (data: any) => applyTransformations(hotel.transform ?? globalTransform, data);
    }
    return undefined;
  }

  const apiEndpoints = incomingData.map(
    (hotel: any) => (new ApiEndpoint(
      hotel.url,
      hotel.successKey ?? globalSuccessKey,
      applyAnyTransformation(hotel),
      hotel.headers ?? globalHeaders,
      undefined,
      hotel.method ?? globalMethod,
      hotel.body ?? globalBody,
      hotel.maxExecutionTime ?? globalMaxExecutionTime,
      hotel.maxRetries ?? globalMaxRetries,
      hotel.delay ?? globalDelay,
    ))
  );

  const pac = new ParallelApiCalls(
    apiEndpoints.slice(0, 250)
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
