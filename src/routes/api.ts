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

  const apiEndpoints = incomingData.map(
    (hotel: any) => (new ApiEndpoint(
      hotel.url,
      hotel.successKey ?? globalSuccessKey,
      hotel.transform ? (data: any) => hotel.transform.map((transform: any) => {
        return { [transform.key]: transform.value ?? dotNotationParser(data, transform.valueKey) };
      })
        .reduce((acc: any, curr: any) => ({ ...acc, ...curr }), {}) : globalTransform ? (data: any) => globalTransform.map((transform: any) => {
          return { [transform.key]: transform.value ?? dotNotationParser(data, transform.valueKey) };
        })
          .reduce((acc: any, curr: any) => ({ ...acc, ...curr }), {}) : undefined,
      hotel.headers ?? globalHeaders,
      undefined,
      hotel.method ?? globalMethod,
      hotel.body ?? globalBody,
    ))
  );

  const pac = new ParallelApiCalls(
    apiEndpoints.slice(0, 100)
  );
  try {
    await pac.run();
  } catch (error: any) {
    res.send({ error: error.message });
  }


  res.send(req.body.detailedResponse ? pac.getResults() : pac.getOnlyResultsData());
  console.timeEnd('parallel');
});

export default router;