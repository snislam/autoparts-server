const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.DB_STRIPE_SECRET);
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors())
app.use(express.json())

// mongodb section start

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e2lck.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// verifyJwt function
const verifyJwt = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.DB_JWT_SECRET, (err, decoded) => {
        if (err) {
            res.status(403).send({ message: 'Forbidden' })
        } else {
            req.decoded = decoded;
            next();
        }
    })
}

async function run() {
    try {
        await client.connect();
        const productsCollection = client.db("autoparts").collection("products");
        const usersCollection = client.db("autoparts").collection("users");
        const reviewsCollection = client.db("autoparts").collection("reviews");
        const ordersCollection = client.db("autoparts").collection("orders");
        const paymentCollection = client.db("autoparts").collection("payment");

        const verifyAdmin = async (req, res, next) => {
            console.log(req.decoded)
            const requesterEmail = req.decoded.email;
            console.log(requesterEmail)
            const requester = await usersCollection.findOne({ email: requesterEmail })
            console.log(requester)
            if (requester.role === 'admin') {
                next()
            }
            else {
                return res.status(403).send({ message: 'forbidden' })
            }
        }

        /**--------------------------------- */
        // products api calling center
        /**--------------------------------- */

        // get all products
        app.get('/products', async (req, res) => {
            const products = await productsCollection.find({}).toArray();
            res.send(products);
        })

        // get specifiq products details
        app.get('/purchase/:id', async (req, res) => {
            const id = req.params.id;
            const product = await productsCollection.findOne({ _id: ObjectId(id) })
            res.send(product)
        })

        /** ----------------------------- */
        // users api
        /** ----------------------------- */

        // update user
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.DB_JWT_SECRET, { expiresIn: '1d' })
            res.send({ result, token })
        })

        // update profile
        app.put('/user/update/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        app.delete('/user/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await usersCollection.deleteOne(filter)
            res.send(result)
        })

        // get all user
        app.get('/users', verifyJwt, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find({}).toArray();
            res.send(result);
        })

        // get admin 
        app.get('/user/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin })
        })

        // add review
        app.put('/review/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const body = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: body
            }
            const result = await reviewsCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        // get reviews
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find({}).toArray();
            res.send(result)
        })

        // place order
        app.post('/orders', verifyJwt, async (req, res) => {
            const order = req.body;
            const result = await ordersCollection.insertOne(order)
            res.send(result)
        })

        // my order api
        app.get('/orders', verifyJwt, async (req, res) => {
            const email = req.query.email;
            const myOrders = await ordersCollection.find({ email: email }).toArray()
            res.send(myOrders);
        })

        // individual orders
        app.get('/order/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await ordersCollection.find(query).toArray();
            res.send(result)
        })

        // individual orders delete
        app.delete('/order/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await ordersCollection.deleteOne(query)
            res.send(result)
        })

        // payment-intent
        app.post('/payment-intent', verifyJwt, async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({ clientSecret: paymentIntent.client_secret })
        })

        // update orders
        app.patch('/bookings/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const body = req.body
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transectionId: body.transectionId,
                    amount: body.amount
                }
            }
            const result = await ordersCollection.updateOne(filter, updatedDoc)
            const payments = await paymentCollection.insertOne(updatedDoc)
            res.send(result)
        })

        // all orders
        app.get('/allorders', verifyJwt, async (req, res) => {
            const orders = await ordersCollection.find({}).toArray();
            res.send(orders)
        })

        // deliver api for order
        app.put('/orders/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const body = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: body
            }
            const result = await ordersCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        // deliver api for product
        app.put('/products/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const body = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: body
            }
            const result = await productsCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        // get single product
        app.get('/products/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const product = await productsCollection.findOne({ _id: ObjectId(id) })
            res.send(product)
        })

        // add product 
        app.post('/products', verifyJwt, verifyAdmin, async (req, res) => {
            const body = req.body;
            const product = await productsCollection.insertOne(body)
            res.send(product)
        })

        // delete product
        app.delete('/products/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(query)
            res.send(result)
        })


    } finally {
        // empty for now
    }
}

run().catch(console.dir)


// main route api
app.get('/', async (req, res) => {
    console.log("connected");
    res.send('I am ready to start the project.')
})

// port litening
app.listen(port, () => {
    console.log('Port', port)
})