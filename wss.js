const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 4080 });

var Canvas = require('./models/Canvas');
var Player = require('./models/Player');
var events = { 
  incoming: {
    PLAYER_CONNECTED: 'csPlayerConnected',
    SYNC_CANVAS: 'csSyncCanvas',
    ADD_STROKE: 'csAddStroke',
    UNDO: 'csUndo',
    REDO: 'csRedo'
  },
  outgoing: {
    PLAYER_CONNECTED: 'scPlayerConnected',
    SYNC_CANVAS: 'scSyncCanvas',
    ADD_STROKE: 'scAddStroke',
    UNDO: 'scUndo',
    REDO: 'scRedo'
  }   
}

var MongoClient = require('mongodb').MongoClient, assert = require('assert');
var url = 'mongodb://localhost:27017/whiteboard';

MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);

  var col = db.collection('canvases');
  col.findOne({ index: 0 }, function(err, r) {
    if(!r) {
      col.insertOne(new Canvas(0), function(err, r) {
        assert.equal(null, err);
        assert.equal(1, r.insertedCount);
      });
    }
    db.close();
  });
});

function makeMessage (action, data) {
  var msg = {
    action: action,
    data: data
  };
  return JSON.stringify(msg);
}

wss.on('connection', function connection(ws) {

  var player = new Player();

  console.log('wss.clients.size: ' + wss.clients.size);

  MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);

    var col = db.collection('canvases');
    col.findOne({index: 0}, function(err, doc) {
      assert.equal(null, err);

      ws.send(makeMessage(events.outgoing.SYNC_CANVAS, {canvas: doc}));
      db.close();
    });
  });

  ws.on('close', function(msg) {
    console.log('wss.clients.size: ' + wss.clients.size);
  });

  ws.on('message', function incoming(message) {
    var msg = JSON.parse(message);
    console.log(msg.data);

    switch (msg.action) {
      case events.incoming.ADD_STROKE:
        MongoClient.connect(url, function(err, db) {
          assert.equal(null, err);

          db.collection('canvases').findOne({ index: 0 }, function(err, r) {
            if (r) {
              checkpoint = r.checkpoint;
              console.log(checkpoint);
              db.collection('canvases').findOneAndUpdate(
                { index: 0 },
                {
                  $push: {
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
            }
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
            { index: 0 , checkpoint: { $gt: 0 } },
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
            { index: 0 , $where: function() { return this.checkpoint < this.strokes.length } },
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
