const express = require('express')
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
async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctorsPortal').collection('services')
        const bookingCollection = client.db('doctorsPortal').collection('bookings')
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
        app.post('/bookings', async (req, res) => {
            const email = req.body.email
            const date = req.body.date
            const treatment = req.body.treatment
            const query = { email: email, date: date, treatment: treatment }
            const isDuplicate = await bookingCollection.findOne(query)
            console.log(isDuplicate);
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