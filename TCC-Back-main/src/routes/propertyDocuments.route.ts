import express from "express";
import { UploadPropertyDocuments } from "../controllers/PropertyDocuments/upload.PropertyDocuments.controller";
import { getPropertyDocuments } from "../controllers/PropertyDocuments/get.PropertyDocuments.controller";
import { getPropertyDocumentsById } from "../controllers/PropertyDocuments/getById.PropertyDocuments.controller";
import { deletePropertyDocuments } from "../controllers/PropertyDocuments/delete.PropertyDocuments.controller";
import { deletePropertyDocumentsById } from "../controllers/PropertyDocuments/deleteById.PropertyDocuments.controller";
export const propertyDocuments = express.Router();

propertyDocuments.post("/upload", UploadPropertyDocuments);
propertyDocuments.get("/", getPropertyDocuments);
propertyDocuments.get("/:id", getPropertyDocumentsById);
propertyDocuments.delete("/", deletePropertyDocuments);
propertyDocuments.delete("/:id", deletePropertyDocumentsById)