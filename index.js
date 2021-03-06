const express = require('express')
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000
app.use(cors())
app.use(express.json())
app.get('/', (req, res) => {
    res.send('Hello Doctors Portal Backend')
})
app.listen(port, () => {
    console.log(`Doctors Portal running on port ${port}`)
})
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wcxgg.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const verifyJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized Access" })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.SECRET_KEY, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden Acess" })
        }
        req.decodedEmail = decoded.email
        next()
    });
}
async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctorsPortal').collection('services')
        const bookingCollection = client.db('doctorsPortal').collection('bookings')
        const userCollection = client.db('doctorsPortal').collection('users')
        const doctorCollection = client.db('doctorsPortal').collection('doctors')
        const verifyAdmin = async (req, res, next) => {
            const filter = { email: req.decodedEmail }
            const requester = await userCollection.findOne(filter)
            if (requester.role === 'Admin') {
                next()
            }
            else {
                return res.status(401).send({ message: "Unauthorize Access" })
            }
        }
        app.get('/payment', verifyJWT, async (req, res) => {
            const query = { id: req.query.id }
            const result = await bookingCollection.findOne(query)
            if (result) {
                return res.send(result)
            }
            else {
                return res.status(404).send({ message: "Not Found" })
            }
        })
        app.delete('/delete-doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { email: req.query.email }
            const result = await doctorCollection.deleteOne(query)
            res.send(result)
        })
        app.get('/all-doctor', verifyJWT, verifyAdmin, async (req, res) => {
            res.send(await doctorCollection.find({}).toArray())
        })
        app.post('/add-doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { email: req.body.email }
            const isDuplicate = await doctorCollection.findOne(query)
            if (!isDuplicate) {
                const result = await doctorCollection.insertOne(req.body)
                res.send(result)
            }
            else {
                res.send({ message: 'Duplicate Found' })
            }
        })
        app.put('/admin', async (req, res) => {
            const email = req.query.email
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user?.role === 'Admin'
            res.send({ admin: isAdmin })
        })
        app.put('/deleteUser', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { email: req.query.email }
            const result = await userCollection.deleteOne(query)
            return res.send(result)
        })
        app.put('/makeAdmin', verifyJWT, verifyAdmin, async (req, res) => {
            const filter = { email: req.query.email }
            const updateDoc = {
                $set: {
                    role: req.query.role,
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })
        app.post('/all-users', verifyJWT, verifyAdmin, async (req, res) => {
            res.send(await userCollection.find().toArray())
        })
        app.get('/token', async (req, res) => {
            const email = req.query.email
            const token = jwt.sign({ email: email }, process.env.SECRET_KEY, {
                expiresIn: "24h"
            })
            res.send({ token: token })
        })
        app.post('/verify', verifyJWT, async (req, res) => {
            const email = req.query.email
            if (email !== req.decodedEmail) {
                return res.status(403).send({ message: "Forbidden Acess" })
            }
            else {
                return res.send({ message: "Successfull" })
            }
        })
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const updateDoc = {
                $set: {
                    email: email,
                    name: req.body.name,
                    lastLogin: req.body.lastLogin,
                },
            };
            const filter = { email: email }
            const options = { upsert: true };
            const result = await userCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })
        app.get('/services', async (req, res) => {
            if (!req.query.date) {
                return res.send([])
            }
            const date = req.query.date
            const query = { date: date }
            const services = await serviceCollection.find().toArray()
            const bookingsThatDay = await bookingCollection.find(query).toArray()
            services.forEach(service => {
                const eachServiceBooking = bookingsThatDay.filter(book => book.treatment === service.name)
                const alreadyBooked = eachServiceBooking.map(each => each.slot)
                const available = service.slots.filter(eachSlot => !alreadyBooked.includes(eachSlot))
                service.slots = available
            })
            res.send(services)
        })
        app.post('/my-bookings', verifyJWT, async (req, res) => {
            if (req.body.email === req.decodedEmail) {
                const query = { email: req.query.email }
                const result = await bookingCollection.find(query).toArray()
                return res.send(result)
            }
            else {
                return res.status(401).send({ message: "Unauthorize Access" })
            }
        })
        app.post('/bookings', async (req, res) => {
            const email = req.body.email
            const date = req.body.date
            const treatment = req.body.treatment
            const query = { email: email, date: date, treatment: treatment }
            const isDuplicate = await bookingCollection.findOne(query)
            if (!isDuplicate) {
                const added = await bookingCollection.insertOne(req.body);
                return res.send(added)
            }
            else {
                return res.send({ duplicate: true })
            }
        })
    }
    finally {

    }
}
run().catch(console.dir);
