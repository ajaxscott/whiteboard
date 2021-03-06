$(document).ready(function() {
  var canvas = document.getElementById("myCanvas");
  var context = canvas.getContext("2d");

  function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  $('#myCanvas').mousedown(function(e) {
    paint = true;
    strokes.splice(checkpoint);
    strokes.push({});
    checkpoint++;
    strokes[checkpoint-1].shape = shape;

    context.strokeStyle = color;
    var rgb = hexToRgb(context.strokeStyle);
    var rgba = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + alpha + ')';

    strokes[checkpoint-1].styles = {lineWidth: lineWidth, strokeStyle: rgba, fillStyle: rgba, strokeOrFill};
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
      if (shape === 'free') {
        strokes[checkpoint-1].params.push([mouseX, mouseY]);
      } else if (shape === 'line') {
        strokes[checkpoint-1].params[1][0] = mouseX;
        strokes[checkpoint-1].params[1][1] = mouseY;
      } else if (shape === 'rect') {
        strokes[checkpoint-1].params.width = mouseX - startX;
        strokes[checkpoint-1].params.height = mouseY - startY;
      } else if (shape === 'arc') {
        var radius = Math.sqrt(Math.pow(mouseX-startX, 2) + Math.pow(mouseY-startY, 2));
        strokes[checkpoint-1].params.radius = radius;
      }
      redraw();
    }
  });

  $('#myCanvas').mouseup(function(e) {
    paint = false;
    $('#undo').attr('disabled', false);
    $('#redo').attr('disabled', true);
    doSend(makeMessage(events.outgoing.ADD_STROKE, {canvasIndex: canvasIndex, stroke: strokes[strokes.length-1]}));
  });

  $('#myCanvas').mouseleave(function(e) {
    if (paint === true) {
      $('#undo').attr('disabled', false);
      $('#redo').attr('disabled', true);
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

  var lineWidth = 1;
  var color = "white";
  var alpha = 1;
  var strokeOrFill = 'stroke';

  function redraw() {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height); // Clears the canvas
    context.lineJoin = "round";
    for (var i = 0; i < checkpoint; i++) {
      var stroke = strokes[i];
      context.lineWidth = stroke.styles.lineWidth;
      context.strokeStyle = stroke.styles.strokeStyle;
      context.fillStyle = stroke.styles.fillStyle;
      switch (stroke.shape) {
        case 'free':
          for (var j = 1; j < stroke.params.length; j++) {
            context.beginPath();
            context.moveTo(stroke.params[j-1][0], stroke.params[j-1][1]);
            context.lineTo(stroke.params[j][0], stroke.params[j][1]);
            context.closePath();
            context.stroke();
          }
          break;
        case 'line':
          context.beginPath();
          context.moveTo(stroke.params[0][0], stroke.params[0][1]);
          context.lineTo(stroke.params[1][0], stroke.params[1][1]);
          context.closePath();
          context.stroke();
          break;
        case 'rect':
          if (stroke.styles.strokeOrFill === 'stroke') {
            context.strokeRect(stroke.params.x, stroke.params.y, stroke.params.width, stroke.params.height);
          } else if (stroke.styles.strokeOrFill === 'fill') {
            context.fillRect(stroke.params.x, stroke.params.y, stroke.params.width, stroke.params.height);
          }
          break;
        case 'arc':
          context.beginPath();
          context.arc(stroke.params.x, stroke.params.y, stroke.params.radius, stroke.params.startAngle, stroke.params.endAngle, stroke.params.anticlockwise);
          context.closePath();
          if (stroke.styles.strokeOrFill === 'stroke') {
            context.stroke();
          } else if (stroke.styles.strokeOrFill === 'fill') {
            context.fill();
          }
          break;
      }
    }
  }

  function syncCanvas() {
    var index = parseInt($('#canvasIndex').val())
    if (!isNaN(index)) {
      canvasIndex = index;
      doSend(makeMessage(events.outgoing.SYNC_CANVAS, {canvasIndex: canvasIndex}));
    }
  }
  $('#canvasIndex').keypress(function(e) {
    var key = e.which;
    if (key === 13) // the enter key code
    {
      syncCanvas();
    }
  });
  $('#canvasIndexSubmit').mouseup(function(e) {
    syncCanvas();
  });

  /*$('#clearCanvas').mousedown(function(e) {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  });*/
  $('#undo').mousedown(function(e) {
    if (checkpoint > 0) {
      checkpoint--;
      redraw();
      doSend(makeMessage(events.outgoing.UNDO, {canvasIndex: canvasIndex}));
      $('#redo').attr('disabled', false);
      if (checkpoint === 0) {
        $(this).attr('disabled', true);
      }
    }
  });
  $('#redo').mousedown(function(e) {
    if (checkpoint < strokes.length) {
      checkpoint++;
      redraw();
      doSend(makeMessage(events.outgoing.REDO, {canvasIndex: canvasIndex}));
      $('#undo').attr('disabled', false);
      if (checkpoint === strokes.length) {
        $(this).attr('disabled', true);
      }
    }
  });

  $('#line-width-range').on('mousemove mouseup', function(e) {
    $('#line-width-number').val($(this).val());
    lineWidth = Number($(this).val());
  });
  $('#line-width-number').on('keyup mouseup', function() {
    if ($(this).val()) {
      $('#line-width-range').val($(this).val());
      lineWidth = $('#line-width-range').val();
    }
  });

  $('.shape').mousedown(function(e) {
    shape = $(this).text().toLowerCase();
  });

  $('.strokeOrFill').mousedown(function(e) {
    strokeOrFill = $(this).text().toLowerCase();
  });

  $('.color').mousedown(function(e) {
    color = $(this).text().toLowerCase();
  });

  $('#alpha-range').on('mousemove mouseup', function(e) {
    $('#alpha-number').val($(this).val());
    alpha = Number($(this).val());
  });
  $('#alpha-number').on('keyup mouseup', function() {
    if ($(this).val()) {
      $('#alpha-range').val($(this).val());
      alpha = $('#alpha-range').val();
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
        if (checkpoint > 0) {
          $('#undo').attr('disabled', false);
        } else {
          $('#undo').attr('disabled', true);
        }
        if (checkpoint < strokes.length) {
          $('#redo').attr('disabled', false);
        } else {
          $('#redo').attr('disabled', true);
        }
        break;
      case events.incoming.ADD_STROKE:
        strokes.splice(checkpoint);
        checkpoint++;
        strokes.push(msg.data.stroke);
        redraw();
        $('#undo').attr('disabled', false);
        $('#redo').attr('disabled', true);
        break;
      case events.incoming.UNDO:
        checkpoint--;
        redraw();
        $('#redo').attr('disabled', false);
        if (checkpoint === 0) {
          $('#undo').attr('disabled', true);
        }
        break;
      case events.incoming.REDO:
        checkpoint++;
        redraw();
        $('#undo').attr('disabled', false);
        if (checkpoint === strokes.length) {
          $('#redo').attr('disabled', true);
        }
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
