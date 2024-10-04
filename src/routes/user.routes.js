import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
} from "../controllers/user.controller.js";
import { uploadToMulter } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/checkauth.middleware.js";

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

userRouter.route("/login").post(loginUser);

//secured routes
userRouter.route("/logout").post(verifyJWT, logoutUser);


export default userRouter;
