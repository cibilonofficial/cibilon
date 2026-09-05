import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { globalSearchQuerySchema } from './search.schemas.js';
import { globalSearch } from './search.service.js';

export const searchRouter = Router();
searchRouter.use(authenticate);
searchRouter.get('/', validate({ query: globalSearchQuerySchema }), async (req, res) => {
  res.json({ data: await globalSearch(globalSearchQuerySchema.parse(req.query), req.user!) });
});
