import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js"
import { Video } from "../models/video.model.js"
import { ApiError } from "../ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const addComment = asyncHandler(async(req, res)=>{
    const { content } =req.body
    const { videoId } =req.params
    const video = await Video.findById(videoId)
    if(!video){
        throw new ApiError(404,"video not available.")
    }
    if(!content){
        throw new ApiError(400,"No content is given..")
    }
    const comment = await Comment.create({
        content:content,
        owner:req.user._id,
        video:video._id
    })
    if(!comment){
        throw new ApiError(400,"comment is not created.")
    }
    return res.status(200).
    json(
        new ApiResponse(200,comment,"successfully commented on video.")
    )
})

export {
    addComment

}