const express = require('express');
const cors = require('cors');
const app = express();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

const userModel = require('./models/user');
const complaintModel = require('./models/complaint');
const cookieparser = require('cookie-parser');
const {Parser} = require('json2csv');
const bcryptSalt = bcrypt.genSaltSync(10);

require('dotenv').config();
const jwtsecret = process.env.jwtsecret;

const download = require('image-downloader');
const path = require('path');
const multer = require('multer');
const upload = multer({dest:'uploads/'});
const fs = require('fs');

const transporter = nodemailer.createTransport({
    service:'gmail',
    auth: {
        user: process.env.Email,
        pass: process.env.password
    }
});

app.use(cookieparser());
app.use(express.json());
app.use(cors({
    credentials:true,
    origin:'http://localhost:5173',
}));
app.use('/uploads',express.static(path.join(__dirname+'/uploads')));

app.post('/register',async function(req,res){
    try{
        const obj = await userModel.create({
        name:req.body.name,
        email:req.body.email,
        password:bcrypt.hashSync(req.body.pass,bcryptSalt),
        phone:req.body.phone
        })
        res.json({success:true});
    }
    catch(e){
        res.json({success:false});
    }
    
})

app.post('/login',async function(req,res){
    try{
        const target_user = await userModel.findOne({email:req.body.lname});
        if(target_user)
        {
            const passOk = bcrypt.compareSync(req.body.lpass,target_user.password);
            if(passOk){
                const token = jwt.sign({name:target_user.name,id:target_user._id,photo:target_user.profileimage},jwtsecret,{},(err,token)=>{
                    if(err) throw err;
                    res.cookie('token',token);
                    res.json({ success: true ,name:target_user.name,photo:target_user.profileimage,role:target_user.role });
                });
            }
            else res.json({ success: false, err: "Invalid password" });
        }
        else res.json({ success: false, err: "User not found" });
    }
    catch(e){res.status(500).json({ success: false, err: "Internal server error" })}
})

app.post('/logout',(req,res)=>{
    res.cookie('token','').json({success:true});
})

app.get('/profile',(req,res)=>{
    const {token} = req.cookies;
    if(token)
    {
        jwt.verify(token,jwtsecret,{},async (err,user)=>{
            if(err) throw err;
            const data = await userModel.findOne({"_id":user.id},{"name":1,"profileimage":1,"role":1,"_id":0});
            res.json(data);
        })
    }
    else res.json(null);
})

app.post('/uploadByLinks',(req,res)=>{
 let photourl = req.body.photoUrl;
  const newname = Date.now() + '.jpg';
  const options = {
  url: photourl,
  dest: __dirname + '/uploads/' + newname,
  };  

    download.image(options)
    .then(({ filename }) => {
        console.log('Saved to', filename);
        res.json(newname);
    })
    .catch((err) => console.error(err));
})

app.post('/uploadByButton',upload.array('photos',10),(req,res)=>{
    const upfiles = req.files;
    let filenames = [];
    for(let file of upfiles)
    {
        const orname = file.originalname;
        const ext = path.extname(orname);
        const filepath = file.path;
        const newname = Date.now() + ext;
        fs.renameSync(filepath,'uploads//' + newname);
        filenames.push(newname)
    }
    res.json(filenames)
})

app.post('/uploadByButtonProfile',upload.array('photos',10),async function(req,res){
    const {token} = req.cookies; let data = "";
    jwt.verify(token,jwtsecret,{},(err,user)=>{
        if(err) throw err;
        data = user;
    })

    const upfiles = req.files;
    let filename = [];
    for(let file of upfiles)
    {
        const orname = file.originalname;
        const ext = path.extname(orname);
        const filepath = file.path;
        const newname = Date.now() + ext;
        fs.renameSync(filepath,'uploads//' + newname);
        filename.push(newname)
    }

    const profilepicdet = await userModel.findOne({"_id":data.id},{"profileimage":1,"_id":0});

    await userModel.updateOne({"_id":data.id},{"profileimage":filename[0]});
    try{
        if(profilepicdet.profileimage){
            const filePathToDelete = path.join(__dirname, 'uploads', profilepicdet.profileimage);
            fs.unlinkSync(filePathToDelete);
        }
        res.json(filename);
    }
    catch(err){console.log(err);}
})

app.post('/SubmitForm',(req,res)=>{
    const det = req.body;
    const {token} = req.cookies;

    if(token)
    {
        jwt.verify(token,jwtsecret,{},async (err,user)=>{
            if(err) res.json('Unsuccessful');
            const complaint = await complaintModel.create({
            name:det.name,
            age:det.age,
            gender:det.gender,
            title:det.title,
            description:det.description,
            phone:det.phone,
            extraInfo:det.extrainfo,
            address:det.address, 
            date:det.date,
            tags:det.targetObject,
            photos:det.photos, 
            startTime:det.checkin,
            endTime:det.checkout,
            registrarMail:det.email,
            })
            await userModel.updateOne({_id:user.id},{$push:{"complaints":complaint._id}});
            res.json('Successful');
        })
    }
    else res.json('Unsuccessful');
})

app.get('/userComplaints',(req,res)=>{
    const {token} = req.cookies;
    if(token)
    {
        jwt.verify(token,jwtsecret,{},async (err,user)=>{
            if(err) throw err;
            const data = await userModel.findOne({"_id":user.id},{complaints:1,_id:0}).populate("complaints",{title:1,description:1,date:1,photos:1,address:1,status:1,registrationDate:1,lastUpdateDate:1,_id:0});
            res.json(data);
        })
    }
    else res.json({});
})

app.get('/allComplaints',async (req,res)=>{
    const complaints = await complaintModel.find({});
    res.json(complaints);
})

app.post('/filterComplaints',async (req,res)=>{
  const searchTags = req.body.search; 
  let searchQuery = {};

  if(searchTags.length>0){
    searchQuery = {
     $or: searchTags.map(tag => ({ [`tags.${tag}`]: true }))
    };
  }

  const sortTags = req.body.sort; const sortQuery = {};
  sortTags.forEach(tag => {sortQuery[tag] = 1;});

  const data = await complaintModel.find(searchQuery).sort(sortQuery);
  res.json(data);
})

app.post('/Search',async (req,res)=>{
    const field = req.body.field; const query = {}; 

    if(field=='age' || field=='date' || field=='startTime'){
        query[field] = req.body.search;
    }
    else query[field] = {'$regex':req.body.search,'$options':'i'};

    const data = await complaintModel.find(query); res.json(data);
})

app.get('/DownloadCSV',async (req,res)=>{
    const complaints = await complaintModel.find({});
    const fields = ['title', 'name', 'age', 'gender', 'description', 
    'extraInfo', 'address', 'date', 'startTime', 'endTime', 'phone', 'status'];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(complaints);
    
    res.header("Content-Type","text/csv");
    res.attachment("Complaints_Data.csv");
    res.send(csv);
})

app.put('/updateStatus',async (req,res)=>{
    const data = await complaintModel.updateOne({"_id":req.body.id},{"status":req.body.status,"lastUpdateDate":new Date().toISOString().split('T')[0]});

    if(data.modifiedCount == 1){
        res.status(200).json({"success":true});
    }
    else res.status(404).json({"success":false});
})

app.post('/deleteComplaint',async (req,res)=>{
    try{
        const result = await complaintModel.deleteOne({"_id":req.body.id});
        if(result.deletedCount == 1){
            const result2 = await userModel.updateOne({"email":req.body.regMail},{$pull:{"complaints":req.body.id}});
            res.json({"Success":true});
        }
    }
    catch{res.json({"Success":false})};
})

app.post('/SendMail',(req,res)=>{
    const det = req.body;
    const mailOptions = {
        from: process.env.Email,
        to: 'harshjain6812@gmail.com',
        subject: det.title,
        text: det.message
    };

    transporter.sendMail(mailOptions,(error,info)=>{
        if(error){
            console.log(error);
            res.status(404).json({'Success':false});
        }
        else res.status(300).json({'Success':true});
    })
})

app.listen(process.env.port, async ()=>{
    console.log(`Server is running on port ${process.env.port}`);
    try{
        await mongoose.connect(process.env.atlasDbURL);
        console.log("Successfully connected to DB");
    }
    catch(err){
        console.log("Unable to connect to DB", err);
    }
});