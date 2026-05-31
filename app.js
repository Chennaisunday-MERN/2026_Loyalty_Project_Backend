const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();
const SalesTeamRoutes = require('./router/SalesTeam');
const Passwordrest = require ('./router/Passwordrest');
const Addproduct = require ('./router/Addproduct');
const salesorder = require ('./router/Salesorder');
const perfomainvoice = require ('./router/PUI');
const purchaseorder = require ('./router/PUO');
const customerconversion = require('./router/Customerconvertion')
const emailLeads = require('./router/EmailLeads');
const cors = require('cors');
const bodyparser = require('body-parser');
const corsOption = "http://localhost:5173";
const path = require ('path');
const app = express();
const port = process.env.PORT || 5005; 
mongoose.connect(process.env.MONGODB)

.then(() =>{console.log('Database connected')})
.catch((err) => {
    console.log('An error has occurred', err);
  });

app.use(cors(corsOption));
app.use(express.json());
app.use(bodyparser.json());
 


app.use('/api', SalesTeamRoutes);
app.use('/api-password',Passwordrest);
app.use('/api-inventory',Addproduct)
app.use('/api-salesorder',salesorder)
app.use('/api/cc',customerconversion)
app.use('/api-purchaseorder',purchaseorder)
app.use('/api-invoice',perfomainvoice)
app.use('/api/email-leads', emailLeads)


app.get('/', async (req, res) => {
  res.send("Hello world");
});

app.listen(port, () => {
  console.log(`Server ${port}`);
});
