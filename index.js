const express = require("express");
const cors = require("cors");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { MongoClient } = require("mongodb");
const { ObjectId } = require('mongodb');
require("dotenv").config();
const mongouri = process.env.MONGO_URI;
const dbname = "sctp-05";

let app = express();
app.use(express.json());
app.use(cors());

const generateAccessToken = (id, email) => {
    return jwt.sign({
        'user_id': id,
        'email': email
    }, process.env.TOKEN_SECRET, {
        expiresIn: "1h"
    });
}

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(403);
    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

async function connect(uri, dbname) {
    let client = await MongoClient.connect(uri);
    let db = client.db(dbname);
    return db;
}

async function main() {

    let db = await connect(mongouri, dbname);

    /**
     * @async
     * @public
     * @description main path to check API status
     */
    app.get("/", async function (req, res) {
        res.json({
            "message": "Server is running"
        })
    })

    /**
     * 
     * @public
     * @description lists all orders without query
     */
    // app.get("/orders", async (req, res) => {
    //     try {
    //         const orders = await db.collection("orders").find().project().toArray();

    //         res.json({ orders });
    //     }
    //     catch (err) {
    //         console.error(err);
    //         res.status(500).json({
    //             error: "Internal Server Error"
    //         });
    //     }
    // })

    /**
     * @async
     * @public
     * @description list all orders with option to query
     */
    app.get("/orders", async (req, res) => {
        try {
            const {
                name, brand, year, receivedDate, services
            } = req.query;

            let query = {};

            if (name) {
                query["name"] = name;
            }

            if (brand) {
                query["brand.name"] = brand;
            }

            if (year) {
                query["year"] = parseInt(year);
            }

            if (receivedDate) {
                query["receivedDate"] = receivedDate;
            }

            if (services) {
                query["services.name"] = services;
            }

            const orders = await db.collection("orders").find(query).project().toArray();

            res.json({ orders });
        }
        catch (err) {
            console.error(err);
            res.status(500).json({
                error: "Internal Server Error"
            });
        }
    })

    /**
     * @async
     * @public
     * @description go to order via id
     * @param {string} :id - Mongo Object ID
     */
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

    /**
     * @async
     * @private
     * @description to submit new order
     * @param {string} name - name of client
     * @param {string} brand - brand of bicycle
     * @param {string} year - year client bought the bicycle
     * @param {string} receivedDate - format dd-mm-yyyy, date bicycle received
     * @param {string} breakdown - breakdown of bicycle parts and its condition
     * @param {string} services - list of services client requests for
     */
    app.post("/orders", verifyToken, async (req, res) => {
        try {
            // console.log("req.body >>> ", req.body);
            const {
                name, brand, year, receivedDate, breakdown, services
            } = req.body;

            if (!name || !brand || !year ||
                !receivedDate || !breakdown || !services) {
                return res.status(400).json({
                    error: "Missing Required Fields"
                });
            }

            const brandDoc = await db.collection("bicycle-brands").findOne({
                name: brand
            });

            if (!brandDoc) {
                return res.status(400).json({
                    error: "Invalid Brand"
                });
            }

            const serviceDoc = await db.collection("services").find({
                name: { $in: services }
            }).toArray();

            if (serviceDoc.length !== services.length) {
                return res.status(400).json({
                    error: "One Or More Invalid Services"
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

    /**
     * @async
     * @private
     * @description adds comment to order via id
     * @param {string} :id - Mongo Object ID
     * @param {string} user - name of user
     * @param {string} comment - comment by user
     */
    app.post("/orders/:id/comments", verifyToken, async (req, res) => {
        try {
            const orderId = req.params.id;
            const { user, comment } = req.body;

            if (!user || !comment) {
                return res.status(400).json({
                    error: "Missing Required Fields"
                });
            }

            const newComment = {
                comment_id: new ObjectId(),
                user,
                comment,
                date: new Date()
            }

            const result = await db.collection("orders").updateOne(
                { _id: new ObjectId(orderId) },
                { $push: { comment: newComment } }
            );

            res.status(201).json({
                message: "Comment Added Successfully",
                commentId: newComment.comment_id
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                error: "Internal Server Error"
            });
        }
    })

    /**
     * @async
     * @private
     * @description updates order via id
     * @param {string} :id - Mongo Object ID
     * @param {string} name - name of client
     * @param {string} brand - brand of bicycle
     * @param {string} year - year client bought the bicycle
     * @param {string} receivedDate - format dd-mm-yyyy, date bicycle received
     * @param {string} breakdown - breakdown of bicycle parts and its condition
     * @param {string} services - list of services client requests for
     */
    app.put("/orders/:id", verifyToken, async (req, res) => {
        try {
            const orderId = req.params.id;

            const {
                name, brand, year, receivedDate, breakdown, services
            } = req.body;

            if (!name || !brand || !year ||
                !receivedDate || !breakdown || !services) {
                return res.status(400).json({
                    error: "Missing Required Fields"
                });
            }

            const brandDoc = await db.collection("bicycle-brands").findOne({
                name: brand.name
            });

            if (!brandDoc) {
                return res.status(400).json({
                    error: "Invalid Brand"
                });
            }

            console.log(services.map((service)=>service.name));
            const serviceDoc = await db.collection("services").find({
                name: { $in: services.map((service)=>service.name) }
            }).toArray();

            console.log(serviceDoc);

            if (serviceDoc.length !== services.length) {
                return res.status(400).json({
                    error: "One Or More Invalid Services"
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
                { _id: new ObjectId(orderId) },
                { $set: updateOrder }
            )

            if (result.matchedCount === 0) {
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

    /**
     * @async
     * @private
     * @description deletes an order via id
     */
    app.delete("/orders/:id", verifyToken, async (req, res) => {
        try {
            const orderId = req.params.id;

            const result = await db.collection("orders").deleteOne(
                { _id: new ObjectId(orderId) }
            )

            if (result.deletedCount === 0) {
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

    /**
     * @async
     * @public
     * @description create new user
     */
    app.post("/register", async function (req, res) {
        const result = await db.collection("users").insertOne({
            "username": req.body.username,
            "fullName": req.body.fullName,
            "password": await bcrypt.hash(req.body.password, 12)
        })
        res.json({
            "message": "New User Created",
            "result": result
        })
    })

    /**
     * @async
     * @public
     * @description login registered user
     */
    app.post('/login', async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Email and Password Required" });
        }
        const user = await db.collection("users").findOne({ username: username });
        if (!user) {
            return res.status(404).json({ message: "User Not Found" });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid Password" });
        }
        const accessToken = generateAccessToken(user._id, user.username);
        res.json({ accessToken: accessToken });
    });
}

main();

app.listen(3000, () => {
    console.log(`Server running on port 3000`);
})