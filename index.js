const express = require('express');
const app = express()
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT | 5000;

// middleware 
app.use(cors())
app.use(express.json())


// jwt function 
const verifyJWT = (req, res, next) => {
  // console.log('hitting verify jwt');
  // console.log(req.headers.authorization);
  const authorization = req.headers.authorization;
  if(!authorization){
     return res.status(401).send({error: true, message: 'unauthorized access'})
  }
  const token = authorization.split(' ')[1];
  // console.log('token inside verify jwt', token);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if(error){
      return res.status(401).send({error: true, message: 'unauthorized access'})
    }
    req.decoded = decoded;
    next();
  })
}





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ynccjdb.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const studentsCollection = client.db("musicFairyDB").collection("students");
    const classesCollection = client.db("musicFairyDB").collection("classes");


     // jwt api 
     app.post('/jwt', (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      // console.log('token', token);
      res.send({token});
    })

     // students related apis 
    // students get api 
    app.get('/students', verifyJWT, async(req, res) => {
      const result = await studentsCollection.find().toArray();
      res.send(result);
    })
    
    // students post api 
    app.post('/students', async(req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await studentsCollection.findOne(query);
      if(existingUser){
        return res.send({message: "user already exit"})
      }
      const result = await studentsCollection.insertOne(user);
      res.send(result);
    })


      // students update api with instructor 
      app.patch('/students/instructor/:id', async(req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
  
        const updateDoc = {
          $set: {
            role: 'instructor'
          },
        };
  
        const result = await studentsCollection.updateOne(filter, updateDoc);
        res.send(result);
      })

      // students update api with admin 
      app.patch('/students/admin/:id', async(req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
  
        const updateDoc = {
          $set: {
            role: 'admin'
          },
        };
  
        const result = await studentsCollection.updateOne(filter, updateDoc);
        res.send(result);
      })



    // get api all classes data 
    app.get('/classes', async(req, res) => {
        const result = await classesCollection.find().toArray();
        res.send(result);
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send("Music Fairy server is running!");
})

app.listen(port, () => {
    console.log(`Music Fairy server is running on port: ${port}`);
})