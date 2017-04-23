var EventEmitter = require('events').EventEmitter;
var util = require('util');

var Canvas = function(canvasIndex) {
  this.index = canvasIndex;
  this.players = [];
  this.strokes = [];
  this.checkpoint = 0;
};

module.exports = Canvas;
