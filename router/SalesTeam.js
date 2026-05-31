const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const CommonTeam = require('../Model/CommonTeam');
const verifyToken = require('../VerifyToken');
const HeadEnquiry = require('../Model/HeadEnquiry');
const Customerconvertion = require('../Model/Customerconvertion')
const ServiceEngineervisit = require('../Model/ServiceEngineervisit');
const Productrequest = require('../Model/Productrequest');
const Servicedetails = require('../Model/Servicedetails');
const Headregi = require('../Model/Headregi');
const Quatation = require('../Model/Quatation');
const {loginvalidation,registervalidation,headregistervalidation,passwordvalidation,Servicevalidation,Productvalidation,ResetPasswordvalidation, Headvalidation ,servicedetailsvalidation} = require('../validation/Registervalidation');
const CustomerNotConverted = require('../Model/CustomerNotConverted');
require('dotenv').config();
const router = express.Router();


const uploadDir = path.join(__dirname, '..', 'Assests');


if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));  
  }
});

const upload = multer({ storage });
router.use('/uploads',express.static(uploadDir));
 
  


const JWT_SECRET =  '4f6d897fe9c2b90f931d57bb9e12345c97'; 

    

router.post('/adminregistration',async (req, res) => {
    try {

        const { error,value } = headregistervalidation(req.body);
        if (error) {
          return res.status(400).json({
            message: error.details[0].message
          });
        }
        const { name, email, password, role} = value;
        console.log(req.body);
        

        if (!name || !email || !password || !role) {
            return res.status(400).json({
                message: 'Name, email, password, role, are required'
            });
        }

        let header = await Headregi.findOne({ email });
        if (header) {
            return res.status(400).json({
                message: 'Email already exists'
            });
        }
        const hashPassword = await bcrypt.hash(password, 15);
       
        const newEmployee = new Headregi({
           
            name,
            email,
            password: hashPassword,
            role,

        });

        const savedEmployee = await newEmployee.save();
        
        return res.status(200).json({
            message: "Head  Registration  is Successful",
            head: {
                name: savedEmployee.name,
                email: savedEmployee.email,
                role: savedEmployee.role,
               
              
            }
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
});
router.post('/login', async (req, res) => {
    const { error, value } = loginvalidation(req.body);
    if (error) {
      return res.status(400).json({
        message: error.details[0].message
      });
    }

    const { email, password } = value;
    
    if (!email || !password ) {
        return res.status(400).json({
            message: 'Email and password are required'
        });
    }

    try {
        console.log('Email received for login:', email);

       
        const header = await Headregi.findOne({ email });
        if (!header) {
            console.log('No header found with this email');
            
            
            const user = await CommonTeam.findOne({ email });
            if (!user) {
                console.log('No user found with this email');
                return res.status(400).json({ message: 'User not found' });
            }
            console.log('User found in CommonTeam:', user);
            
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({
                    message: 'Invalid password'
                });
            }
            
            const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
            return res.status(200).json({
                message: 'User login successful',
                role: user.role,
                token: token,
                Eid: user.Eid,
                Name : user.name,
                Email : user.email
            });
        } else {
            console.log('Header found:', header);

            const ismatch = await bcrypt.compare(password, header.password);
            if (!ismatch) {
                return res.status(400).json({
                    message: 'Invalid password'
                });
            }
            
            const token = jwt.sign({ email: header.email, role: header.role }, JWT_SECRET, { expiresIn: '1h' });
            return res.status(200).json({
                message: 'Admin Head Login Successful',
                token: token,
                role: header.role,
            });
        }
        
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Server error'
        });
    }
});


    router.put('/updateProfileImage/:Eid', verifyToken, upload.single('profileimg'), async (req, res) => {
        try {
            const Eid = req.params.Eid;  
            const user = await CommonTeam.findOne({Eid:Eid});
    
            if (!user) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }
    
           
            if (!req.file) {
                return res.status(400).json({
                    message: 'Profile image is required'
                });
            }
    
            if (user.profileimg) {
                const oldImagePath = path.join(__dirname, '..', 'Assests', user.profileimg);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath); 
                }
            }
            
            
            const profileImgPath = req.file.filename;
    
            
            user.profileimg = profileImgPath;
            await user.save();
    
            return res.status(200).json({
                message: 'Profile image updated successfully',
                user: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    profileimg: user.profileimg,
                }
            });
        } catch (error) {
            return res.status(500).json({
                message: error.message
            });
        }
    });
    router.post('/registration', verifyToken, upload.fields([{ name: 'Fileupload', maxCount: 1 }, { name: 'profileimg', maxCount: 1 }]), async (req, res) => {
        console.log("req.body:", req.body);  
        
    
        const { error, value } = registervalidation(req.body); 
    
        if (error) {
            return res.status(400).json({
                message: error.details[0].message
            });
        }
    
        const { name, email, password, role, JOD, EOD, address, Currentsalary, CompanyResources, Remarks, contactnumber,givenStatus } = value;
        
        console.log("Files:", req.files);
        console.log('name',name);
    
        try {
            if (req.user.role !== "md") {
                return res.status(403).json({
                    message: 'Permission Denied, Only Admin Head can register'
                });
            }
    
            if (!name || !email || !password || !role || !contactnumber || !req.files['Fileupload']) {
                return res.status(400).json({
                    message: 'Name, email, password, role, contactnumber and resume are required'
                });
            }
    
            let employee = await CommonTeam.findOne({ email });
            if (employee) {
                return res.status(400).json({
                    message: 'Email already exists'
                });
            }
    
            const randomId = Math.floor(Math.random() * 1000000);
            const eid = `LOY-${randomId.toString().padStart(5, '0')}`;
            const hashPassword = await bcrypt.hash(password, 15);
            const fileUploadPath = req.files['Fileupload'] ? req.files['Fileupload'][0].filename : null;
            const profileImgPath = req.files['profileimg'] ? req.files['profileimg'][0].filename : null;
    
            const newEmployee = new CommonTeam({
                Eid: eid,
                name,
                email,
                password: hashPassword,
                role,
                address,
                Currentsalary,
                CompanyResources,
                Remarks,
                JOD,
                EOD,
                contactnumber,
                givenStatus,
                Fileupload: fileUploadPath,
                profileimg: profileImgPath,
                createdBy: req.user.email
            });
    
            const savedEmployee = await newEmployee.save();
    
            return res.status(200).json({
                message: " Registration Successful",
                user: {
                    name: savedEmployee.name,
                    email: savedEmployee.email,
                    role: savedEmployee.role,
                    Eid: savedEmployee.Eid,
                    createdBy: savedEmployee.createdBy,
                }
            });
    
        } catch (error) {
            return res.status(500).json({
                message: error.message
            });
        }
    });
    
router.put('/reset-password', async(req,res) =>{
    const { error, value } = ResetPasswordvalidation(req.body);
    if (error) {
      return res.status(400).json({
        message: error.details[0].message
      });
    }

     const {password,confirmPassword} = value;
     const {Eid} = req.body;

     if (!password||!confirmPassword ||!Eid) {
        return res.status(400).json({ message: 'Password is required' });
    }
    if(password !== confirmPassword){
        return res.status(400).json({message:'password do not match'});
    }
     try{
        
           
            const user = await CommonTeam.findOne({Eid});
            if (!user) {
                return res.status(400).json({ message: 'Invalid .' });
              }
              const hashedPassword = await bcrypt.hash(password, 10);
    
       const reset = await CommonTeam.updateOne({Eid },{$set:{password:hashedPassword}});
   
       if (reset.nModified === 0) {
        return res.status(404).json({ message: 'User not found or password is the same as before' });
    }
       return res.status(200).json({message:'successfully password is reseted'});

     }catch(err){
        return res.status(500).json('Internal error is occured',err)
     }
});
router.put('/reset-headerpassword',verifyToken,async(req,res) =>{
    
    if(req.user.role !== 'md'){
    
        return res.status(403).json({
            message: 'Permission Denied, Only Admin Head can register '
        });
    }
    const { error, value } = Headvalidation(req.body);
    if (error) {
      return res.status(400).json({
        message: error.details[0].message
      });
    }

    const {password,confirmpassword} = value;
   

    if (!password||!confirmpassword) {
       return res.status(400).json({ message: 'Password is required' });
   }
    try{
       
          
           const user = await Headregi.findOne({role: 'md'});
           if (!user) {
               return res.status(400).json({ message: 'Invalid .' });
             }
             const hashedPassword = await bcrypt.hash(password, 10);
   
      const reset = await Headregi.updateOne({role:'md'},{$set:{password:hashedPassword}});
  
      if (reset.nModified === 0) {
       return res.status(404).json({ message: 'User not found or password is the same as before' });
   }
      return res.status(200).json({message:'successfully password is reseted',reset});

    }catch(err){
       return res.status(500).json('Internal error is occured',err)
    }
});
router.put('/reset-email', verifyToken, async (req, res) => {
    if (req.user.role !== 'md') {
        return res.status(403).json({
            message: 'Permission Denied, Only Admin Head can register'
        });
    }
 
    const { error, value } = passwordvalidation(req.body);
    if (error) {
        return res.status(400).json({
            message: error.details[0].message
        });
    }
 
    const { email,name } = value;
    
 
    if (!name || !email) {
        return res.status(400).json({ message: 'Email  are required' });
    }
 
    try {
        const user = await Headregi.findOne({name:req.body.name,role: 'md' });
        if (!user) {
            return res.status(400).json({ message: 'User with the specified name not found.' });
        }
 
        const reset = await Headregi.updateOne({name,role: 'md' }, { $set: { email } });
 
        if (reset.nModified === 0) {
            return res.status(404).json({ message: 'User not found or email is the same' });
        }
 
        return res.status(200).json({ message: 'Email successfully updated' });
 
    } catch (err) {
        return res.status(500).json({ message: 'Internal error occurred', error: err });
    }
 });
 

router.get('/commonprofile/:Eid', verifyToken,async(req,res)=>{
    try{
      const getdata = await CommonTeam.findOne({Eid: req.params.Eid});
      if(getdata){
        const filepath = getdata. Fileupload;
        console.log({data:getdata,fileUrl:filepath});
       return res.status(200).json({message:'successfully the data is getted',data:getdata,fileUrl: filepath})
       
      }else{
        return res.status(404).json('no data is getted');
      }
       
    }catch(err){
        return res.status(500).json({messgae:'Internal server error'},err);
    }
});

router.get('/adminviewallprofile',verifyToken,async(req,res)=>{
    if (req.user.role !== 'md') {
        return res.status(403).json({
            message: 'Permission Denied, Only Admin Head can register '
        });
    }
    try{
      const getallprofile = await  CommonTeam.find({});
      if(!getallprofile){
        res.status(400).json({message:'No data found'});
      } 
       return res.status(200).json({message:'sucessfully getted data',getallprofile});
    }catch(err){
        return res.status(500).json({messgae:'Internal server error'},err);
    }
})

router.get('/admin-performance', verifyToken, async (req, res) => {
    if (req.user.role !== 'md') {
        return res.status(403).json({
            message: 'Permission Denied, Only Admin Head can view performance'
        });
    }

    try {
        const employees = await CommonTeam.find({
            role: { $in: ['sales head', 'Sales Employee', 'Lead filler'] }
        }).select('Eid name email role');

        const enquiries = await HeadEnquiry.find({}).select('Eid Status LeadDetails createdAt').lean();
        const convertedCustomers = await Customerconvertion.find({}).select('customerconvert').lean();
        const lostLeads = await CustomerNotConverted.find({}).select('Eid EnquiryNo createdAt').lean();

        const performanceMap = {};
        employees.forEach((employee) => {
            performanceMap[employee.Eid] = {
                Eid: employee.Eid,
                name: employee.name,
                email: employee.email,
                role: employee.role,
                assignedLeads: 0,
                hotLeads: 0,
                warmLeads: 0,
                coldLeads: 0,
                closedLeads: 0,
                lostLeads: 0,
                conversionRate: 0,
            };
        });

        enquiries.forEach((enquiry) => {
            if (!performanceMap[enquiry.Eid]) return;
            const record = performanceMap[enquiry.Eid];
            record.assignedLeads += 1;
            const priority = String(enquiry?.LeadDetails?.LeadPriority || '').toLowerCase();
            if (priority === 'high' || priority === 'hot') record.hotLeads += 1;
            else if (priority === 'medium' || priority === 'warm') record.warmLeads += 1;
            else record.coldLeads += 1;
        });

        convertedCustomers.forEach((customer) => {
            (customer.customerconvert || []).forEach((conversion) => {
                if (conversion.Convertedstatus === 'yes' && performanceMap[conversion.Eid]) {
                    performanceMap[conversion.Eid].closedLeads += 1;
                }
            });
        });

        lostLeads.forEach((lead) => {
            if (performanceMap[lead.Eid]) {
                performanceMap[lead.Eid].lostLeads += 1;
            }
        });

        const performance = Object.values(performanceMap)
            .map((record) => ({
                ...record,
                conversionRate: record.assignedLeads > 0
                    ? Math.round((record.closedLeads / record.assignedLeads) * 100)
                    : 0,
            }))
            .sort((a, b) => b.closedLeads - a.closedLeads || b.assignedLeads - a.assignedLeads);

        return res.status(200).json({ performance });
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error', error: err.message || err });
    }
});
router.get('/saleshead/:Eid',verifyToken,async(req,res)=>{
     
  try{
     const Allenquires = await CommonTeam.find(req.params.Eid)
     if (Allenquires && Allenquires.length > 0) {
        return res.status(200).json({ message: 'Successfully the data is fetched', data: Allenquires

         });
      } else {
        return res.status(404).json({ message: 'No data found' });
      }
  }catch(err){
    return res.status(500).json({messgae:'Internal server error'},err);
  }
})
router.post('/leadentry',verifyToken,async(req,res)=>{
    if(req.user.role!=='Lead filler'){
        return res.status(403).json({
            message: 'Permission Denied, Only Lead person can register '
        });
    }
    const {  LeadDetails, ContactDetails,AddressDetails,DescriptionDetails,Eid} = req.body;
     console.log(req.body);
    try{
     const randomId = Math.floor(Math.random()*1000000);
     const enquirynumber =  `ENQ-${randomId.toString().padStart(5,'0')}`;  

     const headEnquiry = new HeadEnquiry({
            LeadDetails,
            ContactDetails,
            AddressDetails,
            DescriptionDetails,
            Status:'Enquiry-1stage',
            EnquiryNo:enquirynumber,
            Eid,
            createdBy: req.user.role,
     })
     await headEnquiry.save();
       console.log(headEnquiry);
        res.status(200).json({message:'successfully posted',data:headEnquiry});
    }catch(err){
        return res.status(500).json({messgae:'Internal server error',err});
    }
})

router.delete('/leadenquiry/:EnquiryNo', verifyToken, async (req, res) => {
    if (!['md', 'sales head'].includes(req.user.role)) {
        return res.status(403).json({
            message: 'Permission denied. Only admin and sales head can delete leads.'
        });
    }

    try {
        const deleted = await HeadEnquiry.findOneAndDelete({ EnquiryNo: req.params.EnquiryNo });
        if (!deleted) {
            return res.status(404).json({ message: 'Lead enquiry not found' });
        }
        return res.status(200).json({ message: 'Lead enquiry deleted successfully', data: deleted });
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error', error: err.message || err });
    }
});
router.put('/assignedto', verifyToken, async (req, res) => {
    const { Eid, EnquiryNo } = req.body;
    console.log('Received Eid:', Eid);
    console.log('Received EnquiryNo:', EnquiryNo);

    
    if (!Eid || !EnquiryNo) {
        return res.status(400).json({ message: 'Eid and EnquiryNos are required.' });
    }
    let enquiryNumbers = [];
    if (Array.isArray(EnquiryNo)) {
        enquiryNumbers = EnquiryNo;
    } else if (typeof EnquiryNo === 'string') {
        enquiryNumbers = [EnquiryNo];  
    } else {
        return res.status(400).json({ message: 'EnquiryNos must be a string or an array.' });
    }

    try {
        console.log('Querying for EnquiryNos:', enquiryNumbers);
        const enquiriesToUpdate = await HeadEnquiry.find({
            EnquiryNo: { $in: enquiryNumbers },
            Status: 'Enquiry-1stage'
        });
        console.log('Enquiries found:', enquiriesToUpdate);
        if (enquiriesToUpdate.length === 0) {
            return res.status(404).json({ message: 'No enquiries found to update with the specified EnquiryNos and Status.' });
        }
        const updateAllocated = await HeadEnquiry.updateMany(
            { 
                EnquiryNo: { $in: enquiryNumbers },
                Status: 'Enquiry-1stage' 
            },
            { $set: { Eid, Status: 'Enquiry-2stage' } }
        );

        
        console.log('Update result:', updateAllocated);

       
        if (updateAllocated.nModified > 0) {
            const message = updateAllocated.nModified === 1 
                ? 'One enquiry updated successfully' 
                : `${updateAllocated.nModified} enquiries updated successfully`;
                console.log(message);
        } 

        return res.status(200).json({updateAllocated });
    } catch (err) {
        console.error('Error occurred:', err);
        return res.status(500).json({ message: 'Internal server error', error: err });
    }
});

router.get('/getenquiry/:Eid',verifyToken,async(req,res)=>{
    const {Eid} = req.params;
    console.log(req.params)
    try{
     const getdata = await HeadEnquiry.find({Eid:Eid , Status: 'Enquiry-1stage'});
     console.log(Eid);
     console.log(getdata);
     if (getdata && getdata.length > 0) {
        return res.status(200).json({
            message: 'Successfully retrieved data',
            totalResults: getdata.length,
            getdata
        });
    } else {
        return res.status(404).json({
            message: 'Enquiry data not found'
        });
    }
    }catch(err){
        return res.status(500).json({ message: 'Internal server error', error: err });
    }
})
router.get('/getenquiryforsaletam/:Eid',verifyToken,async(req,res)=>{
    const {Eid} = req.params;
    console.log(req.params)
    try{
     const getdatas = await HeadEnquiry.find({Eid:Eid }).sort({ createdAt: -1 });
     console.log(Eid);
     console.log(getdatas);
     if (getdatas && getdatas.length > 0) {
        return res.status(200).json({
            message: 'Successfully retrieved data',
            getdatas
        });
    } else {
        return res.status(404).json({
            message: 'Enquiry data not found'
        });
    }
    }catch(err){
        return res.status(500).json({ message: 'Internal server error', error: err });
    }
})

router.post('/customerconversion', verifyToken, async (req, res) => {
    try {
    
        const { EnquiryNo,PANnumber,GSTNnumber,CustomerDetails,BillingAddressDetails,DescriptionDetails,Eid } = req.body;
        
        if (!EnquiryNo) {
            return res.status(400).json('Missing required field: EnquiryNo');
        }

        if (!PANnumber || !GSTNnumber) {
            return res.status(400).json('Missing required CustomerDetails fields: PANnumber or GSTNnumber');
        }

        if (!CustomerDetails || !CustomerDetails.opportunitynumber) {
            return res.status(400).json('Missing required CustomerDetails field: opportunitynumber');
        }

        if (!BillingAddressDetails || !BillingAddressDetails.BillingAddress || !BillingAddressDetails.BillingCountry|| !BillingAddressDetails.BillingCity || !BillingAddressDetails.BillingPostalCode || !BillingAddressDetails.BillingState) {
            return res.status(400).json('Missing required BillingAddressDetails fields');
        }

      
        const customerDetails = await HeadEnquiry.findOne({ EnquiryNo: req.body.EnquiryNo });
        console.log("i get the enquirydetails",customerDetails);

        if (!customerDetails || !customerDetails.ContactDetails.MobileNumber || !customerDetails.ContactDetails.PrimaryMail) {
            return res.status(400).json('Missing required CustomerDetails: MobileNumber or PrimaryMail');
        }

        const existingCustomer = await Customerconvertion.findOne({
            PANnumber,
            GSTNnumber,
        });

        if (existingCustomer) {
            // Check if the EnquiryNo already exists in the customer's customerconvert array
            const existingConversion = existingCustomer.customerconvert.find(c => c.EnquiryNo === EnquiryNo);
            if (existingConversion) {
                return res.status(400).json('This enquiry has already been added to the customer');
            }

            // Prepare the new conversion data
            const newConversionData = {
                EnquiryNo,
                clientName: customerDetails.LeadDetails.clientName,
                CustomerDetails: {
                    MobileNumber: customerDetails.ContactDetails.MobileNumber,
                    PrimaryMail: customerDetails.ContactDetails.PrimaryMail,
                    opportunitynumber: req.body.CustomerDetails.opportunitynumber,
                },
                DescriptionDetails,
                BillingAddressDetails,
                Eid:req.body.Eid,
                Convertedstatus:'yes',
                Status: 'Enquiry-4thstage',
            };

            // Append the new conversion to the existing customerconvert array
            existingCustomer.customerconvert.push(newConversionData);

            // Save the updated customer document
            await existingCustomer.save();

            return res.status(200).json({
                message: 'Customer conversion added successfully',
                customer: existingCustomer,
            });
        } else {
            const randomId = Math.floor(Math.random() * 1000000);
            const customid = `CUS-${randomId.toString().padStart(5, '0')}`;
            const newCustomer = new Customerconvertion({
                PANnumber,
                GSTNnumber,
                companyName: customerDetails.LeadDetails.companyName,
                AddressDetails: customerDetails.AddressDetails,
                CustomerId: customid,
                customerconvert: [{
                    EnquiryNo,
                    clientName: customerDetails.LeadDetails.clientName,
                    CustomerDetails: {
                        MobileNumber: customerDetails.ContactDetails.MobileNumber,
                        PrimaryMail: customerDetails.ContactDetails.PrimaryMail,
                        opportunitynumber: req.body.CustomerDetails.opportunitynumber,
                    },
                    DescriptionDetails,
                    Convertedstatus:"yes",
                    BillingAddressDetails,
                    Eid:req.body.Eid,
                    Status: 'Enquiry-4thstage',
                }],
            });
            await newCustomer.save();

            return res.status(201).json({
                message: 'Customer conversion successful',
                customer: newCustomer,
            });
        }
    } catch (err) {
        console.error("Error occurred:", err);
        return res.status(500).json({
            message: 'Internal server error',
            error: err.message || err,
        });
    }
});

router.post('/customernotconverted', verifyToken, async (req, res) => {
    const { EnquiryNo, remarks, Eid } = req.body;  
  
    try {
        if (!Eid) {
            return res.status(400).json({ message: "Eid is required" });  
        }

        const notConverted = new CustomerNotConverted({
            EnquiryNo,
            remarks,
            Eid,  
            Convertedstatus: "no"  
        });

        await notConverted.save();  

        res.status(200).json({
            message: "Lead submitted successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error. Lead submission failed.' });
    }
});

  
  
  router.get('/getcustomerconverstion', verifyToken, async (req, res) => {
    const {Eid,EnquiryNo} = req.query;
    
    
    console.log("Received Eid:", Eid);
    console.log("Received EnquiryNo:", EnquiryNo);

    try {
        console.log("Received Eid:", Eid);
    console.log("Received EnquiryNo:", EnquiryNo);
        const getcustomerdata = await Customerconverstion.findOne({
            Eid: Eid,
            EnquiryNo: EnquiryNo,
            Status: 'Enquiry-4thstage'
        }).exec(); 
        if (!getcustomerdata) {
            return res.status(404).json({ message: 'No customer data found for the given enquiry' });
        }
         console.log('get the data',getcustomerdata);
        res.status(200).json({ message: 'Successfully fetched the data', getcustomerdata });
    } catch (err) {
        console.error("Error:", err);
        return res.status(500).json({ message: 'Internal server error', error: err.message || err });
    }
});



router.get('/getcustomerdetails/:Eid', verifyToken, async (req, res) => {
    try {
        const { Eid } = req.params;  // Capture Eid from the URL parameter
        console.log("Received Eid:", Eid);

        const getcustomerdata = await Customerconverstion.find({
            Eid,
            Status: 'Enquiry-4thstage'
        }).exec();

        if (getcustomerdata.length === 0) {
            return res.status(404).json({ message: 'No customer data found for the given enquiry' });
        }

        console.log('Fetched data:', getcustomerdata);
        res.status(200).json({ message: 'Successfully fetched the data', getcustomerdata });
    } catch (err) {
        console.error("Error:", err);
        return res.status(500).json({ message: 'Internal server error', error: err.message || err });
    }
});

router.get('/getsalesheadEid',verifyToken,async(req,res)=>{
    try{
        const getallprofile = await  CommonTeam.find({role: 'sales head'});
        
        if(!getallprofile || getallprofile.length === 0){
          res.status(400).json({message:'No data found'});
        } 
         return res.status(200).json({message:'sucessfully getted data',getallprofile});
    }catch(err){
        console.error("Error:", err);
        return res.status(500).json({ message: 'Internal server error', error: err.message || err });
    }
});
router.get('/getsalesemployeeEid',verifyToken,async(req,res)=>{
    try{
        const getallEid = await  CommonTeam.find({role: 'Sales Employee'});
        if(!getallEid){
          res.status(400).json({message:'No data found'});
        } 
         return res.status(200).json({message:'sucessfully getted data',getallEid});
    }catch(err){
        console.error("Error:", err);
        return res.status(500).json({ message: 'Internal server error', error: err.message || err });
    }
});   
router.get('/salesheadviewallprofile',verifyToken,async(req,res)=>{
    if (req.user.role === 'sales head') {
        return res.status(403).json({
            message: 'Permission Denied, Only Admin Head can register '
        });
    }
    try{
      const getallprofile = await  CommonTeam.find({role:'Sales Employee'});
      if(!getallprofile){
        res.status(400).json({message:'No data found'});
      } 
       return res.status(200).json({message:'sucessfully getted data',getallprofile});
    }catch(err){
        return res.status(500).json({messgae:'Internal server error'},err);
    }
})
router.post('/service&project', verifyToken, async (req, res) => {
    console.log("req.body:", req.body);

    const { error, value } = Servicevalidation(req.body);

    if (error) {
        return res.status(400).json({
            message: error.details[0].message
        });
    }

    const {
        name,
        companyName,
        clientName,
        Date,
        Location,
        MachineName,
        ProductDescription,
        Problems,
        Eid,
        financialYear
    } = value;

    if (!name || !companyName || !clientName || !Date || !Location || !MachineName || !Eid || !ProductDescription || !Problems || !financialYear) {
        return res.status(400).json({
            message: 'Required fields are missing'
        });
    }

    try {
        // Count existing records in that financial year
        const count = await ServiceEngineervisit.countDocuments({ financialYear });

        // Format ReportNo: pad number with leading zero if needed
        const reportNumber = `${financialYear}/${(count + 1).toString().padStart(2, '0')}`;

        const newWork = new ServiceEngineervisit({
            name,
            ReportNo: reportNumber,
            companyName,
            clientName,
            Eid,
            Date,
            Location,
            MachineName,
            ProductDescription,
            Problems: Problems, // Assuming 'Problem' is an array
            Status: 'work-status',
            financialYear
        });

        const workform = await newWork.save();

        return res.status(200).json({
            message: "Registration Successful",
            user: {
                name: workform.name,
                ReportNo: workform.ReportNo,
                companyName: workform.companyName,
                clientName: workform.clientName,
                Eid: workform.Eid,
                Date: workform.Date,
                Location: workform.Location,
                MachineName: workform.MachineName,
                ProductDescription: workform.ProductDescription,
                Problems: workform.Problems,
                financialYear: workform.financialYear
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
});        

router.get('/get-workvisit', async (req, res) => {
    try {
      const { ReportNo } = req.query; 
  
      // Fetch only the required fields from the database
      const result = await ServiceEngineervisit.findOne({ ReportNo }, 'ReportNo name MachineName');
  
      if (!result) return res.status(404).json({ message: "Not Found" });
  
      res.json(result);
    } catch (err) {
      console.error("Fetch error:", err);
      res.status(500).json({ message: "Server Error" });
    }
  });

  router.post('/productrequest', verifyToken, async (req, res) => {
    console.log("req.body:", req.body);
  
    const {
      name,
      email,
      companyName,
      Eid,
      Description,
      contactpersonname,
      productDetails,  
      Employeeid,
    } = req.body;
  
    try {
      if (!name || !email || !Employeeid || !Eid || !productDetails || productDetails.length === 0) {
        return res.status(400).json({
          message: 'Name, email, Employee ID, assigning ID, and at least one product are required.',
        });
      }
  
      const newWork = new Productrequest({
        Eid,
        name,
        email,
        companyName,
        Description,
        Employeeid,
        contactpersonname,
        productDetails,  
        Status: 'products-status',
      });
  
      const savedEmployee = await newWork.save();
  
      return res.status(200).json({
        message: "Registration Successful",
        user: {
          name: savedEmployee.name,
          email: savedEmployee.email,
          Eid: savedEmployee.Eid,
          Description: savedEmployee.Description,
          Employeeid: savedEmployee.Employeeid,
        },
      });
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).json({
        message: error.message,
      });
    }
  });
  




router.get('/headenquiry', verifyToken, async (req, res) => {
    try {
      if (req.user.role !== 'sales head') {
        return res.status(403).json({
          message: 'Access denied. You must be a Sales Head to view this data.'
        });
      }
  
      const enquiries = await HeadEnquiry.find({
        Status: { $ne: 'Enquiry-1stage' }  
      }).sort({ createdAt: -1 });
  
      if (enquiries.length === 0) {
        return res.status(404).json({
          message: 'No enquiries found except Stage 1'
        });
      }
  
      res.json(enquiries);
    } catch (error) {
      console.error('Error fetching enquiries:', error);
      res.status(500).json({
        message: 'Error fetching enquiries',
        error: error.message
      });
    }
  });
  
  
  router.put('/quotation', verifyToken, async (req, res) => {
    const { EnquiryNo } = req.body;

    if (!EnquiryNo) {
        return res.status(400).json({
            message: 'EnquiryNo is required',
        });
    }

    try {
        const quatation = await HeadEnquiry.updateOne(
            { EnquiryNo: EnquiryNo, Status: 'Enquiry-2stage' },
            { $set: { Status: 'Enquiry-3stage' } } 
        );

     

        return res.status(200).json({
            message: 'Quotation status updated successfully',
            enquiryNo: EnquiryNo,
        });
    } catch (err) {
        console.error('Error:', err);
        return res.status(500).json({
            message: 'Internal server error',
            error: err.message || err,
        });
    }
});
  
router.put('/Enquiries/:EnquiryNo', verifyToken, async (req, res) => {
    const EnquiryNo = req.params.EnquiryNo;
    console.log('Received enquiryNo:', EnquiryNo);

    try {
        // Check if enquiry exists in Customerconverstion collection (check the customerconvert array for EnquiryNo)
        const enquiryExists = await Customerconvertion.findOne({
            "customerconvert.EnquiryNo": EnquiryNo
        });

        console.log('Enquiry Found:', enquiryExists);

        if (!enquiryExists) {
            return res.status(404).json({ message: 'Enquiry not found in customerconvert collection' });
        }

        // Find the specific subdocument with EnquiryNo and Status "Enquiry-4thstage"
        const enquiryToUpdate = await Customerconvertion.findOne({
            "customerconvert.EnquiryNo": EnquiryNo,
            "customerconvert.Status": 'Enquiry-4thstage'
        });

        if (!enquiryToUpdate) {
            return res.status(404).json({ message: 'Enquiry not found or Status is not "Enquiry-4thstage"' });
        }

        // Update the Status of the matching subdocument inside the customerconvert array
        const updatedEnquiry = await Customerconvertion.findOneAndUpdate(
            { "customerconvert.EnquiryNo": EnquiryNo, "customerconvert.Status": "Enquiry-4thstage" },
            { $set: { "customerconvert.$.Status": "completed" } },
            { new: true }
        );
        
        // Find the specific subdocument you just updated
        const updatedSubdocument = updatedEnquiry.customerconvert.find(enquiry => enquiry.EnquiryNo === EnquiryNo);
        
        if (!updatedSubdocument) {
            return res.status(404).json({ message: 'Enquiry subdocument not found after update' });
        }
        
        res.status(200).json(updatedSubdocument);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/getenquiries/:Eid', verifyToken, async (req, res) => {
    const { Eid } = req.params;

    if (!Eid) {
        return res.status(400).json({ message: 'Eid is required' });
    }

    console.log("Received Eid:", Eid);  

    try {
        const customerData = await Customerconvertion.find({
            "customerconvert": {
                $elemMatch: {
                    "Eid": Eid,  
                    "Status": "Enquiry-4thstage"  
                }
            }
        });

        if (!customerData || customerData.length === 0) {
            return res.status(404).json({ message: 'No customer conversation found for the provided Eid and Enquiry Stage 4' });
        }

        const allConversations = [];

        customerData.forEach(customer => {
            const conversations = customer.customerconvert.filter(item => item.Eid === Eid && item.Status === "Enquiry-4thstage");

            if (conversations.length > 0) {
                allConversations.push(...conversations); 
            }
        });

        if (allConversations.length === 0) {
            return res.status(404).json({ message: 'No conversations found for the provided Eid and Enquiry Stage 4' });
        }

        const response = {
            customerData: {
                allConversations
            }
        };

        return res.status(200).json(response);

    } catch (err) {
        console.error("Error:", err);
        return res.status(500).json({ message: 'Internal server error', error: err.message || err });
    }
});






router.get('/todayviewleadenquiry', verifyToken, async (req, res) => {
    try {
        
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);  

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);  

        
        const viewenquiries = await HeadEnquiry.find({
            createdAt: { $gte: todayStart, $lte: todayEnd }  
        }).select(' EnquiryNo LeadDetails ContactDetails AddressDetails DescriptionDetails createdAt').sort({ createdAt: -1 });  

        if (!viewenquiries || viewenquiries.length === 0) {
            return res.status(400).json({
                message: 'No data available'
            });
        }
        console.log('viewleadenquiryesdetails', viewenquiries);

        return res.status(200).json(viewenquiries);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
});

router.put('/assignedtoservice', verifyToken, async (req, res) => {
    const { Eid,EnquiryNo } = req.body;
    console.log('Received Eid:', Eid);
    console.log('Received EnquiryNo:', EnquiryNo);

    
    if (!Eid || !EnquiryNo) {
        return res.status(400).json({ message: 'Eid and EnquiryNos are required.' });
    }
    let enquiryNumbers = [];
    if (Array.isArray(EnquiryNo)) {
        enquiryNumbers = EnquiryNo;
    } else if (typeof EnquiryNo === 'string') {
        enquiryNumbers = [EnquiryNo];  
    } else {
        return res.status(400).json({ message: 'EnquiryNos must be a string or an array.' });
    }

    try {
        console.log('Querying for EnquiryNos:', enquiryNumbers);
        const enquiriesToUpdate = await HeadEnquiry.find({
            EnquiryNo: { $in: enquiryNumbers },
            Status: 'Enquiry-2stage'
        });
        console.log('Enquiries found:', enquiriesToUpdate);
        if (enquiriesToUpdate.length === 0) {
            return res.status(404).json({ message: 'No enquiries found to update with the specified EnquiryNos and Status.' });
        }
        const updateAllocated = await HeadEnquiry.updateMany(
            { 
                EnquiryNo: { $in: enquiryNumbers },
                Status: 'Enquiry-2stage' 
            },
            { $set: { Eid} }
        );

        
        console.log('Update result:', updateAllocated);

       
        if (updateAllocated.nModified > 0) {
            const message = updateAllocated.nModified === 1 
                ? 'One enquiry updated successfully' 
                : `${updateAllocated.nModified} enquiries updated successfully`;
                console.log(message);
        } 

        return res.status(200).json({updateAllocated });
    } catch (err) {
        console.error('Error occurred:', err);
        return res.status(500).json({ message: 'Internal server error', error: err });
    }
});

router.get('/getotheremployeeEid',verifyToken,async(req,res)=>{
    try{
        const getallothersEid = await  CommonTeam.find({ role: { $in: ['Service Engineer', 'Engineer'] } });
        if(!getallothersEid){
          res.status(400).json({message:'No data found'});
        } 
         return res.status(200).json({message:'sucessfully getted data',getallothersEid});
    }catch(err){
        console.error("Error:", err);
        return res.status(500).json({ message: 'Internal server error', error: err.message || err });
    }
});


  
router.post('/productrequest', verifyToken, async (req, res) => {
    
    console.log("req.body:", req.body);  
        
    
        const { error, value } = Productvalidation(req.body); 
    
        if (error) {
            return res.status(400).json({
                message: error.details[0].message
            });
        }
    
    
    const { name, email, companyname,Eid,Description,contactpersonname,quantity,productname,Employeeid } = value;
    console.log("req.body:", req.body);
    try {   
        const user = req.user;
        console.log(user); 

        if (!name || !email || !Employeeid ||!Eid) {
            return res.status(400).json({
                message: 'Name, email, Fileupload, and assigningId are required'
            });
        }
       

        const newWork = new Productrequest({
            Eid,  
            name,
            email,
            companyname,
            Description,
            Employeeid,
            contactpersonname,
            quantity,
            productname,
            Status: 'products-status',
            
        });

        const savedEmployee = await newWork.save();

        return res.status(200).json({
            message: "Registration Successful",
            user: {
                name: savedEmployee.name,
                email: savedEmployee.email,
                Eid: savedEmployee.Eid,
                Description: savedEmployee.Description,
                Employeeid: savedEmployee.Employeeid
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
});

router.get('/alldayleadenquiry', verifyToken, async (req, res) => {
    try {
       
        const { fromDate, toDate } = req.query;  
        
        const dateFilter = {};
        if (fromDate) dateFilter.createdAt = { $gte: new Date(fromDate) };
        if (toDate) {
            if (!dateFilter.createdAt) dateFilter.createdAt = {};
            dateFilter.createdAt.$lte = new Date(toDate);
        }

        // Fetching enquiries based on the date range
        const viewenquiries = await HeadEnquiry.find({
            ...dateFilter
        }).sort({ createdAt: -1 });

        // If no enquiries are found
        if (!viewenquiries || viewenquiries.length === 0) {
            return res.status(400).json({
                message: 'No data available'
            });
        }

        // Returning the found enquiries
        return res.status(200).json(viewenquiries);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
});
router.post('/servicedetails', verifyToken, async (req, res) => {
    if (req.user.role !== 'Service Engineer') {
      return res.status(403).json({
        message: 'Permission Denied, Only Service Engineer access'
      });
    }
  
    console.log("req.body:", req.body);
  
    const { error, value } = servicedetailsvalidation(req.body);
  
    if (error) {
      return res.status(400).json({
        message: error.details[0].message
      });
    }
  
    const {
      Customerinward,
      clientName,
      quantity,
      servicestartdate,
      serviceenddate,
      Eid,
      Material,
      Model,
      SerialNo,
      Employeeid,
      powerconsumption,
      serviceStatus,
      BillingStatus,
      customerComplaint,
      engineerProblem
    } = value;
  
    try {
      const servicework = new Servicedetails({
        Customerinward,
        clientName,
        quantity,
        servicestartdate, // Use this directly (not renamed to Date)
        serviceenddate,
        Eid,
        Material,
        Model,
        SerialNo,
        Employeeid,
        powerconsumption,
        serviceStatus, // No renaming here either
        BillingStatus,
        customerComplaint,
        engineerProblem,
        financialYear: "2024-25", // Optional: You can calculate dynamically if needed
        name: req.user.name,
        companyName: req.user.companyName
      });
  
      const savedservice = await servicework.save();
  
      return res.status(200).json({
        message: "Registration Successful",
        user: {
          Eid: savedservice.Eid,
          Employeeid: savedservice.Employeeid,
          Customerinward: savedservice.Customerinward
        }
      });
  
    } catch (error) {
      return res.status(500).json({
        message: error.message
      });
    }
  });
  
  router.get('/getservicedetails',verifyToken,async(req,res)=>{
    try{
 
      const getdata = await  Servicedetails.find({});
      if(!getdata){
        return res.status(404).json({
            message: 'No data available'
        });
      }
      return res.status(200).json({
        message:"successfully i getted the data",
        getdata
      });

    }catch(error){
        return res.status(500).json({
            message: error.message
        });
    }
})    
router.get('/assignservicedetails/:Eid',verifyToken,async(req,res)=>{
    try{
   
      const getdata = await  Servicedetails.find({Eid:req.body.Eid});
      if(!getdata){
        return res.status(404).json({
            message: 'No data available'
        });
      }
      return res.status(200).json({
        message:"successfully i getted the data"
      });

    }catch(error){
        return res.status(500).json({
            message: error.message
        });
    }
})

router.get('/getname', verifyToken, async (req, res) => {
    try {
      const { Eid } = req.query; // Accessing Eid from query params
      if (!Eid) return res.status(400).json({ message: "Eid is required" });
  
      const getnames = await CommonTeam.findOne({ Eid });
      if (!getnames) return res.status(404).json({ message: "Name not found" });
  
      res.status(200).json({ name: getnames.name });
    } catch (error) {
      console.error("Server Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });   
  router.get('/getname&email', verifyToken, async (req, res) => {
    try {
      const { Eid } = req.query; 
      if (!Eid) return res.status(400).json({ message: "Eid is required" });
  
      const getnames = await CommonTeam.findOne({ Eid });
      if (!getnames) return res.status(404).json({ message: "Name not found" });
  
      res.status(200).json({ name: getnames.name,email:getnames.email });
    } catch (error) {
      console.error("Server Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  router.get('/getCompanyresource', verifyToken, async (req, res) => {
    try {
      const getcompanyresource = await CommonTeam.find();
  
      if (!getcompanyresource || getcompanyresource.length === 0) {
        return res.status(404).json({ message: "No data found" });
      }
  
      const companyDetails = getcompanyresource.map(item => ({
        name: item.name,
        Eid: item.Eid,
        JOD: item.JOD,
        EOD: item.EOD,
        CompanyResources: item.CompanyResources || [] 
      }));
  
      res.status(200).json(companyDetails);
    } catch (error) {
      console.error("Server Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  router.put('/updateCompanyresource/:Eid', verifyToken, async (req, res) => {
    try {
      const { EOD, givenStatus, Thingsname } = req.body;
      const { Eid } = req.params;
  
      // Input validation
      if (!EOD || !givenStatus || !Thingsname) {
        return res.status(400).json({ message: "Missing required fields" });
      }
  
      const updateResult = await CommonTeam.updateOne(
        {
          "Eid": Eid,
          "CompanyResources.Thingsname": Thingsname,
        },
        {
          $set: {
            "CompanyResources.$.EOD": EOD,
            "CompanyResources.$.givenStatus": givenStatus,
          },
        }
      );
  
      if (updateResult.modifiedCount === 0) {
        return res.status(404).json({ message: "No matching record found to update" });
      }
  
      res.status(200).json({ message: "Updated Successfully", updateResult });
    } catch (error) {
      console.error("Server Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  router.get('/getUserData/:Eid', verifyToken, async (req, res) => {
    const { Eid } = req.params;
  
    try {
      const users = await Productrequest.find({ Eid }); // Changed from findOne to find
  
      if (!users || users.length === 0) {
        return res.status(404).json({ message: "No user data found for this Eid" });
      }
  
      console.log("Fetched users from DB:", users);
  
      // Just return all the records (or you can process them further if needed)
      return res.status(200).json(users);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });
  router.get('/workvisit/:Eid', async (req, res) => {
    const { Eid } = req.params;
    try {
      // Changed findOne() to find() to get all matching records
      const serviceEngineers = await ServiceEngineervisit.find({ Eid });
      
      if (serviceEngineers.length === 0) {
        return res.status(404).json({
          message: 'No Service Engineers found with the provided Eid'
        });
      }
      
      return res.status(200).json({
        message: 'Service Engineer details fetched successfully',
        serviceEngineers // Now returning an array
      });
    } catch (error) {
      console.error("Error fetching service engineers:", error);
      return res.status(500).json({
        message: error.message
      });
    }
  });
router.get('/getservicedetails/:Employeeid', verifyToken, async (req, res) => {
    try {
        const { Employeeid } = req.params; 

        const getdata = await Servicedetails.find({ Employeeid });

        if (!getdata || getdata.length === 0) {
            return res.status(404).json({
                message: 'No data available for this Employeeid'
            });
        }

        return res.status(200).json({
            message: "Successfully retrieved the data",
            data: getdata // Send the actual data
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
});
router.put('/servicedetails/:id', verifyToken, async (req, res) => {
    const { id } = req.params; // _id or Employeeid
    console.log('Received ID:', id);
    console.log('Received req.body:', req.body);
  
    try {
        const updatedService = await Servicedetails.updateOne(
            { _id: id }, // or use Employeeid if needed
            { $set: req.body }
        );
  
        console.log('Updated Service:', updatedService);
  
        return res.status(200).json({
            message: 'Service details updated successfully',
            id
        });
    } catch (err) {
        console.error('Error:', err);
        return res.status(500).json({
            message: 'Internal server error',
            error: err.message || err
        });
    }
  });    
 router.delete('/deleteCompanyresource/:Eid/:Thingsname', verifyToken, async (req, res) => {
  try {
    const { Eid, Thingsname } = req.params;

    // Input validation
    if (!Eid || !Thingsname) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await CommonTeam.updateOne(
      { "Eid": Eid },
      { $pull: { "CompanyResources": { "Thingsname": Thingsname } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Resource not found or already deleted" });
    }

    res.status(200).json({ message: "Resource deleted successfully", result });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.get('/workvisit', async (req, res) => {
    try {
        const serviceEngineers = await ServiceEngineervisit.find(); 
        
        if (serviceEngineers.length === 0) {
            return res.status(404).json({
                message: 'No service engineers found'
            });
        }

        return res.status(200).json({
            message: 'Service Engineers details fetched successfully',
            serviceEngineers
        });

    } catch (error) {
        console.error("Error fetching service engineers:", error);  
        return res.status(500).json({
            message: error.message
        });
    }
});
router.get('/productrequests', async (req, res) => {
    try {
        const productRequests = await Productrequest.find();  
        return res.status(200).json({
            message: 'Product requests fetched successfully',
            productRequests
        });
    } catch (error) {
        console.error('Error fetching product requests:', error);
        return res.status(500).json({
            message: 'Error fetching product requests',
            error: error.message
        });
    }
});
router.post('/Quatation', verifyToken, async (req, res) => {
    try {
      const {
        products,
        Eid,
        EnquiryNo,
        Paymentdue,
        validity,
        Warranty,
        Delivery,
        Discount,
        Gst,
        PayableAmount,
        financialYear,
        isRevision,
        referenceToRevise,
        Status,
        LP,
        discount,
      } = req.body;
  
      // Validation
      if (!Eid || !products || !financialYear) {
        return res.status(400).json({
          message: 'Eid, products, and financialYear are required',
        });
      }
  
      // Validate product items
      for (const product of products) {
        if (!product.HSNCode || !product.UnitDescription || !product.Description || !product.UOM || !product.UnitPrice) {
          return res.status(400).json({
            message: 'All product fields (HSN Code, Unit Description, Description, UOM, Unit Price) are required',
          });
        }
      }
  
      const prefix = `LAP/OFF/${financialYear}`;
      let ReferenceNumber;
  
      if (isRevision && referenceToRevise) {
        // Revision flow: Use the same reference number as the original
        const existingQuotation = await Quatation.findOne({
          ReferenceNumber: referenceToRevise,
        });
  
        if (!existingQuotation) {
          return res.status(404).json({
            message: 'Original quotation not found for revision',
          });
        }
  
        ReferenceNumber = referenceToRevise; // Reuse the original reference number
      } else {
        // New quotation flow
        const allQuotations = await Quatation.find({
          ReferenceNumber: { $regex: `^${prefix}/\\d+$` } // Match reference numbers without revisions
        });
  
        let maxSerial = 0;
  
        for (const quote of allQuotations) {
          const refParts = quote.ReferenceNumber.split('/');
          if (refParts.length === 4) {
            const serialPart = refParts[3]; // e.g., "03"
            const serialNum = parseInt(serialPart, 10);
            if (!isNaN(serialNum) && serialNum > maxSerial) {
              maxSerial = serialNum;
            }
          }
        }
  
        const nextSerial = (maxSerial + 1).toString().padStart(2, '0');
        ReferenceNumber = `${prefix}/${nextSerial}`;
      }
  
      // Create a new quotation
      const newQuotation = new Quatation({
        products,
        LP,
        discount,
        Eid,
        EnquiryNo,
        Paymentdue,
        validity,
        Warranty,
        Delivery,
        Discount,
        Gst,
        PayableAmount,
        Status: Status || 'quotsreq',
        ReferenceNumber,
        financialYear,
        isRevision: !!isRevision,
        referenceToRevise: isRevision ? referenceToRevise : null
      });
  
      // Save the new quotation to the database
      const savedQuotation = await newQuotation.save();
  
      return res.status(200).json({
        message: isRevision ? 'Quotation revised successfully' : 'Quotation registered successfully',
        referenceNumber: savedQuotation.ReferenceNumber,
        quotation: savedQuotation
      });
    } catch (error) {
      console.error('Error posting the data:', error);
      return res.status(500).json({
        message: 'Error creating quotation',
        error: error.message,
      });
    }
  });
  
  
  

    router.put('/Quatationreq/:EnquiryNo', verifyToken, async (req, res) => {
        const { EnquiryNo } = req.params;
        console.log("Received EnquiryNo:", EnquiryNo);  // Debugging the incoming EnquiryNo
        
        try {
            // Find the quotation by EnquiryNo
            const quotation = await Quatation.findOne({ EnquiryNo });
        
            if (!quotation) {
                return res.status(404).json({ message: 'Quotation not found.' });
            }
        
            // Debugging: Log the current status and its length
            console.log("Quotation Status:", quotation.Status, "Length:", quotation.Status.length);
        
            // Check if the current status is exactly 'quotsreq'
            if (quotation.Status.trim().toLowerCase() !== 'quotsreq') {
                return res.status(400).json({
                    message: 'Status is not "Quotsreq". Cannot update to "Quotsaccess".',
                    currentStatus: quotation.Status
                });
            }
        
            // Proceed with the update if the status is valid
            const updateResult = await Quatation.updateOne(
                { EnquiryNo },
                { $set: { Status: 'quotsaccess' } }
            );
        
            if (updateResult.modifiedCount === 0) {
                return res.status(404).json({ message: 'No matching quotation found to update.' });
            }
        
            return res.status(200).json({
                message: "Update Successful",
                status: 'quotsaccess'
            });
        } catch (error) {
            console.error('Error updating the quotation:', error);
            return res.status(500).json({
                message: 'Error updating quotation',
                error: error.message
            });
        }
    });
    
    router.get('/quotationGetOne/:EnquiryNo/:Eid', verifyToken, async (req, res) => {
        const { EnquiryNo, Eid } = req.params;
      
        try {
          // Fetch the latest 'quotsaccess' quotation
          const getQuotationData = await Quatation.find({
            EnquiryNo: EnquiryNo,
            Eid: Eid,
            Status: "quotsaccess"
          }).sort({ updatedAt: -1 }).limit(1);
      
          // Check if quotation was not found
          if (!getQuotationData || getQuotationData.length === 0) {
            return res.status(404).json({
              message: "Quotation not found",
              data: null
            });
          }
      
          const quote = getQuotationData[0]; // Get the first (latest) result
      
          // Respond with the fetched quotation data
          return res.status(200).json({
            message: "Latest quotation fetched successfully",
            data: {
              Eid: quote.Eid,
              EnquiryNo: quote.EnquiryNo,
              products: quote.products,
              Paymentdue: quote.Paymentdue,
              validity: quote.validity,
              Warranty: quote.Warranty,
              Delivery: quote.Delivery,
              Discount: quote.Discount,
              PayableAmount: quote.PayableAmount,
              Gst: quote.Gst,
              Status: quote.Status,
              ReferenceNumber: quote.ReferenceNumber,
              createdAt: quote.createdAt,
              updatedAt: quote.updatedAt
            }
          });
        } catch (err) {
          console.error("Error fetching the data:", err);
      
          return res.status(500).json({
            message: "Error fetching the data",
            error: err.message
          });
        }
      });
      
    
       
        
          router.get('/quationgetmany', verifyToken, async (req, res) => {
            try {
              const quotations = await Quatation.find({ Status: "quotsreq" });
          
              if (quotations.length === 0) {
                return res.status(404).json({ message: "No quotations found with status 'quotsreq'" });
              }
          
              const formattedQuotations = quotations.map(quotation => quotation.toObject());
          
              return res.status(200).json({ message: "Data fetched successfully", formattedQuotations });
            } catch (err) {
              return res.status(500).json({ message: "Error fetching data", error: err.message });
            }
          });
          
          router.get('/quationgeteditmany', verifyToken, async (req, res) => {
            try {
              const getquationdatas = await Quatation.find({ Status: "Editreq" });
          
              if (getquationdatas.length === 0) {
                return res.status(404).json({ message: "No data found for editing" });
              }
          
              const formeditedquotation = getquationdatas.map(editquotation => editquotation.toObject());
              console.log("i get the edted data",getquationdatas)
              return res.status(200).json({formeditedquotation });
            } catch (err) {
              return res.status(500).json({ message: "Error fetching the data", error: err.message });
            }
          });
          
          router.put('/editQuotation', verifyToken, async (req, res) => {
            try {
              const { EnquiryNo, revisedVersion,Eid, ...updateFields } = req.body;
              
              if (!EnquiryNo) {
                return res.status(400).json({ message: "EnquiryNo is required." });
              }
              
              // Remove _id to avoid conflicts when creating a new document
              delete updateFields._id;
              
              // Fetch the existing quotation
              const existingQuotation = await Quatation.findOne({ EnquiryNo });
              
              if (!existingQuotation) {
                return res.status(404).json({ message: "Quotation not found." });
              }
              
              // Prepare the new revision document
              const newRevisionData = {
                ...existingQuotation.toObject(),  // Copy all fields from existing document
                ...updateFields,                  // Override with new fields from request
                Status: "Editreq",                // Set default status
                isRevision: true,                 // Mark as revision
                referenceToRevise: existingQuotation.ReferenceNumber  // Reference the original
              };
              
              // Remove MongoDB-specific fields
              delete newRevisionData._id;
              delete newRevisionData.__v;
              
              let newReferenceNumber;
              
              if (revisedVersion) {
                // Extract base ref before 'R'
                const baseRef = existingQuotation.ReferenceNumber.split('R')[0];
                newReferenceNumber = `${baseRef}R${revisedVersion.replace(/^R/, '')}`;
              } else {
                // If no explicit revision number, calculate the next revision number
                const baseRef = existingQuotation.ReferenceNumber.split('R')[0];
                
                // Find the latest revision for this base reference
                const revisionPattern = new RegExp(`^${baseRef}R\\d+$`);
                const allRevisions = await Quatation.find({
                  ReferenceNumber: { $regex: revisionPattern }
                }).sort({ ReferenceNumber: -1 });
                
                let newRevNumber = 1;
                
                if (allRevisions && allRevisions.length > 0) {
                  const lastRevision = allRevisions[0];
                  const revParts = lastRevision.ReferenceNumber.split('R');
                  if (revParts.length > 1) {
                    const lastRevNumber = parseInt(revParts[1]);
                    if (!isNaN(lastRevNumber)) {
                      newRevNumber = lastRevNumber + 1;
                    }
                  }
                }
                
                newReferenceNumber = `${baseRef}R${newRevNumber}`;
              }
              
              // Set the new reference number
              newRevisionData.ReferenceNumber = newReferenceNumber;
              
              // Create a new document instead of updating
              const newQuotation = new Quatation(newRevisionData);
              await newQuotation.save();
              
              return res.status(200).json({
                message: "Quotation revision created successfully",
                status: "Editreq",
                newReferenceNumber: newReferenceNumber
              });
              
            } catch (error) {
              console.error('Error creating quotation revision:', error);
              return res.status(500).json({
                message: 'Error creating quotation revision',
                error: error.message,
              });
            }
          });
          
    
          router.put('/editAccessQuotation/:EnquiryNo', verifyToken, async (req, res) => {
            const { EnquiryNo } = req.params;
        
            try {
                // Find the latest quotation with the given EnquiryNo and status 'Editreq'
                const latestQuotation = await Quatation.findOne({ EnquiryNo, Status: 'Editreq' })
                    .sort({ createdAt: -1 }); // Sort by newest createdAt
        
                if (!latestQuotation) {
                    return res.status(404).json({
                        message: 'No quotation with status "Editreq" found for the given EnquiryNo.'
                    });
                }
        
                // Update the status to 'Editaccess'
                const updateResult = await Quatation.updateOne(
                    { _id: latestQuotation._id },
                    { $set: { Status: 'Editaccess' } }
                );
        
                if (updateResult.modifiedCount === 0) {
                    return res.status(500).json({ message: 'Failed to update quotation status.' });
                }
        
                return res.status(200).json({
                    message: 'Update Successful',
                    EnquiryNo: latestQuotation.EnquiryNo,
                    ReferenceNumber: latestQuotation.ReferenceNumber,
                    updatedStatus: 'Editaccess'
                });
        
            } catch (error) {
                console.error('Error updating the quotation:', error);
                return res.status(500).json({
                    message: 'Error updating quotation',
                    error: error.message
                });
            }
        });
        
        router.put('/mdeditQuotation', verifyToken, async (req, res) => {
          try {
            // Destructure and extract necessary fields from request body
            const { _id, EnquiryNo, ReferenceNumber, Status, products, validity, ...updateFields } = req.body;
        
            if (!_id) {
              return res.status(400).json({ message: "_id is required." });
            }
        
            if (!EnquiryNo) {
              return res.status(400).json({ message: "EnquiryNo is required." });
            }
        
            // Ensure _id is not part of the update fields
            delete updateFields._id;
        
            // Check if ReferenceNumber is unique (ignore the current document)
            if (ReferenceNumber) {
              const existingQuotation = await Quatation.findOne({ ReferenceNumber, _id: { $ne: _id } });
        
              if (existingQuotation) {
                return res.status(400).json({ message: 'Duplicate ReferenceNumber found. Please provide a unique ReferenceNumber.' });
              }
            }
        
            // Create an object to store fields that will be updated
            const fieldsToUpdate = {};
        
            // Process Status: If Status is 'Editreq' or 'quotsreq', change it to 'Editaccess'
            if (Status) {
              if (Status === "Editreq" || Status === "quotsreq") {
                fieldsToUpdate.Status = "Editaccess";
              } else {
                fieldsToUpdate.Status = Status; // Retain the provided Status if it's not 'Editreq' or 'quotsreq'
              }
            } else {
              // Default to "Editaccess" if Status is not provided
              fieldsToUpdate.Status = "Editaccess";
            }
        
            // Add other fields to be updated (e.g., products, validity)
            if (products) fieldsToUpdate.products = products;
            if (validity) fieldsToUpdate.validity = validity;
        
            // Update other fields dynamically
            for (const key in updateFields) {
              if (updateFields[key] !== undefined && updateFields[key] !== null) {
                fieldsToUpdate[key] = updateFields[key];
              }
            }
        
            // Check if the fieldsToUpdate is empty
            if (Object.keys(fieldsToUpdate).length === 0) {
              return res.status(400).json({ message: "No valid fields provided to update." });
            }
        
            // Update the quotation in the database using _id as the unique identifier
            const updateResult = await Quatation.updateOne(
              { _id }, // Match by _id
              { $set: fieldsToUpdate } // Update the fields
            );
        
            // If no matching quotation is found
            if (updateResult.matchedCount === 0) {
              return res.status(404).json({ message: "No quotation found with the provided _id." });
            }
        
            // Send success response
            return res.status(200).json({
              message: "Quotation updated successfully",
              updatedFields: fieldsToUpdate,
            });
        
          } catch (error) {
            console.error('Error updating the quotation:', error);
            return res.status(500).json({
              message: 'Error updating the quotation',
              error: error.message,
            });
          }
        });
        
        
        
      router.get('/getoneenquiries/:EnquiryNo', verifyToken, async (req, res) => {
        const { EnquiryNo } = req.params;
    
        if (!EnquiryNo) {
            return res.status(400).json({ message: 'EnquiryNo is required' });
        }
    
        console.log("Received EnquiryNo:", EnquiryNo);  
    
        try {
            const customerData = await HeadEnquiry.findOne({EnquiryNo});
    
            if (!customerData) {
                return res.status(404).json({ message: 'No customer found' });
            }
            return res.status(200).json(customerData);
    
        } catch (err) {
            console.error("Error:", err);
            return res.status(500).json({ message: 'Internal server error', error: err.message || err });
        }
    });
    router.get('/customers/:EnquiryNo', async (req, res) => {
        try {
            const {EnquiryNo}= req.params; 
    
           
            const result = await Customerconvertion.find({
                'customerconvert.EnquiryNo': EnquiryNo
            });
    
            
            if (result.length === 0) {
                return res.status(404).json({ message: 'No customer found with that EnquiryNo' });
            }
    
            return res.status(200).json(result); // Return the result
    
        } catch (err) {
            console.error('Error fetching data:', err);
            return res.status(500).json({ message: 'Server Error', error: err });
        }
    });
    router.get('/getquots/:EnquiryNo',verifyToken, async (req, res) => {
        const { EnquiryNo } = req.params;
            console.log("i got the access",EnquiryNo);
        try {
            const fetchQuots = await Quatation.findOne(
                {
                    EnquiryNo,
                    $or: [
                        { Status: 'quotsaccess' },
                        { Status: 'Editaccess' }
                    ]
                }
            );
                console.log("i get the data access data",fetchQuots);
            if (!fetchQuots) {
                return res.status(404).json({ message: 'No data found' });
            }
    
            res.status(200).json(fetchQuots); // Example: { Status: 'Editaccess' }
        } catch (err) {
            console.error('Error fetching data:', err);
            return res.status(500).json({ message: 'Server Error', error: err });
        }
    });
    router.get('/quotationEditOne/:EnquiryNo/:Eid', verifyToken, async (req, res) => {
        const { EnquiryNo, Eid } = req.params;
      
        try {
          const getQuotationData = await Quatation.find({
            EnquiryNo: EnquiryNo,
            Eid: Eid,
            Status: "Editaccess"
          }).sort({ updatedAt: -1 }).limit(1); // Sort and get the latest one
      
          if (!getQuotationData || getQuotationData.length === 0) {
            return res.status(404).json({
              message: "Quotation not found",
              data: null
            });
          }
      
          console.log("Successfully fetched the latest edited data:", getQuotationData[0]);
          return res.status(200).json({
            message: "Latest edited quotation fetched successfully",
            data: getQuotationData[0]
          });
        } catch (err) {
          console.error("Error fetching the data:", err);
          return res.status(500).json({
            message: "Error fetching the data",
            error: err.message
          });
        }
      });
      router.get('/GetAllquotation', verifyToken, async (req, res) => {
        try {
          const latestQuotations = await Quatation.aggregate([
            // Step 1: Sort all documents by updatedAt (newest first)
            { $sort: { updatedAt: -1 } },
      
            // Step 2: Group by EnquiryNo and keep the latest entry
            {
              $group: {
                _id: "$EnquiryNo",
                latest: { $first: "$$ROOT" }
              }
            },
      
            // Step 3: Replace the root with the latest document
            { $replaceRoot: { newRoot: "$latest" } },
      
            // Optional: sort final results if needed
            { $sort: { updatedAt: -1 } }
          ]);
      
          return res.status(200).json({
            message: "Latest quotations per EnquiryNo fetched successfully",
            data: latestQuotations
          });
      
        } catch (error) {
          console.error("Error fetching data:", error);
          return res.status(500).json({
            message: "Failed to fetch latest quotations",
            error: error.message
          });
        }
      });
      router.get('/GetEidquotation/:Eid', verifyToken, async (req, res) => {
        try {
          const { Eid } = req.params;
      
          const latestQuotations = await Quatation.aggregate([
            // Step 1: Match by Eid
            { $match: { Eid: Eid } }, // or use { Eid: Eid } if that's the field name
      
            // Step 2: Sort all documents by updatedAt (newest first)
            { $sort: { updatedAt: -1 } },
      
            // Step 3: Group by EnquiryNo and keep the latest entry
            {
              $group: {
                _id: "$EnquiryNo",
                latest: { $first: "$$ROOT" }
              }
            },
      
            // Step 4: Replace the root with the latest document
            { $replaceRoot: { newRoot: "$latest" } },
      
            // Optional: sort final results if needed
            { $sort: { updatedAt: -1 } }
          ]);
      
          return res.status(200).json({
            message: "Latest quotation fetched successfully for the given Eid",
            data: latestQuotations
          });
      
        } catch (error) {
          console.error("Error fetching data:", error);
          return res.status(500).json({
            message: "Failed to fetch latest quotation",
            error: error.message
          });
        }
      });
      
      
   
module.exports = router;
