import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const roomCategoryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "room_categories",    
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    // transformation: [{ width: 500, height: 500, crop: "limit" }],
  },
});

const serviceCategoryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "service_categories",    
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    // transformation: [{ width: 500, height: 500, crop: "limit" }],
  },
});

const serviceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "services",    
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    // transformation: [{ width: 500, height: 500, crop: "limit" }],
  },
});

export const uploadRoomImages = multer({
  storage: roomCategoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 3MB
});

export const uploadServiceCategoryImages = multer({
  storage: serviceCategoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 3MB
});

export const uploadServiceImages = multer({
  storage: serviceStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 3MB
});
