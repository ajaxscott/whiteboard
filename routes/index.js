var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

//
router.get('/whiteboard', function(req, res, next) {
  res.render('whiteboard', { title: 'Express' });
});

//
router.get('/webSocketTest', function(req, res, next) {
  res.render('webSocketTest', { title: 'WebSocket Test' });
});

module.exports = router;
