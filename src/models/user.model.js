import mongoose,{Schema} from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
const userSchema = new Schema({
    name : {
        type : String,
        required : true,
        unique : true,
        lowercase : true,
        trim : true,//removes white space from both end 
        index : true
    },
    email : {
        type : String,
        required : true,
        unique : true,
        lowercase : true,
        trim : true,//removes white space from both end 
    },
    fullname : {
        type : String,
        required : true,
        trim : true,
        index : true
    },
    avatar : {
        type : String,//cloudinary url
        required : true
    },
    coverImage : {
        type : String,
    },
    watchHistory : [
        {
        type : Schema.Types.ObjectId,
        ref : "Video"
        }
    ],
    password : {
        type: String,
        required : [true,'Password is required']
    },
    refreshTokens : {
        type : String,
    }
},{timestamps : true})

//hook for middleware like before saving data do password hashing
userSchema.pre("save", async function (next) {
    if(this.isModified("password")){//using in built modified function
        this.password = await bcrypt.hash(this.password, 10)
    }
    next()
})

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

export const User = mongoose.model("User",userSchema)