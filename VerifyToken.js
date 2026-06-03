const jwt = require('jsonwebtoken');
const JWT_SECRET =  '4f6d897fe9c2b90f931d57bb9e12345c97'; 

const verifytoken = ( req , res , next ) => {
const authHeader = req.header('Authorization');

if(!authHeader){
    return res.status(403).json({
message : 'Access denied,No token provided'
    });   

}
const token = authHeader.replace('Bearer','').trim();

if(!token){
    return res.status(403).json({
message : 'Access denied,No token provided'
    });   

}
try {
    const decoded = jwt.verify(token , JWT_SECRET);
    req.user = decoded;
    next();
} catch (error) {
    return res.status(401).json({
        message : 'Invalid Token'
            });  
}
};


module.exports = verifytoken;
