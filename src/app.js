import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(
  express.json({
    //json data accepting
    limit: "16kb",
  }),
);

app.use(
  express.urlencoded({
    //url accepting
    extended: true,
    limit: "16kb",
  }),
);

app.use(express.static("public"));

app.use(cookieParser());

//router 
import userRouter from "./routes/user.routes.js";

app.use("/api/v1/user", userRouter);

export {app};
