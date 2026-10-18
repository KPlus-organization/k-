import type { Request, Response } from "express";
import { authUserId } from "../middlewares/requireAuth";
import { bodyObject } from "../lib/validation";
import {
  createDocx,
  getDocument,
  getTemplate,
  listDocuments,
  removeDocument,
  saveDocument,
} from "../services/documents";

export async function templates(_req: Request, res: Response) {
  const template = await getTemplate("code-claim");
  res.json({
    items: [
      {
        id: template.id,
        title: template.title,
        kind: template.kind,
        object: template.object,
        version: template.version,
      },
    ],
  });
}
export async function template(req: Request<{ id: string }>, res: Response) {
  res.json(await getTemplate(req.params.id));
}
function download(res: Response, file: Buffer) {
  res.setHeader("Cache-Control", "no-store");
  res
    .attachment("code-claim.docx")
    .type(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    .send(file);
}
export async function exportTemplate(
  req: Request<{ id: string }>,
  res: Response,
) {
  const body = bodyObject(req.body);
  download(
    res,
    await createDocx(await getTemplate(req.params.id), body.fields),
  );
}
export async function documents(req: Request, res: Response) {
  res.json({ items: await listDocuments(authUserId(req)) });
}
export async function document(req: Request<{ id: string }>, res: Response) {
  res.json(await getDocument(authUserId(req), req.params.id));
}
export async function putDocument(req: Request<{ id: string }>, res: Response) {
  res.json(await saveDocument(authUserId(req), req.params.id, req.body));
}
export async function deleteDocument(
  req: Request<{ id: string }>,
  res: Response,
) {
  await removeDocument(authUserId(req), req.params.id);
  res.status(204).end();
}
export async function exportDocument(
  req: Request<{ id: string }>,
  res: Response,
) {
  const saved = await getDocument(authUserId(req), req.params.id);
  download(res, await createDocx(saved.template, bodyObject(req.body).fields));
}
