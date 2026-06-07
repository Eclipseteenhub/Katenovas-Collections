import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);

export default router;
