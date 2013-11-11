var when   = require('when'),
		util   = require('util'),
		events = require('events');

require("buffertools");

var CRLF  = "\r\n",
		CLRF_BINARY = 2573,
		DOUBLE_CLRF_BINARY = 168626701;

var genRandom = function(length, base) {
	base = base || 16;
	var res = "";
	for (var i = 0; i < length; i++) {
		res += (Math.random()*base|0).toString(base);
	}
	return res;
}

var extractHeader = function(buffer, start) {
  //Headers are seperated by the double new lines, \r\n\r\n
  var i            = start || 0;
  //minus 3 because im reading 4 bytes at a time
  while (i < buffer.length-3) {
    if (buffer.readInt32LE(i) == DOUBLE_CLRF_BINARY) {
      //eurika!
      return buffer.slice(start,i);
    } else if (i+2 == buffer.length-2 && buffer.readInt16LE(i+2) == CLRF_BINARY) {
    	// sometimes there is just a \r\n at the end of a header
      return buffer.slice(start, i+2);
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
	return -1;
}

var generateBoundary = function() {
	return "----=_Part_" + genRandom(3,10) + "_" + genRandom(8,10) + "." + genRandom(13);
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
			if (hline[0].indexOf("boundary") > -1) {
				//it must be a boundary, extract that fucker
				//stupid piece of shit, the boundaries used have
				//two more -'s than the boundaries given!
				headObj.boundary = "--" + hline[0].split("\"")[1];
			}
		}
	}
	return headObj;
}

var textMessage = function(options) {
	if (options) {
		this.To = options.To;
		this.Text = options.Text;
	}
}

textMessage.prototype.serialize = function() {
	//first generate the main message
	var outerBoundary = generateBoundary();

	var output = [
		'Date: ' + (new Date()).toString(),
		'From: ' + this.From,
		"To: "   + this.To,
		"Message-ID: vzm_" + genRandom(8) + "_" + genRandom(8) + "_" + genRandom(4),
		"Content-Type: multipart/mixed;",
		"\tboundary=\"" + outerBoundary + "\"",
		"Message-Type: SMS",
		"Message-Source: IMAP",
		"",
		"--"+outerBoundary,
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Length: " + Buffer.byteLength(this.Text, "utf8"),
		"Content-Transfer-Encoding: 7bit",
		"x-section-id: Text-Section",
		"content-id: text.txt",
		"content-location: text.txt",
		"",
		this.Text,
		"--"+outerBoundary+"--",
		""];


	return output.join(CRLF);
}

textMessage.createFromBuffer = function(buffer) {
	var m          = new textMessage();
			curPos     = 0
			boundary   = null,
			partHeader = null,
			partBuffer = null,
			multipartSectionId = [];

	m.Header     = null;
	m.Text       = '';
	m.Thumbnails = null;
	m.Attachments = null;

	//parse the header.  Theres only one of these
	m.Header = extractHeader(buffer);

	//skip past the header
	curPos += m.Header.length+4;//4 for the crlfcrlf that defines the header

	m.Header = parseHeader(m.Header);

	boundary = [new Buffer(m.Header.boundary)];

	if (m.Header['X-Section-ID']) {
		multipartSectionId.unshift(m.Header['X-Section-ID']);
	}

	//Start us off at the first header position
	curPos = findBoundary(buffer,boundary[0],curPos) + boundary[0].length + 2;
	//loop through the variable length multiparts.  Keep going while
	//I can still search through a boundary.  If i dont
	//have enough left for 2 boundaries (gotta start and end)
	//then quit! you're done!
	while (curPos < buffer.length) {
		//At the start of a part!  read the header!
		partHeader = extractHeader(buffer,curPos);

		curPos += partHeader.length + 4;//move up to where the data starts

		partHeader = parseHeader(partHeader);

		if (partHeader['Content-Type'] == 'multipart/mixed; ') {
			//I just read a header and there _IS_ no content.
			//all that is waiting for me at curpos (instead of content)
			//is the boundary i just read from content-type.  so skip ahead of that
			//that boundry, reposition at the beginning of the content header, at eat it up.

			//we need to add this boundary as first in our boundary list so we can keep track
			//of what multipart/mixed things we're in
			multipartSectionId.unshift(partHeader['X-Section-ID']);
			boundary.unshift(new Buffer(partHeader.boundary));
			curPos += boundary[0].length + 2; //2 for the newline which brings us to a new piece of content

		} else {
			//if i slice from where i am to where i find the next buffer,
			//thats my part buffer!  minus 2 because the boundary is on a "newline"
			//from the end of the content.  I dont want that
			partBuffer = buffer.slice(curPos, findBoundary(buffer,boundary[0],curPos)-2);

			//move the curPos past what the msg part was plus the newline
			//that seperated it from the boundary, past the boundary
			//and paste the double newlines
			curPos += partBuffer.length + 2 + boundary[0].length;

			//well now i have a partHeader and a partBuffer, lets store that shit!

			//do we need to apply sections-ids?
			if (!partHeader['X-Section-ID'] & multipartSectionId.length) {
				partHeader['X-Section-ID'] = multipartSectionId[0];
			}

			//Decide what to do with our ill gotten gains
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

			//we are now sitting at the end of a boundary that closes a section.
			//we have an important question to ask.  is there a newline or a --?
			//if there is a newline, what follows is more headers (and more content)
			//if there is a --, the multipart is closed.  we must shift off the boundary
			//to get back to the multipart that we were in.
			//Either way, we eat 2 for the \r\n or the --.


			//POSITION OURSELVES TO WHERE THE NEXT PART IS!
			//if we are right before some content, directly after the boundary is \r\n
			var nextBoundaryPos;
			while (curPos < buffer.length && buffer.readInt16LE(curPos) != CLRF_BINARY) {
				curPos+=2;
				boundary.shift();
				multipartSectionId.shift();

				//just a quick check, we could have gotten to the end
				//or popped off our last boundary.. meaning we're basically at
				//the end
				if (curPos == buffer.length-2 || !boundary.length) {
					//there is a -2 because after the end of the boundary-- there is
					//one more newline!
					continue;
				}

				nextBoundaryPos = findBoundary(buffer, boundary[0], curPos);
				if (curPos < -1) {
					//err.. lets leave.  we didnt find the next boundary for the multipart we
					//were in
					curPos = buffer.length;
				} else {
					//Ah!  we found the next boundary!  how delightful.  i wonder what ends it?
					//This loop checks what ends it and does things appropriately, so i am
					//going to position myself at the end of the boundary i found
					curPos = nextBoundaryPos+boundary[0].length;
				}

				//we arent at the beginning. try to find one
			}

			//What we found WAS at the beginning of some content.  move past that \r\n
			//this also eats up the \r\n at the end of the file
			curPos+=2;


			//I just read a part! =D  maybe do it again?
		}

	}

	return m;

}

module.exports = textMessage;