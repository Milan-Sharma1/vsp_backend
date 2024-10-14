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
  updateUsercoverImage,
  getUserChannelProfile,
  getWatchHistory,
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
userRouter.route("/getCurrentUser").get(verifyJWT, getCurrentUser);
//use patch when updating data so that whole data is not overwritten
userRouter.route("/updateUserInfo").patch(verifyJWT, updateUserInfo);
userRouter
  .route("/updateUserAvatar")
  .patch(verifyJWT, uploadToMulter.single("avatar"), updateUserAvatar);
userRouter
  .route("/updateUserCoverImage")
  .patch(verifyJWT, uploadToMulter.single("coverImage"), updateUsercoverImage);
//taking username from params
userRouter.route("/c/:username").get(verifyJWT, getUserChannelProfile);
userRouter.route("/history").get(verifyJWT, getWatchHistory);


export default userRouter;
