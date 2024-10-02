import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`,
    );
    console.log(
      `MongoDB connected DBHOST: ${connectionInstance.connection.host}`,
    );
  } catch (error) {
    console.log("MongoDb connection error", error);
    process.exit(1); //node js current process exit function
  }
};

export default connectDB;

//second method can be done in index file
// import express from "express"
// const app = express()

// (async ()=>{
//     try {
//        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//        app.on("error",(error)=>{
//         console.log("Error : ",error)
//        })

//        app.listen(process.env.PORT,()=>{
//         console.log(`App listening on ${process.env.PORT}`)
//        })
//     } catch (error) {
//         console.log("Error : ",error)
//         throw error
//     }
// })()
