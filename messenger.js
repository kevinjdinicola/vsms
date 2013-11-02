var util = require("util"),
		events = require("events"),
		when = require("when");

/*
--Note: a config object is required to create a messenger.  it looks like this:

{ phone: '7142220560',
  deviceName: 'VSMS Library Tester',
  deviceId: 'someid',
  loginToken: 'PIN_someid_9adf08e674',
  uID: 'd91fc32a-584f-4df5-af59-f97150c4f53e' }

 */
var messenger = function(config) {
	messenger.config = config || {};
	events.EventEmitter.call(this);
}

util.inherits(messenger, events.EventEmitter);

//not using setters and getters, i can user the internal javascript ones if necessary

messenger.prototype.login =  function() {
	console.log("logged in with: ", config.phone);
	this.emit("explode")
};

module.exports = messenger;