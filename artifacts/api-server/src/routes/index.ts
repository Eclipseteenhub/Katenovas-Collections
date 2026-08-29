import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import adminRouter from "./admin";
import checkoutRouter from "./checkout";
import ordersRouter from "./orders";
import chatRouter from "./chat";
import emailLogsRouter from "./emailLogs";
import notificationsRouter from "./notifications";
import inboxRouter from "./inbox";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(adminRouter);
router.use(checkoutRouter);
router.use(ordersRouter);
router.use(chatRouter);
router.use(emailLogsRouter);
router.use(notificationsRouter);
router.use(inboxRouter);

export default router;
