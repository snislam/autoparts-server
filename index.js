const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

// main route api
app.get('/', async (req, res) => {
    console.log("connected");
    res.send('I am ready to start the project.')
})

// port litening
app.listen(port, () => {
    console.log('Port', port)
})