const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const { ObjectId } = require('mongodb');
require("dotenv").config();
const mongouri = process.env.MONGO_URI;
const dbname = "sctp-05";

let app = express();
app.use(cors());

async function connect(uri, dbname){
    let client = await MongoClient.connect(uri);
    let db = client.db(dbname);
    return db;
}

async function main(){

    let db = await connect(mongouri,dbname);

    app.get("/", function(req,res){
        res.json({
            "message": "Server is running"
        })
    })
    
    app.get("/orders", async (req,res) => {
        try{
            const orders = await db.collection("orders").find().project().toArray();

            res.json({orders});
        }
        catch(err){
            console.error(err);
            res.status(500).json({
                error:"Internal Server Error"
            });
        }
    })

    app.get("/orders/:id", async (req,res){
        try {
            const id = req.params.id;
            console.log(`Currently in ${id}`);

            const order = await db.collection("orders").findOne(
                {_id: new ObjectId(id)},
                {projection: {
                    _id:0
                }}
            )

            if(!order){
                return res.status(404).json({
                    error: "Order Not Found"
                })
            }

            res.json(order);

        } catch (err) {
            console.error(err);
            res.status(500).json({
                error:"Internal Server Error"
            });
        }
    })

    app.post("/orders", async(req,res)=>{

    })
}

main();

app.listen(3000, ()=>{
    console.log(`Server running on port 3000`);
})