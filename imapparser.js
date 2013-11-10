var when   = require('when'),
		util   = require('util'),
		events = require('events'),
		fs     = require('fs');


var CRLF  = "\r\n",
		CLRF_BINARY = 2573,
		HELLO_RESPONSE = "* OK IMAP4rev1";

var packetIdFromLine = function(line) {
	return line.substring(2,line.indexOf(" "));
}

var shouldAddLine  = function(line) {
	return line.indexOf("*") == 0 || line.indexOf("EA") == 0;
}

var lineEndsPacket = function(line) {
	return line.indexOf("EA") == 0;
}

var lineRequestsBlob = function(line) {
	var match = line.match(/\{[0-9]+\}$/)
	if (match) {
		match = match[0];
		return parseInt(match.substring(1,match.length-1),10);
	}
	return null;
}


var parser = function(stream) {
	var that = this;
	stream.on('data', function() {
			that.dataReceived.apply(that,arguments);
		});
	this.lineStack  = [];
	this.blobLeft = 0;
	this.lineBuffer = null;
	this.blobBuffer = null;
}
util.inherits(parser, events.EventEmitter);


parser.prototype.processLine = function(buffer) {
	//get the text line from the buffer
	var strLine = buffer.toString("utf8"),
			blobLen = lineRequestsBlob(strLine),
			isUntag = strLine.indexOf("*") == 0,
			isTag   = strLine.indexOf("EA") == 0

	this.emit("lineReceived",strLine);

	//is it one of the 2 cases where I add it?
	if (isUntag || isTag) {
		//add the line to our line stack
		this.lineStack.push(strLine);

		//Do i need a blob buffer set up?  If i do, its set right here with blob len.
		if (blobLen) {
			this.blobLeft = blobLen;
			this.blobBuffer = new Buffer(blobLen);
		}

		//should i empty out the linestack? i know the req id from EA#
		if (isTag) {
			var id = strLine.substring(2,strLine.indexOf(" "));
			//send an event with the ID and the packet info
			this.emit("packet", id, this.lineStack);
			//Reset the lineStack to nothing
			this.lineStack = [];
		}
	}
}

parser.prototype.dataReceived = function(chunk) {
	var chunkLen = chunk.length;
			curPos    = 0;
	// console.log('>> ', chunk.toString("utf8"));

			//while we have more data to read
	while (curPos < chunkLen) {

		if (!this.blobLeft) {
			//keep searching until you find the new line.
			for (var searchIndex = curPos; searchIndex < chunkLen-1; searchIndex++) {
				if (chunk.readInt16LE(searchIndex) == CLRF_BINARY) {
					//we found a line break!  read all of this into a line!
					var lineEndBuffer  = new Buffer(searchIndex - curPos);
					//Put that into a new buffer!
					chunk.copy(lineEndBuffer, 0, curPos, searchIndex); //search index finds it on the first byte, so copy the second too!
					
					var fullLineBuffAry = [lineEndBuffer];
					if (this.lineBuffer) {
						fullLineBuffAry.unshift(this.lineBuffer);
						this.lineBuffer = null;
					}

					this.processLine(Buffer.concat(fullLineBuffAry));
					curPos = searchIndex+2; //start again past where i stopped
					//get out of the for loop, i only want to search until i find it once!
					break;
				} else if  (searchIndex == chunkLen-2) {
					//everything from the last current position to the end of the chunk couldnt be
					//"lined", so stuff it in our line buffer 
					var lineBufAry = [chunk.slice(curPos, chunkLen)];
					if (this.lineBuffer) {
						lineBufAry.unshift(this.lineBuffer)
					}
					curPos = chunkLen;
					this.lineBuffer = Buffer.concat(lineBufAry);
				}
			}

		} else {
			//so you want to read a blob?
			if (chunkLen-curPos >= this.blobLeft) {
				//finish reading the entire blob, then we loop back around and continue reading data
				
				// console.log("filling in parts from " + (this.blobBuffer.length-this.blobLeft) + " to " + (this.blobBuffer.length-this.blobLeft + (curPos + this.blobLeft-curPos)) + " of " + this.blobBuffer.length);
				chunk.copy(this.blobBuffer,this.blobBuffer.length-this.blobLeft, curPos, curPos + this.blobLeft);
				//finish off the blob
				this.blobLeft = 0;

				//add it to the line stack, because, why not!
				this.lineStack.push(this.blobBuffer);
				this.blobBuffer = null;

				//increment curPos by blobLeft, because thats how much we just read
				curPos += this.blobLeft;
			} else {
				//blob needs more than this chunk provides!  read it all into bloby!
				// console.log("filling in parts from " + (this.blobBuffer.length-this.blobLeft) + " to " + (this.blobBuffer.length-this.blobLeft + (chunkLen-curPos)) + " of " + this.blobBuffer.length);
				chunk.copy(this.blobBuffer,this.blobBuffer.length-this.blobLeft, curPos, chunkLen);
				//subtract how much we read from how much is left from the blob
				this.blobLeft -= chunkLen - curPos;
				//increment the current position by how much we read.  Since this branch of the logic
				//means the chunk didn't have enough in it for our blob Buffer, we read everything.
				curPos = chunkLen;
			}
		}
	}
}



module.exports = parser;
