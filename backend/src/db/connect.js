import mongoose from "mongoose";
import { db } from "../constant.js";

const connectDB=async ()=>{
    try {
        const connectionInstance=  await mongoose.connect(`${process.env.MONGODB_URL}/${db}`)
        console.log(`MongoDB connected !! DB Host : ${connectionInstance.connection.host}`);
        
    } catch (error) {
        console.error("MongoDB connection Error :", error);
        process.exit(1)
    }
}

export default connectDB;