import express from "express";
import { UploadPropertyPhoto } from "../controllers/PropertyPhoto/upload.PropertyPhoto.controller";
import { getPropertyPhoto } from "../controllers/PropertyPhoto/get.PropertyPhoto.controller";
import { getPropertyPhotoById } from "../controllers/PropertyPhoto/getById.PropertyPhoto.controller";
import { deletePropertyPhoto } from "../controllers/PropertyPhoto/delete.PropertyPhoto.controller";
import { deletePropertyPhotoById } from "../controllers/PropertyPhoto/deleteById.PropertyPhoto.controller";
export const propertyPhoto = express.Router();

propertyPhoto.post("/upload", UploadPropertyPhoto);
propertyPhoto.get("/", getPropertyPhoto);
propertyPhoto.get("/:id", getPropertyPhotoById);
propertyPhoto.delete("/", deletePropertyPhoto);
propertyPhoto.delete("/:id", deletePropertyPhotoById)