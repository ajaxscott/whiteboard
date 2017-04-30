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

  console.log('wss.clients.size: ' + wss.clients.size);

  ws.on('close', function(msg) {
    console.log('wss.clients.size: ' + wss.clients.size);
  });

  ws.on('message', function incoming(message) {
    var msg = JSON.parse(message);
    console.log(msg);
    var index = msg.data.canvasIndex;
    if (index != parseInt(index, 10) || index < 0 || index > 4294967295) {
      return;
    }
    switch (msg.action) {
      case events.incoming.SYNC_CANVAS:
	MongoClient.connect(url, function(err, db) {
	  assert.equal(null, err);
	  db.collection('canvases').findOne({index: index}, function(err, doc) {
	    assert.equal(null, err);
            if (!doc) {
	      db.collection('canvases').insertOne(new Canvas(index), function(err, r) {
		assert.equal(null, err);
		assert.equal(1, r.insertedCount);
		ws.send(makeMessage(events.outgoing.SYNC_CANVAS, {canvas: new Canvas(index)}));
		db.close();
	      });
            } else {
              ws.send(makeMessage(events.outgoing.SYNC_CANVAS, {canvas: doc}));
            }
	  });
	});
        break;
      case events.incoming.ADD_STROKE:
        MongoClient.connect(url, function(err, db) {
          assert.equal(null, err);
          db.collection('canvases').findOne({ index: index }, function(err, doc) {
            if (!doc) {
              return;
            }
            checkpoint = doc.checkpoint;
            db.collection('canvases').findOneAndUpdate(
              { index: index },
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
        wss.clients.forEach(function each(client) {
          if (client !== ws && client.readyState == WebSocket.OPEN) {
            client.send(makeMessage(events.outgoing.ADD_STROKE, {stroke: msg.data.stroke}));
          }
        });
        break;
      case events.incoming.UNDO:
        MongoClient.connect(url, function(err, db) {
          assert.equal(null, err);

          db.collection('canvases').findOneAndUpdate(
            { index: index , checkpoint: { $gt: 0 } },
            {
              $inc: { checkpoint: -1 }
            },
            {},
            function(err, r) {
              assert.equal(null, err);
              db.close();
          });
        });
        wss.clients.forEach(function each(client) {
          if (client !== ws && client.readyState == WebSocket.OPEN) {
            client.send(makeMessage(events.outgoing.UNDO, {}));
          }
        });
        break;
      case events.incoming.REDO:
        MongoClient.connect(url, function(err, db) {
          assert.equal(null, err);

          db.collection('canvases').findOneAndUpdate(
            { index: index , $where: function() { return this.checkpoint < this.strokes.length } },
            {
              $inc: { checkpoint: 1 }
            },
            {},
            function(err, r) {
              assert.equal(null, err);
              db.close();
          });
        });
	wss.clients.forEach(function each(client) {
	  if (client !== ws && client.readyState == WebSocket.OPEN) {
	    client.send(makeMessage(events.outgoing.REDO, {}));
	  }
	});
        break;
    }
  });
});
