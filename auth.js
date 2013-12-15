/* jslint node: true */
'use strict';

var crypto = require('crypto');

/*
	Authentication works like this:

	User is authenticated with username/password pair and gets authentication token.
	Authentication token embeds username and creation date in a secure way. Its very difficult (impossible) for client 
	to forge authentication token.
	Server can verify that token is valid by checking its signature and decrypted content.

	Important security concerns:
		1. Authentication step MUST USE SECURE TRANSPORT. Because username/password pair is sent as cleartext to the server.
		2. Password should not be stored in the database. Instead, store hashed version of the password.
		3. If attacker gets hold of authentication token (for example, by physically examining hard drive or intercepting token en-route), he 
		   gets full access to protected resource, all bets are off.
		
	Authentication token structure:
	
	<authToken> := <username> / <encrypted>
	<encrypted> := <hmac-signature> : <payload>
	<payload>   := AES-256-CBC( <objstring> <salt> )
	
	Here:
	<hmac-signature> is HMAC-SHA1 hash of <payload> (secured by secret key)
	<payload> is AES-256 encrypted string of <objstring> <salt>
	<objstring> is a string representation of object (obtained by just doing JSON.stringify(object))
	<salt> is a random vector
	
	Notes:
		If attacker knows secret key, he can create any token (all bets are off). 
		<salt> is used to randomize cleartext and therefore protect against "known cleartext" attack on AES-256 secret key
		<hmac-signature> is a HMAC signature that is deterministic, but not reversible function of 
			<payload> and secret password and is used to sign the <payload>, protecting it from tampering.
*/

/**
 *  Generates string that is encrypted and signed version of the input object.
 * 
 *  @param obj Object to encrypt.
 *  @returns encryption
 */
function encryptAndSign(obj, secret_key) {
	var objs = JSON.stringify(obj);
	var salt = crypto.randomBytes(16).toString('hex');

	var cipher = crypto.createCipher('aes-256-cbc', secret_key);
	var encoded = cipher.update(objs + salt, 'binary', 'hex') + cipher.final('hex');

	var signature = crypto.createHmac('sha1', secret_key).update(encoded).digest('hex');

	return signature + ':' + encoded;
}

/**
 * Decrypts signed string into an object. Verifies that signature is valid.
 * 
 * @param s encryption string
 * @returns decrypted object
 */
function verifyAndDecrypt(s, secret_key) {
	var ss = s.split(':');
	if (ss.length !== 2) {
		throw new Error('invalid token');
	}
	
	var signature = ss[0];
	var encoded   = ss[1];

	if( signature !== crypto.createHmac('sha1', secret_key).update(encoded).digest('hex') ) {
		throw new Error('invalid token');
	}

	var cipher = crypto.createDecipher('aes-256-cbc', secret_key);
	var plaintext = cipher.update(encoded, 'hex') + cipher.final();

	plaintext = plaintext.slice(0, plaintext.length - 32); // strip off salt
	return JSON.parse(plaintext);
}

function hashPassword(password) {
	// create random salt
	var salt = crypto.randomBytes(16).toString('hex');
	
	return crypto.createHmac('sha1', salt).update(password).digest('hex') + ':' + salt;
}

function checkPassword(password, hashedPassword) {
	var parts = hashedPassword.split(':'); 
	
	if (parts.length !== 2) {
		return false;
	}
	
	var hash = parts[0];
	var salt = parts[1];

	return hash === crypto.createHmac('sha1', salt).update(password).digest('hex');
}

function createAuthToken(username, secret_key) {
	var token = encryptAndSign({
		'username': username,
		'created' : Date.now()
	}, secret_key);

	return username + '/' + token;
}

function checkAuthToken(token, secret_key) {
	var parts = token.split('/');
	if (parts.length !== 2) {
		throw new Error('invalid token');
	}
	
	var username = parts[0];
	var tk = verifyAndDecrypt(parts[1], secret_key);
	
	if (username !== tk.username) {
		throw new Error('invalid token');
	}
	
	return tk;
}

module.exports = {
	hashPassword     : hashPassword,
	checkPassword    : checkPassword,
	encryptAndSign   : encryptAndSign,
	verifyAndDecrypt : verifyAndDecrypt,
	createAuthToken  : createAuthToken,
	checkAuthToken   : checkAuthToken
};
