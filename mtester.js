var vsms   = require("./vsms"),
		config = require("./phoneConfig.json"),
		when   = require('when'),
		readline   = require('readline'),
		fs     = require("fs");

var Messenger = vsms.messenger;

var iphone = new Messenger(config);

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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
		console.log("Seleted inbox!")
		console.log("listing conversations...");
		return iphone.listConversations();
	})
	.then(function(conversations) {
		console.log("Listed conversations!  Got ", conversations.length);
		var conv = conversations[0];
		console.log("Listing messages for the first one (" + conv.participantUid+ ")");
		return iphone.listMessageThread(conv.participantUid,conv.latestMessageUid, 5);
	})
	.then(function(messages) {
		console.log("Listed messages!  Got " + messages.length);
		console.log("Fetching message contents for latest (Uid: " + messages[0].messageUid+ ")...");
		return iphone.fetchMessage(messages[0].messageUid);
	})
	.then(function(message) {
		console.log("Your last message:")
		console.log(message.Header.From + " -> " + message.Header.To + "\n" + message.Text);
		console.log(message);
		if (message.Thumbnails.length) {
			console.log("Also, your message has " + message.Thumbnails.length + " attachments");
			var th = message.Thumbnails;
			for (var i = 0, len = th.length; i < len; i++) {
				console.log(th[i].Headers)
				console.log("Saving " + th[i].Headers['Content-Location'] + "...");
				fs.writeFileSync(th[i].Headers['Content-Location'], th[i].Content);				
			}
		}
	})
	.then(function() {
		console.log("Finished!");
		iphone.disconnect();
		process.exit();
	}, function(error) {
		console.error("Error", error)
		iphone.disconnect();
		process.exit();
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