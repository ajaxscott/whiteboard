const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 4080 });

var Canvas = require('./models/Canvas');
var events = { 
  incoming: {
    SYNC_CANVAS: 'csSyncCanvas',
    ADD_STROKE: 'csAddStroke',
    UNDO: 'csUndo',
    REDO: 'csRedo'
  },
  outgoing: {
    SYNC_CANVAS: 'scSyncCanvas',
    ADD_STROKE: 'scAddStroke',
    UNDO: 'scUndo',
    REDO: 'scRedo'
  }   
}
var groups = new Map();
groups.set(0, new Set());
var players = new Map();

var MongoClient = require('mongodb').MongoClient, assert = require('assert');
var url = 'mongodb://localhost:27017/whiteboard';

function makeMessage (action, data) {
  var msg = {
    action: action,
    data: data
  };
  return JSON.stringify(msg);
}

wss.on('connection', function connection(ws) {

  var socketKey = ws.upgradeReq.headers['sec-websocket-key'];
  console.log('CONNECT: ' + socketKey);
  groups.get(0).add(socketKey);
  players.set(socketKey, 0);
  console.log('players.size: ' + players.size);
  console.log('wss.clients.size: ' + wss.clients.size);

  ws.on('close', function(msg) {
    console.log('CLOSE: ' + socketKey);
    var canvasIndex = players.get(socketKey);
    groups.get(canvasIndex).delete(socketKey);
    players.delete(socketKey);
    console.log('players.size: ' + players.size);
    console.log('wss.clients.size: ' + wss.clients.size);
  });

  ws.on('message', function incoming(message) {
    var msg = JSON.parse(message);
    console.log(msg);
    var canvasIndex = msg.data.canvasIndex;
    if (canvasIndex != parseInt(canvasIndex, 10) || canvasIndex < 0 || canvasIndex > 4294967295) {
      return;
    }
    switch (msg.action) {
      case events.incoming.SYNC_CANVAS:
	MongoClient.connect(url, function(err, db) {
	  assert.equal(null, err);
          var preCanvasIndex = players.get(socketKey);
          groups.get(preCanvasIndex).delete(socketKey);
          players.set(socketKey, canvasIndex);
          if (!groups.get(canvasIndex)) {
            groups.set(canvasIndex, new Set());
          }
          groups.get(canvasIndex).add(socketKey);
	  db.collection('canvases').findOne({index: canvasIndex}, function(err, doc) {
	    assert.equal(null, err);
            if (!doc) {
	      db.collection('canvases').insertOne(new Canvas(canvasIndex), function(err, r) {
		assert.equal(null, err);
		assert.equal(1, r.insertedCount);
		db.close();
	      });
              ws.send(makeMessage(events.outgoing.SYNC_CANVAS, {canvas: new Canvas(canvasIndex)}));
            } else {
              ws.send(makeMessage(events.outgoing.SYNC_CANVAS, {canvas: doc}));
            }
	  });
	});
        break;
      case events.incoming.ADD_STROKE:
        MongoClient.connect(url, function(err, db) {
          assert.equal(null, err);
          db.collection('canvases').findOne({ index: canvasIndex }, function(err, doc) {
            if (!doc) {
              return;
            }
            checkpoint = doc.checkpoint;
            db.collection('canvases').findOneAndUpdate(
              { index: canvasIndex },
              { $push: {
                  strokes: {
                    $each: [msg.data.stroke],
                    $position: checkpoint,
                    $slice: checkpoint + 1
                  }
                },
                $inc: { checkpoint: 1 }
              },
              {},
              function(err, r) {
                assert.equal(null, err);
                db.close();
            });
          });
        });
        console.log('STRIKE: ' + socketKey);
        var canvasIndex = players.get(socketKey);
        var group = groups.get(canvasIndex);
        wss.clients.forEach(function each(client) {
          if (client !== ws && client.readyState == WebSocket.OPEN) {
            if (group.has(client.upgradeReq.headers['sec-websocket-key'])) {
              console.log(client.upgradeReq.headers['sec-websocket-key']);
              client.send(makeMessage(events.outgoing.ADD_STROKE, {stroke: msg.data.stroke}));
            }
          }
        });
        break;
      case events.incoming.UNDO:
        MongoClient.connect(url, function(err, db) {
          assert.equal(null, err);

          db.collection('canvases').findOneAndUpdate(
            { index: canvasIndex , checkpoint: { $gt: 0 } },
            {
              $inc: { checkpoint: -1 }
            },
            {},
            function(err, r) {
              assert.equal(null, err);
              db.close();
          });
        });
        console.log('UNDO: ' + socketKey);
        var canvasIndex = players.get(socketKey);
        var group = groups.get(canvasIndex);
        wss.clients.forEach(function each(client) {
          if (client !== ws && client.readyState == WebSocket.OPEN) {
            if (group.has(client.upgradeReq.headers['sec-websocket-key'])) {
              console.log(client.upgradeReq.headers['sec-websocket-key']);
              client.send(makeMessage(events.outgoing.UNDO, {}));
            }
          }
        });
        break;
      case events.incoming.REDO:
        MongoClient.connect(url, function(err, db) {
          assert.equal(null, err);

          db.collection('canvases').findOneAndUpdate(
            { index: canvasIndex , $where: function() { return this.checkpoint < this.strokes.length } },
            {
              $inc: { checkpoint: 1 }
            },
            {},
            function(err, r) {
              assert.equal(null, err);
              db.close();
          });
        });
        console.log('REDO: ' + socketKey);
        var canvasIndex = players.get(socketKey);
        var group = groups.get(canvasIndex);
	wss.clients.forEach(function each(client) {
	  if (client !== ws && client.readyState == WebSocket.OPEN) {
            if (group.has(client.upgradeReq.headers['sec-websocket-key'])) {
              console.log(client.upgradeReq.headers['sec-websocket-key']);
	      client.send(makeMessage(events.outgoing.REDO, {}));
            }
	  }
	});
        break;
    }
  });
});
