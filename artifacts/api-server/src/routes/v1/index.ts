import { Router, type IRouter } from "express";
import imagesRouter from "./images.js";
import videosRouter from "./videos.js";
import modelsRouter from "./models.js";

const router: IRouter = Router();

router.use(imagesRouter);
router.use(videosRouter);
router.use(modelsRouter);

export default router;
