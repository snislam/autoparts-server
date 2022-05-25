const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors())
app.use(express.json())

// mongodb section start

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e2lck.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();
        const productsCollection = client.db("autoparts").collection("products");
        const usersCollection = client.db("autoparts").collection("users");

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
            res.send(result)
        })

        app.delete('/user/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await usersCollection.deleteOne(filter)
            res.send(result)
        })

        // get all user
        app.get('/users', async (req, res) => {
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