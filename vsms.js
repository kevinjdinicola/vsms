var when        = require('when'),
		https       = require('https'),
		querystring = require('querystring');

module.exports = vsms = {};

vsms.webAuth = {
	generatePin: function(phone, deviceName) {
		return this.postRequest("/services/generatePIN", {
			mdn       : phone,
			isPrimary : false,
			deviceName: deviceName,
			deviceType: 'IOS'
		})
		.then(this.responseHandler);
	},

	loginPinToken: function(phone, pin, deviceId) {
		return this.postRequest("/services/loginPINToken", {
			mdn     : phone,
			pin     : pin,
			deviceId: deviceId
		}).then(this.responseHandler);
	},

	vma_user_query: function(phone, loginToken) {
		return this.postRequest("/services/vma_user_query", {
			mdn       : phone,
			loginToken: loginToken
		}).then(function(data) {
			if (data == "YES") {
				return when.resolve(data);
			} else {
				return when.reject(data);
			}
		});
	},

	vmaProvisioning: function(phone, loginToken) {
		return this.postRequest("/services/vmaProvisioning", {
			mdn        : phone,
			loginToken : loginToken
		}).then(this.responseHandler);
	},

	pushId: function(phone, loginToken) {
		//need to generate registrationId and type=A
		return this.postRequest("/services/pushId", {
			mdn              : phone,
			loginToken       : loginToken,
			type             : 'A',
			registrationId   : 'aa1100274',
			oldRegistrationId: 'aa1100274'
		}).then(this.responseHandler);;
	},

	assistantQuery: function(phone, loginToken) {
		return this.postRequest("/services/AssistantQuery", {
			mdn       : phone,
			loginToken: loginToken
		}).then(this.responseHandler);;
	},

	removeDevice: function(phone, loginToken, deviceId) {
		return this.postRequest("/services/removeDevice", {
			mdn     : phone,
			pin     : loginToken,
			deviceId: deviceId
		}).then(this.responseHandler);
	},

	responseHandler: function(data) {
		try {
			data = JSON.parse(data);
		} catch(e) {
			when.reject(data);
			data = [{}];
		}
		if (data.length) {
			data = data[0];
		}
		//apperently someone at verizon was having fun
		if (data.status == "OK" || data.status == "COOL") {
			return when.resolve(data);
		} else {
			return when.reject(data);
		}
	},

	postRequest: function(endPoint, arguments) {
		var d = when.defer(),
		    postData = this.processPostArguments(arguments);

		var options = {
			hostname: 'web.vma.vzw.com',
			port    : 443,
			path    : endPoint,
			method  : 'POST',
			headers : {
				'Content-Type'  :'application/x-www-form-urlencoded',
				'Content-Length':Buffer.byteLength(postData)
			}
		}
		//Just uncomment these for when
		//verizon blocks you for overlimitting
		//on failed connections
		// d.resolver.resolve('[{"status":"OVERLIMIT"}]');
		// return d.promise;

		var req = https.request(options, function(res) {
		    res.setEncoding('utf8');
		    res.on('data', function(chunk) {
		        req._dataPart = req._dataPart || "";
		        req._dataPart += chunk;
		    });
		    res.on('end', function() {
		    	d.resolver.resolve(req._dataPart);
		    });
		    res.on('error', function(error) {
		    	d.resolver.reject(error);
		    });
		});
		req.write(postData);
		req.end();

		return d.promise;
	},

	processPostArguments: function(arguments) {
		return querystring.stringify(arguments)
	}
} 