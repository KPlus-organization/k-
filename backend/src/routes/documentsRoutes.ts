import { Router } from "express";
import * as controller from "../controllers/documentsController";
import { requireAuth } from "../middlewares/requireAuth";

export const templateRoutes = Router();
templateRoutes.use(requireAuth);
templateRoutes.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
templateRoutes.get("/", controller.templates);
templateRoutes.get("/:id", controller.template);
templateRoutes.post("/:id/download", controller.exportTemplate);

export const documentsRoutes = Router();
documentsRoutes.use(requireAuth);
documentsRoutes.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
documentsRoutes.get("/", controller.documents);
documentsRoutes.get("/:id", controller.document);
documentsRoutes.put("/:id", controller.putDocument);
documentsRoutes.delete("/:id", controller.deleteDocument);
documentsRoutes.post("/:id/download", controller.exportDocument);
