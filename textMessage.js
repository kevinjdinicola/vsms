var when   = require('when'),
		util   = require('util'),
		events = require('events');


var textMessage = function() {

}


textMessage.prototype.getRawData = function() {
	return this.textResponse;
}

textMessage.createFromRaw = function(textResponse) {
	var m = new textMessage();
	m.from = '';
	m.to = '';
	m.date = '';

}

util.inherits(textMessage, events.EventEmitter);

module.exports = textMessage;