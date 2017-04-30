$(document).ready(function() {
  var canvas = document.getElementById("myCanvas");
  var context = canvas.getContext("2d");

  $('#myCanvas').mousedown(function(e) {
    paint = true;
    strokes.splice(checkpoint);
    strokes.push({});
    checkpoint++;
    strokes[checkpoint-1].shape = shape;
    strokes[checkpoint-1].styles = {strokeStyle: strokeStyle, lineWidth: lineWidth};
    startX = e.pageX - this.offsetLeft;
    startY = e.pageY - this.offsetTop;
    if (shape === 'free' || shape === 'line') {
      strokes[checkpoint-1].params = [[startX, startY], [startX, startY]];
    } else if (shape === 'rect') {
      strokes[checkpoint-1].params = {x: startX, y: startY, width: 1, height: 1};
    } else if (shape === 'arc') {
      strokes[checkpoint-1].params = {x: startX, y: startY, radius: 1, startAngle: 0, endAngle: 2*Math.PI, anticlockwise: false};
    }
    redraw();
  });

  $('#myCanvas').mousemove(function(e) {
    if (paint) {
      mouseX = e.pageX - this.offsetLeft;
      mouseY = e.pageY - this.offsetTop;
      if (shape == 'free') {
        strokes[checkpoint-1].params.push([mouseX, mouseY]);
      } else if (shape == 'line') {
        strokes[checkpoint-1].params[1][0] = mouseX;
        strokes[checkpoint-1].params[1][1] = mouseY;
      } else if (shape == 'rect') {
        strokes[checkpoint-1].params.width = mouseX - startX;
        strokes[checkpoint-1].params.height = mouseY - startY;
      } else if (shape == 'arc') {
        var radius = Math.sqrt(Math.pow(mouseX-startX, 2) + Math.pow(mouseY-startY, 2));
        strokes[checkpoint-1].params.radius = radius;
      }
      redraw();
    }
  });

  $('#myCanvas').mouseup(function(e) {
    paint = false;
    doSend(makeMessage(events.outgoing.ADD_STROKE, {canvasIndex: canvasIndex, stroke: strokes[strokes.length-1]}));
  });

  $('#myCanvas').mouseleave(function(e) {
    if (paint === true) {
      doSend(makeMessage(events.outgoing.ADD_STROKE, {canvasIndex: canvasIndex, stroke: strokes[strokes.length-1]}));
    }
    paint = false;
  });

  var canvasIndex = 0

  var shape = 'free';
  var paint = false;
  var checkpoint = 0;
  var strokes = [];
  var startX, startY, mouseX, mouseY;

  var strokeStyle = "cyan";
  var lineWidth = 1;

  function redraw() {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height); // Clears the canvas
    context.lineJoin = "round";
    for (var i = 0; i < checkpoint; i++) {
      var stroke = strokes[i];
      context.strokeStyle = stroke.styles.strokeStyle;
      context.lineWidth = stroke.styles.lineWidth;
      if (stroke.shape == 'free') {
        for (var j = 1; j < stroke.params.length; j++) {
          context.beginPath();
          context.moveTo(stroke.params[j-1][0], stroke.params[j-1][1]);
          context.lineTo(stroke.params[j][0], stroke.params[j][1]);
          context.closePath();
          context.stroke();
        }
      } else if (stroke.shape == 'line') {
	context.beginPath();
	context.moveTo(stroke.params[0][0], stroke.params[0][1]);
	context.lineTo(stroke.params[1][0], stroke.params[1][1]);
	context.closePath();
	context.stroke();
      } else if (stroke.shape == 'rect') {
        context.strokeRect(stroke.params.x, stroke.params.y, stroke.params.width, stroke.params.height);
      } else if (stroke.shape == 'arc') {
        context.beginPath();
        context.arc(stroke.params.x, stroke.params.y, stroke.params.radius, stroke.params.startAngle, stroke.params.endAngle, stroke.params.anticlockwise);
        context.closePath();
        context.stroke();
      }
    }
  }

  $('#canvasIndexSubmit').mouseup(function(e) {
    var index = parseInt($('#canvasIndex').val())
    if (!isNaN(index)) {
      canvasIndex = index;
      doSend(makeMessage(events.outgoing.SYNC_CANVAS, {canvasIndex: canvasIndex}));
    }
  });

  /*$('#clearCanvas').mousedown(function(e) {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  });*/
  $('#undo').mousedown(function(e) {
    if (checkpoint) {
      checkpoint--;
      redraw();
      doSend(makeMessage(events.outgoing.UNDO, {canvasIndex: canvasIndex}));
    }
  });
  $('#redo').mousedown(function(e) {
    if (checkpoint < strokes.length) {
      checkpoint++;
      redraw();
      doSend(makeMessage(events.outgoing.REDO, {canvasIndex: canvasIndex}));
    }
  });

  $('#free').mousedown(function(e){
    shape = 'free';
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

  $('#red').mousedown(function(e) {
    strokeStyle = 'red';
  });
  $('#orange').mousedown(function(e) {
    strokeStyle = 'orange';
  });
  $('#yellow').mousedown(function(e) {
    strokeStyle = 'yellow';
  });
  $('#green').mousedown(function(e) {
    strokeStyle = 'green';
  });
  $('#cyan').mousedown(function(e) {
    strokeStyle = 'cyan';
  });
  $('#blue').mousedown(function(e) {
    strokeStyle = 'blue';
  });
  $('#purple').mousedown(function(e) {
    strokeStyle = 'purple';
  });

  $('#lineWidth').on('mousemove mouseup', function(e) {
    $('#rangeValue').val($('#lineWidth').val());
    lineWidth = Number($('#lineWidth').val());
  });
  $('#rangeValue').on('keyup mouseup', function() {
    if ($(this).val()) {
      $('#lineWidth').val($(this).val());
      lineWidth = $('#lineWidth').val();
    }
  });

  // websocket

  var wsUri = "ws://niceshow.org:4080/";
  var events = {
    outgoing: {
      SYNC_CANVAS: 'csSyncCanvas',
      ADD_STROKE: 'csAddStroke',
      UNDO: 'csUndo',
      REDO: 'csRedo'
    },
    incoming: {
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
    doSend(makeMessage(events.outgoing.SYNC_CANVAS, {canvasIndex: canvasIndex}));
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
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        canvasIndex = msg.data.canvas.index;
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
