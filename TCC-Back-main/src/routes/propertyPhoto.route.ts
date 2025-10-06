// Todos direitos autorais reservados pelo QOTA.


import express from "express";
import { protect } from "../middleware/authMiddleware";
import { UploadPropertyPhoto } from "../controllers/PropertyPhoto/upload.PropertyPhoto.controller";
import { getPropertyPhoto } from "../controllers/PropertyPhoto/get.PropertyPhoto.controller";
import { getPropertyPhotoById } from "../controllers/PropertyPhoto/getById.PropertyPhoto.controller";
import { deletePropertyPhoto } from "../controllers/PropertyPhoto/delete.PropertyPhoto.controller";
import { deletePropertyPhotoById } from "../controllers/PropertyPhoto/deleteById.PropertyPhoto.controller";
export const propertyPhoto = express.Router();

propertyPhoto.post("/upload", protect, UploadPropertyPhoto);
propertyPhoto.get("/", protect, getPropertyPhoto);
propertyPhoto.get("/:id", protect, getPropertyPhotoById);
propertyPhoto.delete("/", protect, deletePropertyPhoto);
propertyPhoto.delete("/:id", protect, deletePropertyPhotoById);