import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  regenerateAccessToken,
  changeCurentUserPassword,
  getCurrentUser,
  updateUserInfo,
  updateUserAvatar,
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

userRouter.route("/refreshToken").post(regenerateAccessToken);
userRouter.route("/changePassword").post(verifyJWT, changeCurentUserPassword);
userRouter.route("/getCurrentUser").post(verifyJWT, getCurrentUser);
userRouter.route("/updateUserInfo").post(verifyJWT, updateUserInfo);
userRouter
  .route("/updateUserAvatar")
  .post(verifyJWT, uploadToMulter.single("avatar"), updateUserAvatar);


export default userRouter;
