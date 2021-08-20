const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const {graphqlHTTP} = require('express-graphql');
const graphqlSchema = require('./graphql/schema')
const graphqlResolver = require('./graphql/resolvers')

const auth = require('./middleware/auth');
const app = express();
const dbuname = require('./global_vars').dbuname;
const dbpass = require('./global_vars').dbpass;
const MONGODB_URI = `mongodb+srv://${dbuname}:${dbpass}@cluster0.czne7.mongodb.net/blog`
const fileStorage = multer.diskStorage({
    destination: (req,file, cb) => {
        cb(null,'images');
    },
    filename: (req,file,cb) => {
        cb(null, new Date().toISOString() + '-' + file.originalname);
    }
})
const fileFilter = (req,file,cb) =>{
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg'){
        cb(null,true);
    }
    else{
        cb(null,false);
    }
}
app.use(bodyParser.json()); //application/json
app.use(multer({
    storage: fileStorage,
    fileFilter: fileFilter
}).single('image'));
app.use((req,res,next)=>{
    //This is how we allow CORS domains , DONT USE * IN PRODUCTION
    res.setHeader('Access-Control-Allow-Origin','*');
    //What methods we allow
    res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE');
    //What Headers can the user add.
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
    if(req.method === 'OPTIONS')
        return res.sendStatus(200);
    next();
});
app.use(auth);
app.use('/post-image',(req,res,next)=>{
    if(!req.isAuth){
        throw new Error ('not Authed');
    }
    if(!req.file){
        return res.status(200).json({message : 'no file provided'});
    }
    if(req.body.oldPath){
        clearImage(req.body.oldPath);
    }
    return res.status(201).json({message: 'file stored.', filePath: req.file.path})
})

app.use('/images',express.static(path.join(__dirname,'images')))
app.use('/graphql',graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    customFormatErrorFn(err){
        if(!err.originalError){
            return err
        }
        console.log(err);
        const data = err.originalError.data;
        const message = err.message || 'An error ocurred';
        const code = err.originalError.code || 500;
        return {
            message,
            status: code,
            data
        }
    }
}))


//error grabber
app.use((error,req,res,next)=>{
    console.log(error);
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data;
    res.status(status).json({
        message,
        data,
    })
})

mongoose.connect(MONGODB_URI)
    .then(result=>{
        console.log('MongoDb Connected');
        app.listen(8080);
    })
    .catch(err=>console.log(err))

//simple function to delete a file 
const clearImage = filePath => {
    filePath = path.join(__dirname,filePath);
    fs.unlink(filePath, err=>console.log(err))
}