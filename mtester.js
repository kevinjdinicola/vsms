var vsms   = require("./vsms"),
		config = require("./phoneConfig.json"),
		when   = require('when'),
		readline   = require('readline'),
		fs     = require("fs"),
		TextMessage = require("./textMessage"),
		argv = require("optimist").argv;

var Messenger = vsms.messenger;

var iphone = new Messenger(config);

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

if (argv.n && argv.m) {
	//write messages!
	console.log('Messaging mode!');
	iphone.login()
		.then(function() {
			return iphone.select();
		})
		.then(function() {
			var text = new TextMessage({To:argv.n, Text:argv.m});
			return iphone.sendMessage(text);
		})
		.then(function() {
			console.log("Message sent!");
			process.exit(0);
		}, function(e) {
			console.error(e);
			process.exit(1);
		})

} else if (argv.i) {
	console.log('IDLE MODE TEST!');
	iphone.login()
		.then(function() {
			return iphone.select();
		})
		.then(function() {
			// iphone.parser.on('lineReceived', function(line) {
			// 	console.log(line);
			// });
			// console.log('waiting on idle lines!');
			iphone.idle();
			
		})
} else {
	//demo mode!
	console.log("Logging in...")
	iphone.login()
		.then(function() {
			console.log("Logged in!");
		})
		.then(function() {
			console.log("Selecting inbox...");
			return iphone.select();
		})
		.then(function() {
			var text = new TextMessage({To:"7142900481", Text:"hello from my computer!"});
			return iphone.sendMessage(text);
		})
		// .then(function() {
		// 	console.log("Seleted inbox!")
		// 	console.log("listing conversations...");
		// 	return iphone.listConversations();
		// })

		//single image 233727023
		//double image 233734295
		// .then(function() {
		// 	console.log("selecting specific message");
		// 	return iphone.fetchAttachments('233727023');
		// })


		// .then(function(conversations) {
		// 	console.log("Listed conversations!  Got ", conversations.length);
		// 	var conv = conversations[0];
		// 	console.log("Listing messages for the first one (" + conv.participantUid+ ")");
		// 	return iphone.listMessageThread(conv.participantUid,conv.latestMessageUid, 5);
		// })
		// .then(function(messages) {
		// 	console.log("Listed messages!  Got " + messages.length);
		// 	console.log("Fetching message contents for latest (Uid: " + messages[0].messageUid+ ")...");
		// 	return iphone.fetchMessage(messages[0].messageUid);
		// })
		// .then(function(message) {
		// 	//Do Attachments
		// 	if (message.Attachments.length) {
		// 		console.log("You retrieved " + message.Attachments.length + " attachments");
		// 		var th = message.Attachments;
		// 		for (var i = 0, len = th.length; i < len; i++) {
		// 			console.log("Saving " + th[i].Headers['Content-Location'] + "...");
		// 			fs.writeFileSync(th[i].Headers['Content-Location'], th[i].Content);				
		// 		}
		// 	} else {
		// 		console.log("Your last message:")
		// 		console.log(message.Header.From + " -> " + message.Header.To + "\n" + message.Text);

		// 		//Do Thumbnails
		// 		if (message.Thumbnails.length) {
		// 			console.log("Also, your message has " + message.Thumbnails.length + " attachments");
		// 			var th = message.Thumbnails;
		// 			for (var i = 0, len = th.length; i < len; i++) {
		// 				console.log("Saving " + th[i].Headers['Content-Location'] + "...");
		// 				fs.writeFileSync(th[i].Headers['Content-Location'], th[i].Content);				
		// 			}
		// 		}
		// 	}

		// })
		.then(function() {
			console.log("Finished!");
			iphone.disconnect();
			process.exit();
		}, function(error) {
			console.error(error);
		});	


		// .then(function(convos) {
		// 	var firstConvo = convos[0];

		// 	return iphone.listMessages(firstConvo.phone,firstConvo.latestMessageUid)
		// }).then(function(response) {
		// 	var msg = response[0];
		// 	console.log(msg);
		// 	return iphone.fetchMessage(msg.messageUid);
		// }).then(function(msg) {
		// 	console.log(msg[1].toString("utf8"));
		// 	console.log("done");
		// 	console.log(msg);
		// })
}


		
