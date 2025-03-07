const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    name:String,
    registrarMail:String,
    age:Number,
    gender:String,
    title:String,
    status:{
        type:String,
        default:"Pending"
    },
    phone:Number,
    description:String,
    extraInfo:String,
    address:String,
    date:Date,
    registrationDate:{
        type:'String',
        default:new Date().toISOString().split('T')[0]
    },
    lastUpdateDate:{
        type:'String',
        default:new Date().toISOString().split('T')[0]
    },
    tags:{},
    photos:[String],
    startTime:String,
    endTime:String,
})

const complaintModel = mongoose.model('complaint',complaintSchema);
module.exports =  complaintModel;