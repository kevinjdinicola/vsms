var when   = require('when'),
		util   = require('util'),
		events = require('events');

var textMessage = function() {

}

textMessage.prototype.getRawData = function() {
	return this.textResponse;
}

textMessage.createFromRaw = function(textResponse) {

}

util.inherits(textMessage, events.EventEmitter);

module.exports = textMessage;