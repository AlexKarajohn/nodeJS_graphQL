const User = require('../models/user');
const Post = require('../models/post');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const jwtKey = require('../global_vars').jwtKey;
const path = require('path');
const fs = require('fs');

module.exports ={
    createUser: async function({userInput}, req){
        const errors = [];
        if(!validator.isEmail(userInput.email)){

            errors.push({message: 'Email is invalid'})
        }
        if(validator.isEmpty(userInput.password) || !validator.isLength(userInput.password,{min:5})){

            errors.push({message: 'Password is Invalid'})
        }
        if(validator.isEmpty(userInput.name)){
            errors.push({message: 'Name is invalid'})
        }
        if(errors.length > 0){
            console.log(errors)
            const error = new Error ('Invalid Input');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const email = userInput.email;
        const name = userInput.name;
        const password = userInput.password;
        const existingUser = await User.findOne({email:email})
        if(existingUser){
            const error = new Error('User already exists');
            throw error;
        }
        const hashedPw = await bcrypt.hash(password,12);
        const user = new User({
            email,
            name,
            password: hashedPw
        })
        const createdUser = await user.save();
        return {...createdUser._doc, _id: createdUser._id.toString()}
    },
    login: async function({email,password}) {
        const user = await User.findOne({email:email})
        if(!user){
            const error = new Error ('User 404');
            error.code = 401;
            throw error;
        }
        const isEqual = await bcrypt.compare(password,user.password)
        if(!isEqual){
            const error = new Error ('password is incorrect');
            error.code = 401;
            throw error;
        }
        const token = jwt.sign({
            userId: user._id.toString(),
            email: user.email
        },jwtKey,{expiresIn: '1h'})
        return {
            token,
            userId: user._id.toString()
        }
    },
    createPost: async function({title,content,imageUrl},req){
        const errors = [];
        if(!req.isAuth){
            errors.push({message:'Unauthorized entry'})
        }      
        const user = await User.findById(req.userId)
        if(!user)
            errors.push({message: 'user not found'})
        if(!validator.isLength('title',{min:5})){
            errors.push({message: 'Title needs more characters'})
        }
        if(!validator.isLength('imageUrl',{min:5})){
            errors.push({message: 'Url needs to be a Url'})
        }
        if(!validator.isLength('content',{min:5})){
            errors.push({message: 'Content needs more characters'})
        }
        if(errors.length > 0 ){
            const err = new Error('Invalid inputs')
            err.data = errors;
            console.log(errors)
            err.code = 422;
            throw err;
        }
        const post = new Post({
            title,
            content,
            imageUrl,
            creator: user
        })
        const saveResult = await post.save(); 
        user.posts.push(saveResult._doc._id)
        await user.save();
        return {
            ...saveResult._doc, createdAt : saveResult._doc.createdAt.toISOString(), updatedAt : saveResult._doc.updatedAt.toISOString()
        }
    },
    posts: async function({page},req){
        const errors = [];
         if(!req.isAuth){
            errors.push({message:'Unauthorized entry'})
        }      
        if(!page){
            page = 1
        }
        const perPage = 2;
        const user = await User.findById(req.userId)
        if(!user)
            errors.push({message: 'user not found'})
        if(errors.length > 0 ){
            const err = new Error('Invalid inputs')
            err.data = errors;
            console.log(errors)
            err.code = 422;
            throw err;
        }
        const totalPosts = await Post.find().countDocuments();
        const posts = await Post.find().sort({createdAt:-1}).skip((page - 1) * perPage).limit(perPage).populate('creator', 'name')
        return {
            posts: posts.map(p=>{
                return {
                    ...p._doc,
                    _id: p._id.toString(),
                    createdAt: p.createdAt.toISOString(),
                    updatedAt : p.updatedAt.toISOString()  
                }
            }),
            totalPosts
        }
    },
    post: async function ({id},req){
        const errors = [];
        if(!req.isAuth){
           errors.push({message:'Unauthorized entry'})
        }  
        if(validator.isEmpty(id)){
            errors.push({message:'No post ID provided'})
        }  
        const post = await Post.findById(id).populate('creator','name')
        if(!post){
            const err = new Error ('No post found')
            err.code = 404;
            throw err;
        }  
        if(errors.length > 0 ){
            const err = new Error('Invalid inputs')
            err.data = errors;
            console.log(errors)
            err.code = 422;
            throw err;
        }    
        return{
            ...post._doc,
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString(),
        }
    },
    updatePost: async function({id,postInput},req){
        const errors = [];
        if(!req.isAuth){
           errors.push({message:'Unauthorized entry'})
        }  
        if(validator.isEmpty(id)){
            errors.push({message:'No post ID provided'})
        }  
        if(!validator.isLength(postInput.title,{min:5})){
            errors.push({message:'Title > 5 plz'})
        }  
        if(!validator.isLength(postInput.content,{min:5})){
            errors.push({message:'Content > 5 plz'})
        }  
        const post = await Post.findById(id).populate('creator','name')
        if(!post){
            const err = new Error ('No post found')
            err.code = 404;
            throw err;
        }  
        if(post.creator._id.toString() !== req.userId.toString()){
            errors.push({message:'Unauthorized entry'})
        }
        if(errors.length > 0 ){
            const err = new Error('Invalid inputs')
            err.data = errors;
            console.log(errors)
            err.code = 422;
            throw err;
        }    
        post.title = postInput.title;
        post.content = postInput.content;
        if(postInput.imageUrl !== "undefined"){
            post.imageUrl = postInput.imageUrl;
        }
        const updatedPost = await post.save();
        return{
            ...updatedPost._doc,
            _id : updatedPost._id.toString(),
            createdAt: updatedPost.createdAt.toISOString(),
            updatedAt: updatedPost.updatedAt.toISOString(),
        }
    },
    deletePost: async function({id},req){
        const errors = [];
        if(!req.isAuth){
           errors.push({message:'Unauthorized entry'})
        }  
        if(validator.isEmpty(id)){
            errors.push({message:'No post ID provided'})
        }
        const post = await Post.findById(id)
        console.log(post);
        if(!post){
            const err = new Error ('No post found')
            err.code = 404;
            throw err;
        }  
        if(post.creator.toString() !== req.userId.toString()){
            errors.push({message:'Unauthorized entry'})
        }
        if(errors.length > 0 ){
            const err = new Error('Invalid inputs')
            err.data = errors;
            console.log(errors)
            err.code = 422;
            throw err;
        }      
        const user = await User.findById(req.userId);
        user.posts.pull({_id: post._id})
        user.save();
        const removedPost = await post.remove();
        clearImage(removedPost._doc.imageUrl)
        return {
            ...removedPost._doc,
            _id: removedPost._id.toString(),
            createdAt: removedPost.createdAt.toISOString(),
            updatedAt: removedPost.updatedAt.toISOString()
        }
    },
    status: async function({},req){
        const errors = [];
        if(!req.isAuth){
           errors.push({message:'Unauthorized entry'})
        }  
        if(errors.length > 0 ){
            const err = new Error('Invalid inputs')
            err.data = errors;
            console.log(errors)
            err.code = 422;
            throw err;
        }      
        const user = await User.findById(req.userId);
        return user.status.toString()
        
    },
    updateStatus: async function({status},req){
        console.log('status update')
        const errors = [];
        if(!req.isAuth){
           errors.push({message:'Unauthorized entry'})
        }  
        if(!validator.isLength(status,{min:5})){
            errors.push({message:'status requires a minimum of 5 characters'})
        }
        const user = await User.findById(req.userId);
        if(!user)
            errors.push({message:'User not found'})
        if(errors.length > 0 ){
            const err = new Error('Invalid inputs')
            err.data = errors;
            console.log(errors)
            err.code = 422;
            throw err;
        }     
        user.status = status;
        await user.save();
        return user.status;
    }

};


//simple function to delete a file 
const clearImage = filePath => {
    filePath = path.join(__dirname,'..',filePath);
    fs.unlink(filePath, err=>console.log(err))
}