const mongoose = require('mongoose');

const connectDB = async ()=>{
    try{
        await mongoose.connect('mongodb://127.0.0.1:27017/shoply')
        console.log('db connected')
    }catch (error){
        console.log('db not connected', error);
        console.log(error)
    }


}
module.exports = connectDB