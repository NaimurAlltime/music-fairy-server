const express = require('express');
const app = express()
require('dotenv').config()
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
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
    const cartCollection = client.db("musicFairyDB").collection("carts");
    const paymentCollection = client.db("musicFairyDB").collection("payments");
    const newsCollection = client.db("musicFairyDB").collection("latestNews");


     // jwt api 
     app.post('/jwt', (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      // console.log('token', token);
      res.send({token});
    })


     // verify admin function 
     // Warning: use verifyJWT before using verifyAdmin
     const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await studentsCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

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


        // check admin role [security layer, same email, check admin]
      app.get('/students/admin/:email', verifyJWT, async(req, res) => {
        const email = req.params.email;
        
        if(req.decoded.email !== email) {
          res.send({ admin: false })
        }

        const query = { email: email }
        const user = await studentsCollection.findOne(query);
        const result = { admin: user?.role === 'admin' }
        res.send(result)
      })


        // check instructor role [security layer, same email, check instructor]
        app.get('/students/instructor/:email', verifyJWT, async(req, res) => {
          const email = req.params.email;
          
          if(req.decoded.email !== email) {
            res.send({ instructor: false })
          }
  
          const query = { email: email }
          const user = await studentsCollection.findOne(query);
          const result = { instructor: user?.role === 'instructor' }
          res.send(result)
        })



    // get api all classes data 
    app.get('/classes', async(req, res) => {
        const result = await classesCollection.find().toArray();
        res.send(result);
    })


    // get api all approved classes data 
       app.get('/classes/approved', async(req, res) => {
        const result = await classesCollection.find({status:"approved"}).toArray();
        res.send(result);
    })

      // get api limit 6 approved classes data 
      app.get('/popular/classes/approved', async(req, res) => {
        const result = await classesCollection.find({status:"approved"}).limit(6).toArray();
        res.send(result);
    })



     // post api classes with specific admin role ( todo: verifyJWT, verifyAdmin)
     app.post('/classes', async(req, res) => {
      const newItem = req.body;
      const result = await classesCollection.insertOne(newItem);
      res.send(result);
    })

     // classes update api with status approved
     app.patch('/classes/approved/:id', async(req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    // classes update api with status denied 
    app.patch('/classes/denied/:id', async(req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          status: 'denied'
        },
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    })


     // classes update api with status feedback 
     app.patch('/classes/feedback/:id', async(req, res) => {
      const id = req.params.id;
      const feedback = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };

      const updateDoc = {
        $set: {
          feedback: feedback
        },
      };

      const result = await classesCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    })


    // instructor data 
    // all instructor get api 
    app.get('/allinstructors', async(req, res) => {
      const result = await studentsCollection.find({role: "instructor"}).toArray();
      res.send(result);
    })

       // limit 6 instructor get api 
       app.get('/popular/instructors', async(req, res) => {
        const result = await studentsCollection.find({role: "instructor"}).limit(6).toArray();
        res.send(result);
      })

  
    //select cart collection

    // get api 
    app.get('/carts', verifyJWT, async(req, res) => {
      const email = req.query.email;
      // console.log(email);
      if(!email){
        res.send([])
      }

      const decodeEmail = req.decoded.email;
      if(email !== decodeEmail){
        return res.status(403).send({error: 1, message: 'forbidden access'});
      }

      const query = { email: email }
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })

        // cart get api with specific id 
        app.get('/carts/:id', async(req, res) => {
          const id = req.params.id;
          const query = {_id : new ObjectId(id)};
          const result = await cartCollection.findOne(query);
          res.send(result);
        })

    // post api 
    app.post('/carts', async(req, res) => {
        const item = req.body;
        const result = await cartCollection.insertOne(item);
        res.send(result);
    })

    // delete api 
    app.delete('/carts/:id', async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })


        // create payment intent post api (payment gateway)
      // create payment intent
      app.post('/create-payment-intent', verifyJWT, async (req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });
  
        res.send({
          clientSecret: paymentIntent.client_secret
        })
      })



   // payment post  api
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
       
      const id = payment._id;
      const query = { _id: new ObjectId(id)  }
      const deleteResult = await cartCollection.deleteOne(query)

      res.send({ insertResult, deleteResult });
    })


      // payments get api sum data with user email
    app.get('/payments', async(req, res) =>{
      let query = {}
      if(req.query?.email){
        query = {email: req.query.email}
      }
      const cursor = paymentCollection.find(query).sort({ date: -1 })
      const result = await cursor.toArray();
      res.send(result)
    })


      // get api all news data 
   app.get('/news', async(req, res) => {
      const result = await newsCollection.find().toArray();
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