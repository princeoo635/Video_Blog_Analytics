import mongoose from "mongoose";
import { ApiError } from "../ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Playlist } from "../models/playlist.model.js";

const createPlaylist = asyncHandler(async(req,res)=>{
    const { name, description } =req.body
    if(!(name && description)){
        throw new ApiError(400,"Both name and description is required.")
    }
    const playlist = await Playlist.create(
        {
            name,
            description,
            owner:req.user
        }
    )
    const createdPlaylist = await Playlist.findById(playlist._id)
    if(!createdPlaylist){
        throw new ApiError(401,"Playlist was not created.")
    }
    return res.status(200)
    .json(
        new ApiResponse(200,createdPlaylist,"Playlist successfully created.")
    )
})

const getUserPlaylist = asyncHandler(async(req,res)=>{
    const { userId } = req.params
    if(!userId){
        throw new ApiError(400,"Invalid User id.")
    }
    const playlist = await Playlist.find({owner:userId});
    if(!playlist){
        throw new ApiError(400,"User didn't create any playlist.")
    }
    return res.status(200)
    .json(
        new ApiResponse(200,playlist,"Playlist fetched successfully.")
    )
})

const getPlaylistById = asyncHandler(async(req,res)=>{
    const { playlistId } = req.params
    if(!playlistId){
        throw new ApiError(404,"Invalid playlist Id.")
    }
    const playlist = await Playlist.findById(playlistId)
    if(!playlist){
        throw new ApiError(404,"No such playlist exists ")
    }
    return res.status(200)
    .json(
        new ApiResponse(200,playlist,"playlist fetched successfully.")
    )
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if(!(playlistId && videoId)){
        throw new ApiError(400,"Playlist or video id is missing.")
    }
    const playlist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $push:{
            videos:videoId
            }
        },
        {
            new:true
        }
    )
    return res.status(200)
    .json(
        new ApiResponse(200,playlist,"video added to playlist.")
    )
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if(!playlistId){
        throw new ApiError(400,"Playlist Id is not defined.")
    }
    const playlist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
          $pull: { videos: videoId }  // Removes all instances of videoId
        },
        { new: true }
      );
      if(!playlist){
        throw new ApiError(404,"Playlist not found.")
      }
      return res.status(200)
      .json(
        new ApiResponse(200,playlist,"video removed successfully.")
      )
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    if(!playlistId){
        throw new ApiError(404,"PlaylisId not found.")
    }
    await Playlist.deleteOne({playlistId})
    return res.status(200)
    .json(
        new ApiResponse(200,[],"Playlist deleted successfully.")
    )
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    if(!playlistId){
        throw new ApiError(404,"PlaylisId not found.")
    }
    const playlist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set:{name:name,description:description}
        },{new:true}
    ) 
    return res.status(200)
    .json(
        new ApiResponse(200,playlist,"Playlist updated.")
    )
})

export {
    createPlaylist,
    getUserPlaylist,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}
