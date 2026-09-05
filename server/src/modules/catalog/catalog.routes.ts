import type { Request } from 'express';
import { Router } from 'express';
import { stringParam } from '../../common/request.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import type { AuditContext } from '../audit/audit.service.js';
import {
  catalogIdParamsSchema,
  commissionListQuerySchema,
  createCommissionRuleSchema,
  createLenderSchema,
  createProductSchema,
  lenderListQuerySchema,
  productLenderMappingsSchema,
  productListQuerySchema,
  updateLenderSchema,
  updateProductSchema,
} from './catalog.schemas.js';
import {
  createCommissionRule,
  createLender,
  createProduct,
  deactivateLender,
  deactivateProduct,
  getLender,
  getProduct,
  listCommissionRules,
  listLenders,
  listProducts,
  replaceProductLenders,
  updateLender,
  updateProduct,
} from './catalog.service.js';

const auditContext = (req: Request): AuditContext => ({
  requestId: String(req.id),
  ipAddress: req.ip,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});

export const lenderRouter = Router();
lenderRouter.use(authenticate);

lenderRouter.get('/', requirePermission('lenders:read'), validate({ query: lenderListQuerySchema }), async (req, res) => {
  const result = await listLenders(lenderListQuerySchema.parse(req.query));
  res.json({ data: result.items, pagination: result.pagination });
});

lenderRouter.post('/', requireRole('admin'), requirePermission('lenders:manage'), validate({ body: createLenderSchema }), async (req, res) => {
  const result = await createLender(createLenderSchema.parse(req.body), req.user!, auditContext(req));
  res.status(201).json({ data: result });
});

lenderRouter.get('/:id', requirePermission('lenders:read'), validate({ params: catalogIdParamsSchema }), async (req, res) => {
  res.json({ data: await getLender(stringParam(req, 'id')) });
});

lenderRouter.patch(
  '/:id',
  requireRole('admin'),
  requirePermission('lenders:manage'),
  validate({ params: catalogIdParamsSchema, body: updateLenderSchema }),
  async (req, res) => {
    const result = await updateLender(stringParam(req, 'id'), updateLenderSchema.parse(req.body), req.user!, auditContext(req));
    res.json({ data: result });
  },
);

lenderRouter.delete('/:id', requireRole('admin'), requirePermission('lenders:manage'), validate({ params: catalogIdParamsSchema }), async (req, res) => {
  await deactivateLender(stringParam(req, 'id'), req.user!, auditContext(req));
  res.status(204).send();
});

export const productRouter = Router();
productRouter.use(authenticate);

productRouter.get('/', requirePermission('products:read'), validate({ query: productListQuerySchema }), async (req, res) => {
  const result = await listProducts(productListQuerySchema.parse(req.query));
  res.json({ data: result.items, pagination: result.pagination });
});

productRouter.post('/', requireRole('admin'), requirePermission('products:manage'), validate({ body: createProductSchema }), async (req, res) => {
  const result = await createProduct(createProductSchema.parse(req.body), req.user!, auditContext(req));
  res.status(201).json({ data: result });
});

productRouter.get('/:id', requirePermission('products:read'), validate({ params: catalogIdParamsSchema }), async (req, res) => {
  res.json({ data: await getProduct(stringParam(req, 'id')) });
});

productRouter.patch(
  '/:id',
  requireRole('admin'),
  requirePermission('products:manage'),
  validate({ params: catalogIdParamsSchema, body: updateProductSchema }),
  async (req, res) => {
    const result = await updateProduct(stringParam(req, 'id'), updateProductSchema.parse(req.body), req.user!, auditContext(req));
    res.json({ data: result });
  },
);

productRouter.delete('/:id', requireRole('admin'), requirePermission('products:manage'), validate({ params: catalogIdParamsSchema }), async (req, res) => {
  await deactivateProduct(stringParam(req, 'id'), req.user!, auditContext(req));
  res.status(204).send();
});

productRouter.put(
  '/:id/lenders',
  requireRole('admin'),
  requirePermission('products:manage'),
  validate({ params: catalogIdParamsSchema, body: productLenderMappingsSchema }),
  async (req, res) => {
    const result = await replaceProductLenders(
      stringParam(req, 'id'),
      productLenderMappingsSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result });
  },
);

productRouter.get(
  '/:id/commission-rules',
  requireRole('admin'),
  requirePermission('products:manage'),
  validate({ params: catalogIdParamsSchema, query: commissionListQuerySchema }),
  async (req, res) => {
    const result = await listCommissionRules(stringParam(req, 'id'), commissionListQuerySchema.parse(req.query));
    res.json({ data: result.items, pagination: result.pagination });
  },
);

productRouter.post(
  '/:id/commission-rules',
  requireRole('admin'),
  requirePermission('products:manage'),
  validate({ params: catalogIdParamsSchema, body: createCommissionRuleSchema }),
  async (req, res) => {
    const result = await createCommissionRule(
      stringParam(req, 'id'),
      createCommissionRuleSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: result });
  },
);
