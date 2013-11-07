var when   = require('when'),
		util   = require('util'),
		events = require('events');

require("buffertools");

var CRLF  = "\r\n",
		DOUBLE_CLRF_BINARY = 168626701;

var extractHeader = function(buffer, start) {
	//Headers are seperated by the double new lines, \r\n\r\n
	var i            = start || 0;
	//minus 3 because im reading 4 bytes at a time
	while (i < buffer.length-3) {
		if (buffer.readInt32LE(i) == DOUBLE_CLRF_BINARY) {
			//eurika!
			return buffer.slice(start,i);
		}
		i++;
	}
	return null;
}

var findBoundary = function(buffer,boundary,start) {
	boundary = (boundary instanceof Buffer) ? boundary : new Buffer(boundary);
	var end = buffer.length-(boundary.length-1);
	    i = start || 0;
	while (i < end) {
		if (boundary.compare(buffer.slice(i,i+boundary.length)) == 0) {
			//we fuckin found it!
			return i;
		}
		i += 1;
	}
	//no boundary found, i died at the end...
	return buffer.length;
}

var parseHeader = function(header) {
  header   = header.toString("utf8");

	var hline    = null,
			headObj  = {};
	header = header.split(CRLF);
	for (var i = 0, len = header.length; i < len; i++) {
		hline = header[i].split(": ");
		if (hline.length == 2) {
			headObj[hline[0]] = hline[1];
		} else {
			//it must be a boundary, extract that fucker
			//stupid piece of shit, the boundaries used have
			//two more -'s than the boundaries given!
			headObj.boundary = "--" + hline[0].split("\"")[1];
		}
	}
	return headObj;
}

var textMessage = function() {

}


textMessage.prototype.getRawData = function() {
	return this.textResponse;
}

textMessage.createFromBuffer = function(buffer) {
	var m          = new textMessage();
			curPos     = 0
			boundary   = null,
			partHeader = null,
			partBuffer = null;

	m.Header     = null;
	m.Text       = '';
	m.Thumbnails = null;
	m.Attachments = null;

	//parse the header.  Theres only one of these
	m.Header = extractHeader(buffer);

	//skip past the header
	curPos += m.Header.length+4;//4 for the crlfcrlf that defines the header

	m.Header = parseHeader(m.Header);
	
	boundary = new Buffer(m.Header.boundary);

	//Start us off at the first header position
	curPos = findBoundary(buffer,boundary,curPos) + boundary.length + 2;
	//loop through the variable length multiparts.  Keep going while
	//I can still search through a boundary.  If i dont 
	//have enough left for 2 boundaries (gotta start and end)
	//then quit! you're done!
	
	while (buffer.length - curPos > boundary.length*2) {
		//At the start of a part!  read the header!
		partHeader = extractHeader(buffer,curPos);

		curPos += partHeader.length + 4;//move up to where the data starts

		partHeader = parseHeader(partHeader);

		//if i slice from where i am to where i find the next buffer, 
		//thats my part buffer!  minus 2 because the boundary is on a "newline"
		//from the end of the content.  I dont want that
		partBuffer = buffer.slice(curPos, findBoundary(buffer,boundary,curPos)-2);

		//move the curPos past what the msg part was plus the newline
		//that seperated it from the boundary, past the boundary
		//and paste the double newlines
		curPos += partBuffer.length + 2 + boundary.length+2;

		if (partHeader['X-Section-ID'] == "Text-Section") {
			m.Text = partBuffer.toString("utf8");
		} else if (partHeader['X-Section-ID'] == "Thumbnail-Section") {
			m.Thumbnails = m.Thumbnails || [];
			m.Thumbnails.push({
				Headers: partHeader,
				Content: partBuffer
			});
		} else if (partHeader['X-Section-ID'] == "Attachment-Section") {
			m.Attachments = m.Attachments || [];
			m.Attachments.push({
				Headers: partHeader,
				Content: partBuffer
			});
		}
		//I just read a part! =D  maybe do it again?
	}

	return m;

}

util.inherits(textMessage, events.EventEmitter);

module.exports = textMessage;