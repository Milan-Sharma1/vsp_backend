import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp"); //cb is a call back function
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

export const uploadToMulter = multer({ storage: storage });
