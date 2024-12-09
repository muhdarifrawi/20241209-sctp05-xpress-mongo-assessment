const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const { ObjectId } = require('mongodb');
require("dotenv").config();
const mongouri = process.env.MONGO_URI;
const dbname = "sctp-05";

let app = express();
app.use(express.json());
app.use(cors());

async function connect(uri, dbname) {
    let client = await MongoClient.connect(uri);
    let db = client.db(dbname);
    return db;
}

async function main() {

    let db = await connect(mongouri, dbname);

    app.get("/", function (req, res) {
        res.json({
            "message": "Server is running"
        })
    })

    app.get("/orders", async (req, res) => {
        try {
            const orders = await db.collection("orders").find().project().toArray();

            res.json({ orders });
        }
        catch (err) {
            console.error(err);
            res.status(500).json({
                error: "Internal Server Error"
            });
        }
    })

    app.get("/orders/:id", async (req, res) => {
        try {
            const id = req.params.id;
            console.log(`Currently in ${id}`);

            const order = await db.collection("orders").findOne(
                { _id: new ObjectId(id) },
                {
                    projection: {
                        _id: 0
                    }
                }
            )

            if (!order) {
                return res.status(404).json({
                    error: "Order Not Found"
                })
            }

            res.json(order);

        } catch (err) {
            console.error(err);
            res.status(500).json({
                error: "Internal Server Error"
            });
        }
    })

    app.post("/orders", async (req, res) => {
        try {
            // console.log("req.body >>> ", req.body);
            const { 
                name, item, brand, year, receivedDate, breakdown, services 
            } = req.body;

            if(!name || !item || !brand || !year || 
                !receivedDate || !breakdown || !services){
                    return res.status(400).json({
                        error: "Missing Required Fields"
                    });
            }

            const brandDoc = await db.collection("bicycle-brands").findOne({
                name: brand
            });

            if(!brandDoc){
                return res.status(400).json({
                    error: "Invalid Brand"
                });
            }

            const serviceDoc = await db.collection("services").find({
                name:{ $in:services }
            }).toArray();

            if(serviceDoc.length !== services.length){
                return res.status(400).json({
                    error: "One Or More Invalid Tags"
                });
            }
            console.log(brandDoc);
            const newOrder = {
                name,
                brand: {
                    _id: brandDoc._id,
                    name: brandDoc.name
                },
                year,
                receivedDate,
                breakdown,
                services: serviceDoc.map(service => {
                    // console.log("service >>> ",service)
                    return ({
                        _id: service._id,
                        name: service.name
                    })
                }
                    )
            }

            const result = await db.collection("orders").insertOne(newOrder);

            // console.log("result >>> ", result);
            // console.log("new Order >>> ", newOrder);
            res.status(201).json({
                message: "New Order Submitted",
                orderId: result.insertedId
            });
        }
        catch (err) {
            console.error(err);
            res.status(500).json({
                error: "Internal Server Error"
            });
        }
    })

    app.put("/orders/:id", async (req,res) => {
        try {
            const orderId = req.params.id;
            
            const { 
                name, item, brand, year, receivedDate, breakdown, services 
            } = req.body;

            if(!name || !item || !brand || !year || 
                !receivedDate || !breakdown || !services){
                    return res.status(400).json({
                        error: "Missing Required Fields"
                    });
            }

            const brandDoc = await db.collection("bicycle-brands").findOne({
                name: brand
            });

            if(!brandDoc){
                return res.status(400).json({
                    error: "Invalid Brand"
                });
            }

            const serviceDoc = await db.collection("services").find({
                name:{ $in:services }
            }).toArray();

            if(serviceDoc.length !== services.length){
                return res.status(400).json({
                    error: "One Or More Invalid Tags"
                });
            }
            // console.log(brandDoc);
            const updateOrder = {
                name,
                brand: {
                    _id: brandDoc._id,
                    name: brandDoc.name
                },
                year,
                receivedDate,
                breakdown,
                services: serviceDoc.map(service => {
                    // console.log("[PUT] service >>> ",service)
                    return ({
                        _id: service._id,
                        name: service.name
                    })
                }
                    )
            }

            const result = await db.collection("orders").updateOne(
                {_id: new ObjectId(orderId)},
                {$set: updateOrder}
            )

            if(result.matchedCount === 0){
                return res.status(404).json({
                    error: "Order Not Found"
                });
            }

            console.log("EDTEID >>> ", result);
            res.status(200).json({
                message: `Order ID ${orderId} Edited`
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({
                error: "Internal Server Error"
            });
        }
    })

    app.delete("/orders/:id", async (req,res) => {
        try {
            const orderId = req.params.id;

            const result = await db.collection("orders").deleteOne(
                {_id: new ObjectId(orderId)}
            )

            if(result.deletedCount === 0){
                return res.json(404).json({
                    error: "Order Not Found"
                });
            }

            res.status(200).json({
                message: `Order ID ${orderId} Deleted`
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({
                error: "Internal Server Error"
            });
        }
    })
}

main();

app.listen(3000, () => {
    console.log(`Server running on port 3000`);
})