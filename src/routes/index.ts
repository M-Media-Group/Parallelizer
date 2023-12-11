import express from 'express';
import { getLogger } from '@/utils/loggers';
import { marked } from 'marked';
import fs from 'fs';
const router = express.Router();
const logger = getLogger('INDEX_ROUTE');

/* GET home page. */
router.get('/', function (_req, res, _next) {
  logger.info('Loading docs');
  const path = __dirname + '/../../API.md';
  const file = fs.readFileSync(path, 'utf8');
  // Render the markdown file ../../API.md
  // res.send(marked(file.toString()));
  res.render('index', { title: "Parallelizer", docs: marked(file.toString()) });
});

export default router;
