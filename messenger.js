var util   = require("util"),
		events = require("events"),
		when   = require("when"),
		tls    = require('tls'),
		Parser = require("./imapparser");

var port = 993,
		server = "imap.vma.vzw.com"

/*
--Note: a config object is required to create a messenger.  it looks like this:

{ phone: '7142220560',
  deviceName: 'VSMS Library Tester',
  deviceId: 'someid',
  loginToken: 'PIN_someid_9adf08e674',
  uID: 'd91fc32a-584f-4df5-af59-f97150c4f53e' }

 */
var messenger = function(config) {
	this.config = config || {};
	events.EventEmitter.call(this);
}

util.inherits(messenger, events.EventEmitter);

//not using setters and getters, i can user the internal javascript ones if necessary


messenger.prototype.onEnd = function() {
	this.emit("end");
};

messenger.prototype.newConnection = function() {
	//make the connection and log in
	if (this._connection) {
		this._connection.close();
	}
	var that = this;
	   	d    = when.defer();

	var tlsConn = this._connection = tls.connect(port,server,function() {
		that.emit("connected");

		that.parser = new Parser(tlsConn);
		tlsConn.on('data',function(chunk) {
			that.parser.dataReceived(chunk);
			d.resolve();
		});
		tlsConn.on('end',that.onEnd);
	})

	tlsConn.on('error', function(error) {
		d.reject(error);
	});

	return d.promise;
};

messenger.prototype.select = function(box) {
	return this.parser.select(box);
}

messenger.prototype.login =  function() {
	//make a connection first when we log in
	var that = this;
	return this.newConnection()
		.then(function() {
			return that.parser.login(that.config.phone, that.config.loginToken);
		})
};

messenger.prototype.listConversations = function() {
	return this.parser.listConversations();
}

messenger.prototype.fetchMessage = function(messageUid) {
	return this.parser.fetchMessage(messageUid);
}

messenger.prototype.listMessages = function(phone, latestMessageUid, number) {
	return this.parser.listMessages(phone, latestMessageUid, number);
}


module.exports = messenger;