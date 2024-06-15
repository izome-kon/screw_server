const jwt = require('jsonwebtoken');
function verifyToken(req, res, next) {
    const token = req.headers['authorization'].split(' ')[1] || '';
    if (token === '') return res.status(401).json({ status: '401', message: 'Access denied' });
    try {
        const decoded = jwt.verify(token, process.env.SECRET_JWT);
        req.userId = decoded._id;
        next();
    } catch (error) {
        res.status(401).json({ status: '401', message: 'Invalid token' });
    }
};

module.exports = verifyToken;