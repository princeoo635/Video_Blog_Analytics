import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const publishVideo = asyncHandler(async(req,res)=>{
    const {title,description, category } = req.body;
    if(!(title && description )){
        throw new ApiError(401,"Title, and description are required.")
    }
    const videoLocalPath=req.files?.videofile[0]?.path;
    const thumbnailLocalPath=req.files?.thumbnail[0]?.path;
    const videofile=await uploadOnCloudinary(videoLocalPath)
    const thumbnail= await uploadOnCloudinary(thumbnailLocalPath)
    
    if(!videofile){
        throw new ApiError(401,"Video file is required.")
    }
    if(!thumbnail){
        throw new ApiError(401,"Thumbnail file is required.")
    }
    const video=await Video.create({
        title,
        description,
        videofile:videofile.url,
        thumbnail:thumbnail.url,
        duration:videofile.duration,
        category,
        owner:req.user
    })
    const publishedVideo = await Video.find(video._id);
    if(!publishedVideo){
        throw new ApiError(400,"Video is not published.")
    }
    return res.status(200)
    .json(
         new ApiResponse(200,publishedVideo,"video published successfully.")
    )
})

const getVideoById = asyncHandler(async(req,res)=>{
    const { videoId }=req.params
    if(!videoId){
        throw new ApiError(400,"video id is not provided.")
    }
    const video=await Video.findById(videoId);
    if(!video){
        throw new ApiError(400,"No video exists with given id.")
    }
    return res.status(200)
    .json(
        new ApiResponse(200,video,"video fetched successfully.")
    )
})

 const updateVideo = asyncHandler(async(req,res)=>{
    const { videoId } = req.params
    if(!videoId){
        throw new ApiError(400,"provide video id.")
    }
    const {title,description}=req.body
    if(!(title && description)){
        throw new ApiError(400,"Title or description are missing.")
    }
    const thumbnailLocalPath=req.file?.path;
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    if(!thumbnail){
        throw new ApiError(400,"Promblem while uploading thumbnail on cloudinary.")
    }
    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $set:{
                title:title,
                description:description,
                thumbnail:thumbnail.url
            }
        },
        {
            new:true
        }
    )
    if(!video){
        throw new ApiError(404,"video not found.")
    } 
    return res.status(200)
    .json(
        new ApiResponse(200,video,"video updated successfully.")
    )
    
})

const deleteVideo = asyncHandler(async(req,res)=>{
    const { videoId } = req.params
    if(!videoId){
        throw new ApiError(400,"video id is missing.")
    }
     await Video.findByIdAndDelete(videoId)
     return res.status(200)
     .json(
        new ApiResponse(200,[],"video deleted successfully.")
     )
})

export {
    publishVideo,
    getVideoById,
    updateVideo,
    deleteVideo
}