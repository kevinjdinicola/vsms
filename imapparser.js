var when   = require('when'),
		util   = require('util'),
		events = require('events');

var CRLF  = "\r\n",
		HELLO_RESPONSE = "* OK IMAP4rev1 Proxy ready\r\n";

var packetEnding = function(chunk) {
	return chunk.toString().match(/(\bEA|\r\nEA)[0-9]+\s/);
}

var packetIdFromMatch = function(match) {
	match = match[0];
	return match.substring(match.indexOf("EA")+2,match.length-1);
}


var parser = function(connection) {
	this._connection = connection;
	this._commandCounter = 1;
	this._commandDeferMap = {};
	this._currentPacket = '';
	this._helloDeferred = when.defer();
}
util.inherits(parser, events.EventEmitter);

parser.prototype.executeCommand = function(command, args) {
	var d         = when.defer(),
			cnt       = this.getCounter(),
			cmdString = "EA"+cnt + " " + command + " " + args + CRLF;
	
	this._commandDeferMap[cnt] = d;

	console.log("<< "+cmdString);
	this.getConnection().write(cmdString);

	return d.promise.then(this.genericPacketProcessor);
}

parser.prototype.genericPacketProcessor = function(data) {
	console.log("Packet:",data);
	if (data.indexOf("OK") > -1) {
		return when.resolve(data);
	} else {
		return when.reject(data);
	}
}

parser.prototype.dataReceived = function(chunk) {
	if (!this._receivedHello && chunk == HELLO_RESPONSE) {
		this._helloDeferred.resolve();
		this._receivedHello = true;
		return;
	}

		var match = packetEnding(chunk),
			d;
	console.log(">> " + chunk);

	while (match && match.index > -1) {
		//add everything up till the packet ending
		this._currentPacket += chunk.substring(0,match.index);
		//add the last packet ending line
		var extraLength = chunk.indexOf("\r\n");
		this._currentPacket += chunk.substring(0,extraLength);

		//launch the packet
		d = this._commandDeferMap[packetIdFromMatch(match)];
		if (d) {
			d.resolve(this._currentPacket);
		}

		chunk = chunk.substring(match.index);
		chunk = chunk.substring(chunk.indexOf("\r\n"));
		match = packetEnding(chunk);
		this._currentPacket = '';
	}
	this._currentPacket += chunk;
}

parser.prototype.getConnection = function() {
	return this._connection;
}

parser.prototype.getCounter = function() {
	return this._commandCounter++;
}

parser.prototype.listConversations = function(number) {
	number = number || 20;
	return this.executeCommand("XCONV LIST", "UID * NUMGROUPS " + number)
		.then(function(response) {
			//parse here
		})
}

parser.prototype.listMessages = function(participantUid, latestMessageUid, number) {
	number = number || 25;
	return this.executeCommand("XCONV FETCH",
		['PARTICIPANTID',
		 participantUid,
		 'UID',
		 latestMessageUid,
		 'NUMMSGS',
		 number
		].join(" "))
		.then( function(response) {
			//parse that shit
		});
}

parser.prototype.fetchMessage = function(messageUid) {
	return this.executeCommand("UID FETCH", messageUid + " (FLAGS XRECIPSTATUS BODY.PEEK[HEADER+TEXT+THUMBNAILS])")
		.then(function(response) {
			//parse that shit
		});
}

parser.prototype.fetchAttachments = function(messageUid) {
	return this.executeCommand("UID FETCH", messageUid + " (FLAGS BODY.PEEK[ATTACHMENTS])")
		.then(function(response) {
			//parse that shit
		});

}

parser.prototype.sendMessage = function(toPhone, contents) {

}

parser.prototype.select = function(messageBox) {
	messageBox = messageBox || "INBOX";
	return this.executeCommand("SELECT", messageBox);
}

parser.prototype.login = function(username, password) {
	return this.executeCommand("LOGIN ", username + " " + password)
}



module.exports = parser;