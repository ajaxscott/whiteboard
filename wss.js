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
var canvases = [];
canvases.push(new Canvas(0));

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

  ws.send(makeMessage(events.outgoing.SYNC_CANVAS, {canvas: canvases[0]}));

  ws.on('close', function(msg) {
    console.log('wss.clients.size: ' + wss.clients.size);
  });

  ws.on('message', function incoming(message) {
    var msg = JSON.parse(message);
    //console.log(msg.data);
    var canvas = canvases[msg.data.canvasIndex];

    switch (msg.action) {
      case events.incoming.ADD_STROKE:
        canvas.strokes.splice(canvas.checkpoint);
        canvas.strokes.push(msg.data.stroke);
        canvas.checkpoint = canvas.strokes.length;
        console.log('canvas.strokes.length: ' + canvas.strokes.length);
        console.log('canvas.checkpoint: ' + canvas.checkpoint);
        wss.clients.forEach(function each(client) {
          if (client !== ws && client.readyState == WebSocket.OPEN) {
            client.send(makeMessage(events.outgoing.ADD_STROKE, {stroke: msg.data.stroke}));
          }
        });
        break;
      case events.incoming.UNDO:
        if (canvas.checkpoint) {
          canvas.checkpoint--;
          console.log('canvas.strokes.length: ' + canvas.strokes.length);
          console.log('canvas.checkpoint: ' + canvas.checkpoint);
          wss.clients.forEach(function each(client) {
            if (client !== ws && client.readyState == WebSocket.OPEN) {
              client.send(makeMessage(events.outgoing.UNDO, {}));
            }
          });
        }
        break;
      case events.incoming.REDO:
        if (canvas.checkpoint < canvas.strokes.length) {
          canvas.checkpoint++;
          console.log('canvas.strokes.length: ' + canvas.strokes.length);
          console.log('canvas.checkpoint: ' + canvas.checkpoint);
          wss.clients.forEach(function each(client) {
            if (client !== ws && client.readyState == WebSocket.OPEN) {
              client.send(makeMessage(events.outgoing.REDO, {}));
            }
          });
        }
        break;
    }
  });
});
