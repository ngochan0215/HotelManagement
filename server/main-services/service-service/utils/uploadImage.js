import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../../../shared/config/cloudinary.js";

const serviceCategoryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "service_categories",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const serviceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "services",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

export const uploadServiceCategoryImages = multer({
  storage: serviceCategoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadServiceImages = multer({
  storage: serviceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});
