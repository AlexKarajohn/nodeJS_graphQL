const {validationResult} = require('express-validator/check');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwtKey = require('../global_vars').jwtKey;


exports.putSignup = async (req,res,next) =>{
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        const error = new Error ('validation failed, entered data is incorrect');
        error.statusCode = 422;
        error.data = errors.array();
        throw error;
    }
    const email = req.body.email;
    const name = req.body.name;
    const password = req.body.password;
    try{
        hashedPassword = await bcrypt.hash(password,12);
        const user = new User({
            name,
            email,
            password : hashedPassword
        })        
        const userResult = await user.save();
        res.status(201).json({
                message : 'User Created',
                userId: userResult._id
        })
    }catch(err){
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
  
}
exports.postLogin = async (req,res,next) =>{
    const email = req.body.email;
    const password = req.body.password;
    try{
        const user = await User.findOne({email:email})
        if(!user){
            const error = new Error('A user with this email couldnt not be found');
            error.statusCode = 401;
            throw error;
        }
        const isEqual = await bcrypt.compare(password,user.password);
        if(!isEqual){
            const error = new Error('Wrong Password');
            error.statusCode = 401;
            throw error;
        }
        const token = jwt.sign({
            email: user.email,
            userId : user._id.toString()
            }, 
            jwtKey, 
            { expiresIn: '1h'}
        );
        res.status(200).json({
            token,
            userId: user._id.toString()
        })
    }catch(err){
            if(!err.statusCode){
                err.statusCode = 500;
            }
            next(err);
    }
}

exports.getStatus = async (req,res,next) => {
    const userId = req.userId;
    try{
        const user = await User.findById(userId)
        if(!user){
            const error = new Error ('User not found')
            error.statusCode = 404;
            throw error;
        }
        if(user.status){
            res.status(200).json({
                message : 'User status Fetched',
                status : user.status
            })
        }
        else{
            res.status(200).json({
                message : 'User status Fetched',
                status : 'User has not set a status'
            })
        }
    }catch(err){
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}
exports.putStatus = async (req,res,next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        const error = new Error ('validation failed, entered data is incorrect');
        error.statusCode = 422;
        throw error;
    }
    const userId = req.userId;
    const newStatus = req.body.status;
    try{    
        const user = await User.findById(userId)
        if(!user){
            const error = new Error ('User not found')
            error.statusCode = 404;
            throw error;
        }
        user.status = newStatus;
        const userResult = await user.save();
        res.status(201).json({
            message : 'User status updated',
            status : newStatus
        })
    }catch(err){
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}
