import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";
import { uploadToMulter } from "../middlewares/multer.middleware.js";

const userRouter = Router();

userRouter.route("/register").post(
  uploadToMulter.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser,
);

export default userRouter;
