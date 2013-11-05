var when   = require('when'),
		util   = require('util'),
		events = require('events'),
		textMessage = require('./textMessage');



var CRLF  = "\r\n",
		HELLO_RESPONSE = "* OK IMAP4rev1";

var packetIdFromLine = function(line) {
	return line.substring(2,line.indexOf(" "));
}

var shouldAddLine  = function(line) {
	return line.indexOf("*") == 0 || line.indexOf("EA") == 0;
}
var lineEndsPacket = function(line) {
	// console.log("line",line,"ends packet:",line.indexOf("EA"));
	return line.indexOf("EA") == 0;
}

var lineRequestsBlob = function(line) {
	var match = line.match(/\{[0-9]+\}$/)
	if (match) {
		match = match[0];
		return match.substring(1,match.length-1);
	}
	return null;
}


var parser = function(connection) {
	this._connection = connection;
	this._commandCounter = 1;
	this._commandDeferMap = {};
	this._blobMap = {};
	this._currentPacket = [];
	this._currentLine   = '';
	this._currentBlob   = '';
	this._helloDeferred = when.defer();
}
util.inherits(parser, events.EventEmitter);

parser.prototype.executeCommand = function(command, args) {
	var d         = when.defer(),
			cnt       = this.getCounter(),
			cmdString = "EA"+cnt + " " + command + " " + args + CRLF;

 //  d.packetId = cnt;
	// d.testProperty = "kevin"	;
	this._commandDeferMap[cnt] = d;
	console.log("<< "+cmdString);
	this.getConnection().write(cmdString);

	return d.promise
		.then(this.genericPacketProcessor);
}

parser.prototype.genericPacketProcessor = function(data) {
	if (data && data.length && data[data.length-1].indexOf("OK") > -1) {
		console.log("Packet OK:",data[data.length-1]);
		return when.resolve(data);
	} else {
		console.log("Packet NO:",data[data.length-1]);
		return when.reject(data);
	}
}

parser.prototype.dataReceived = function(chunk) {

	console.log(">> " + chunk);
	if (chunk.indexOf(HELLO_RESPONSE) > -1) {
		if (!this._receivedHello) {
			this._helloDeferred.resolve();
			this._receivedHello = true;
		}
		return;
	}
	var blob = this._currentBlob;
	var chunkLength = chunk.length;

	var lineEnding = chunk.indexOf(CRLF);


	if (blob) {
		if (chunkLength >= blob) {
			//finish our blob and allow the loop to go on!
			this._currentLine += chunk.substring(0,blob);
				// console.log("BLOBLOG: ",this._currentLine.length);
			this._currentPacket.push(this._currentLine);
			this._currentLine = '';
			blob = null;
			this._currentBlob = null;
		} else {
			//copy what we can! then set whats left in a flag!
			this._currentLine += chunk;
			blob -= chunkLength;
			this._currentBlob = blob;
			return;
		}
	}

	while (lineEnding > -1 && !blob) {
		//add everything up till the packet ending
		this._currentLine += chunk.substring(0,lineEnding);
		//add the last packet ending line
		if (shouldAddLine(this._currentLine)) {
			this._currentPacket.push(this._currentLine);

			blob = lineRequestsBlob(this._currentLine);

			if (lineEndsPacket(this._currentLine)) {
				//launch the packet
				var packetDeferred = this._commandDeferMap[packetIdFromLine(this._currentLine)];
				if (packetDeferred) {
					packetDeferred.resolve(this._currentPacket);
					this._currentPacket = [];
				}
			}
		}

		chunk = chunk.substring(lineEnding+CRLF.length);
		lineEnding = chunk.indexOf(CRLF)
		this._currentLine = '';

		//try and empty blob.  if we can empty blob with our current data, that means more
		//'lines' can be parsed.  we want to parse those lines
		if (blob) {
			if (chunkLength >= blob) {
				//finish our blob and allow the loop to go on!
				this._currentLine = chunk.substring(0,blob);
				blob = null;
				// console.log("BLOBLOG: ",this._currentLine.length);
				this._currentPacket.push(this._currentLine);
				this._currentLine = '';
				this._currentBlob = null;
			} else {
				//copy what we can! then set whats left in a flag!
				this._currentLine = chunk;
				blob -= chunkLength;
				this._currentBlob = blob;
			}
		}
	}

	this._currentLine += chunk;
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
			var conversations = [];
			for (var i = 0; i < response.length-1; i++) {
				var sp = response[i].split(" ");
				conversations.push({
					phone: sp[4],
					latestMessageUid  : sp[6]
				})
			}
			return when.resolve(conversations);
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
			var messages = [];
			for (var i = 0; i < response.length-1; i++) {
				var sp = response[i].split(" ");
				messages.push({
					phone: sp[5],
					messageUid  : sp[7].substring(0,sp[7].length-1)
				})
			}
			return when.resolve(messages);
		});
}

parser.prototype.fetchMessage = function(messageUid) {
	return this.executeCommand("UID FETCH", messageUid + " (FLAGS XRECIPSTATUS BODY.PEEK[HEADER+TEXT+THUMBNAILS])")
		.then(function(response) {
			response[1] = Buffer(response[1],'ascii').toString('ascii');
			var msg = new textMessage(response[1]);
			console.log("ASDFASDF",msg)
			return when.resolve(msg);
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
	return this.executeCommand("LOGIN ", username + " " + password);
}



module.exports = parser;