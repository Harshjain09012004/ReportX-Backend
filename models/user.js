const mongoose = require( 'mongoose' );
// mongoose.connect('mongodb://127.0.0.1:27017/CrimePortal');

const userSchema = new mongoose.Schema({
    name:String,
    email:{
        type:String,
        unique:true
    },
    password:String,
    phone:{
        type:String,
        unique:true
    },
    profileimage:String,
    complaints:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'complaint'
    }],
    role:{
        type:String,
        enum:['user','admin'],
        default:'user'
    },
});

const userModel = mongoose.model('User',userSchema);
module.exports = userModel;