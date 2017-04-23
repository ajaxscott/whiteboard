$(document).ready(function() {
  var canvas = document.getElementById("myCanvas");
  var context = canvas.getContext("2d");

  $('#myCanvas').mousedown(function(e) {
    paint = true;
    strokes.splice(checkpoint);
    strokes.push([]);
    checkpoint++;
    mouseX = e.pageX - this.offsetLeft;
    mouseY = e.pageY - this.offsetTop;
    if (shape == 'line') {
      strokes[strokes.length-1].push([shape, curColor, curSize]);
      strokes[strokes.length-1].push([mouseX, mouseY]);
      redraw();
    } else if (shape == 'rect') {
      startX = mouseX;
      startY = mouseY;
      strokes[strokes.length-1].push([shape, curColor, curSize]);
      strokes[strokes.length-1].push([startX, startY, 1, 1]);
      redraw();
      //context.strokeStyle = curColor;
      //context.lineWidth = 16;
      //context.strokeRect(startX, startY, 1, 1);
    } else if (shape == 'arc') {
      startX = mouseX;
      startY = mouseY;
      strokes[strokes.length-1].push([shape, curColor, curSize]);
      strokes[strokes.length-1].push([startX, startY, 1, 0, 2*Math.PI, false]);
      redraw();
    }
  });

  $('#myCanvas').mousemove(function(e) {
    if (paint) {
      mouseX = e.pageX - this.offsetLeft;
      mouseY = e.pageY - this.offsetTop;
      if (shape == 'line') {
        strokes[strokes.length-1].push([mouseX, mouseY]);
      } else if (shape == 'rect') {
        strokes[strokes.length-1][1][2] = mouseX - startX;
        strokes[strokes.length-1][1][3] = mouseY - startY;
      } else if (shape == 'arc') {
        var radius = Math.sqrt(Math.pow(mouseX-startX, 2) + Math.pow(mouseY-startY, 2));
        strokes[strokes.length-1][1][2] = radius;
      }
      redraw();
    }
  });

  $('#myCanvas').mouseup(function(e) {
    paint = false;
    doSend(makeMessage(events.outgoing.ADD_STROKE, {canvasIndex: 0, stroke: strokes[strokes.length-1]}));
  });

  $('#myCanvas').mouseleave(function(e) {
    if (paint === true) {
      doSend(makeMessage(events.outgoing.ADD_STROKE, {canvasIndex: 0, stroke: strokes[strokes.length-1]}));
    }
    paint = false;
  });

  var shape = 'line';
  var paint = false;
  var checkpoint = 0;
  var strokes = [];
  var startX, startY, mouseX, mouseY;

  var colorPurple = "#cb3594";
  var colorGreen = "#659b41";
  var colorYellow = "#ffcf33";
  var colorBrown = "#986928";

  var curColor = colorPurple;
  var curSize = 2;

  function redraw() {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height); // Clears the canvas
    context.lineJoin = "round";
    for (var i = 0; i < checkpoint; i++) {
      var stroke = strokes[i];
      context.strokeStyle = stroke[0][1];
      context.lineWidth = stroke[0][2];
      if (stroke[0][0] == 'line') {
        for (var j = 1; j < stroke.length; j++) {
          context.beginPath();
          if (j === 1) {
            context.moveTo(stroke[j][0] - 1, stroke[j][1] - 1);
          } else {
            context.moveTo(stroke[j-1][0], stroke[j-1][1]);
          }
          context.lineTo(stroke[j][0], stroke[j][1]);
          context.closePath();
          context.stroke();
        }
      }  else if (stroke[0][0] == 'rect') {
        context.strokeRect(stroke[1][0], stroke[1][1], stroke[1][2], stroke[1][3]);
      }  else if (stroke[0][0] == 'arc') {
        context.moveTo(mouseX, mouseY);
        context.beginPath();
        context.arc(stroke[1][0], stroke[1][1], stroke[1][2], stroke[1][3], stroke[1][4], stroke[1][5]);
        context.closePath();
        context.stroke();
      }
    }
  }

  /*$('#clearCanvas').mousedown(function(e) {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  });*/
  $('#undo').mousedown(function(e) {
    if (checkpoint) {
      checkpoint--;
      redraw();
      doSend(makeMessage(events.outgoing.UNDO, {canvasIndex: 0}));
    }
  });
  $('#redo').mousedown(function(e) {
    if (checkpoint < strokes.length) {
      checkpoint++;
      redraw();
      doSend(makeMessage(events.outgoing.REDO, {canvasIndex: 0}));
    }
  });

  $('#purple').mousedown(function(e) {
    curColor = colorPurple;
  });
  $('#green').mousedown(function(e) {
    curColor = colorGreen;
  });
  $('#yellow').mousedown(function(e) {
    curColor = colorYellow;
  });
  $('#brown').mousedown(function(e) {
    curColor = colorBrown;
  });

  $('#smallSize').mousedown(function(e) {
    curSize = 2;
  });
  $('#normalSize').mousedown(function(e) {
    curSize = 4;
  });
  $('#largeSize').mousedown(function(e) {
    curSize = 8;
  });
  $('#hugeSize').mousedown(function(e) {
    curSize = 16;
  });

  $('#line').mousedown(function(e){
    shape = 'line';
  });
  $('#rect').mousedown(function(e){
    shape = 'rect';
  });
  $('#arc').mousedown(function(e){
    shape = 'arc';
  });

  var wsUri = "ws://niceshow.org:4080/";
  var events = {
    outgoing: {
      PLAYER_CONNECTED: 'csPlayerConnected',
      SYNC_CANVAS: 'csSyncCanvas',
      ADD_STROKE: 'csAddStroke',
      UNDO: 'csUndo',
      REDO: 'csRedo'
    },
    incoming: {
      PLAYER_CONNECTED: 'scPlayerConnected',
      SYNC_CANVAS: 'scSyncCanvas',
      ADD_STROKE: 'scAddStroke',
      UNDO: 'scUndo',
      REDO: 'scRedo'
    }
  }

  function initWebSocket()
  {
    websocket = new WebSocket(wsUri);
    websocket.onopen = function(evt) { onOpen(evt) };
    websocket.onclose = function(evt) { onClose(evt) };
    websocket.onmessage = function(evt) { onMessage(evt) };
    websocket.onerror = function(evt) { onError(evt) };
  }

  initWebSocket();

  function onOpen(evt)
  {
    console.log('CONNECTED');
  }

  function onClose(evt)
  {
    console.log('DISCONNECTED');
  }

  function onMessage(evt)
  {
    console.log('RESPONSE: ' + evt.data);
    var msg = JSON.parse(evt.data);
    switch (msg.action) {
      case events.incoming.SYNC_CANVAS:
        if (msg.data.canvas.strokes.length === 0) {
          break;
        }
        strokes = msg.data.canvas.strokes;
        checkpoint = msg.data.canvas.checkpoint;
        redraw();
        break;
      case events.incoming.ADD_STROKE:
        strokes.splice(checkpoint);
        checkpoint++;
        strokes.push(msg.data.stroke);
        redraw();
        break;
      case events.incoming.UNDO:
        checkpoint--;
        redraw();
        break;
      case events.incoming.REDO:
        checkpoint++;
        redraw();
        break;
    }
    //websocket.close();
  }

  function onError(evt)
  {
    console.log('ERROR: ' + evt.data);
  }

  function doSend(message)
  {
    console.log("SENT: " + message);
    websocket.send(message);
  }

  function makeMessage(action, data) {
    var message = {
      action: action,
      data: data
    };
    return JSON.stringify(message);
  }
});
