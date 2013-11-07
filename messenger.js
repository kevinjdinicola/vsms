var util   = require("util"),
		events = require("events"),
		when   = require("when"),
		tls    = require('tls'),
		Parser = require("./imapparser");

var CRLF  = "\r\n",
    port = 993,
		server = "imap.vma.vzw.com";

var c = function() {
	return Array.prototype.join.call(arguments," ");
}
var trimEnd = function(str, len) {
	len = len || 1;
	return str.substring(0,str.length-len);
}

/*
--Note: a config object is required to create a messenger.  it looks like this:

{ phone: '5551234567',
  deviceName: 'VSMS Library Tester',
  deviceId: 'someid',
  loginToken: 'PIN_someid_9adf08e674',
  uID: 'd91fc32a-584f-4df5-af59-f97150c4f53e' }

 */

var messenger = function(config) {
	//Setup main properties
	this.config          = config || {};
	this.parser          = null;
	this._counter        = 0;
	this.commandDeferMap = {};

	events.EventEmitter.call(this);
}

util.inherits(messenger, events.EventEmitter);


messenger.prototype.onEnd = function() {
	this.emit("end");
};

messenger.prototype.connect = function() {
	//make the connection and log in
	if (this._connection) {
		this._connection.close();
	}
	var that = this;
	   	d    = when.defer();

	var tlsConn = this._connection = tls.connect(port,server,function() {
		that.emit("connected");

		//make a new parser object with our successful connection
		that.parser = new Parser(tlsConn);
		that.parser.on('packet', function() {
			that.didReceivePacket.apply(that,arguments);
		});

		tlsConn.once('data',function(chunk) {
			d.resolve();
		});

		tlsConn.on('end',that.onEnd);
	})

	tlsConn.on('error', function(error) {
		d.reject(error);
	});

	return d.promise;
};

messenger.prototype.disconnect = function() {
	if (this._connection) {
		this._connection.close();
	}
}

messenger.prototype.getCounter = function() {
	return this._counter++;
}


messenger.prototype.exec = function(command) {
	var d       = when.defer(),
	 	  cnt       = this.getCounter(),
		  cmdString = "EA"+cnt + " " + command + CRLF;

	this.commandDeferMap[cnt] = d;
	// console.log("<< ",cmdString);
	this._connection.write(cmdString);
	return d.promise.then(this.packetPreprocessor);
}

messenger.prototype.packetPreprocessor = function(packet) {
	// console.log("packet",packet);
	var status = packet[packet.length-1];
	//Clip out just the status code
	status = status.substring(status.indexOf(" ")+1);
	status = status.substring(0,status.indexOf(" "));
	if (status == "OK") {
		//I really dont care or think i'll ever use the last
		//line... kill it here
		packet.splice(packet.length-1,1);
		return when.resolve(packet);
	} else {
		return when.reject(packet[packet.length-1]);
	}
}

messenger.prototype.login =  function() {
	//make a connection first when we log in
	this._counter = 1;
	var that = this;
	return this.connect()
		.then(function() {
			return that.exec(c("LOGIN",that.config.phone, that.config.loginToken));
		})
};

messenger.prototype.didReceivePacket = function(id, packet) {
	//get it from the mapping
	var d = this.commandDeferMap[id];
	if (d) {
		this.commandDeferMap[id] = undefined;
		d.resolve(packet);
	}
}

messenger.prototype.select = function(box) {
	box = box || "INBOX";
	return this.exec(c("SELECT", box));
}

messenger.prototype.listConversations = function(count) {
	count = count || 20;
	return this.exec(c("XCONV LIST UID * NUMGROUPS", count))
		.then(function(lines) {
			//process these lines into useful objects
			var split;
			for (var i = 0, len = lines.length; i < len; i++) {
				splits = lines[i].split(" ");
				lines[i] = {
					participantUid   : splits[4],
					latestMessageUid : splits[6],
					numberUnread     : splits[8].substring(0,trimEnd(splits[8]))
				}
			}
			return when.resolve(lines);
		});
}

messenger.prototype.listMessageThread = function(participantUid, latestMessageUid, count) {
	count = count || 20;
	return this.exec(c(
		"XCONV FETCH PARTICIPANTID", 
		participantUid,
		"UID",
		latestMessageUid,
		"NUMMSGS",
		count
	)).then(function(lines) {
			//process these lines into useful objects
			var split;
			for (var i = 0, len = lines.length; i < len; i++) {
				splits = lines[i].split(" ");
				lines[i] = {
					participantId : splits[5],
					messageUid    : trimEnd(splits[7])
				}
			}
			return when.resolve(lines);
		});
}


messenger.prototype.fetchMessage = function(messageUid) {
	return this.exec(c(
		"UID FETCH", 
		messageUid,
		"(FLAGS XRECIPSTATUS BODY.PEEK[HEADER+TEXT+THUMBNAILS])"
	)).then(function(response) {
		return when.resolve(response[1].toString("utf8"));
	})
}

messenger.prototype.sendMessage = function(messageBody) {
	
}

module.exports = messenger;