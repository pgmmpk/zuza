var auth    = require('./auth.js'),
	config  = require('./config'),
	q       = require('q'),
	fs      = require('fs');

function saveUsers(users) {
	var defer = q.defer();
	
	fs.writeFile(config.USERS_FILE, JSON.stringify(users), 'utf8', function(err) {
		if (err) {
			defer.reject(err);
		} else {
			defer.resolve();
		}
	});
	
	return defer.promise;
}

function loadUsers() {
	var defer = q.defer();
	
	fs.exists(config.USERS_FILE, function(exists) {
		
		if (!exists) {
			var adminUser = {
				username : config.ADMIN.username,
				name     : config.ADMIN.name,
				role     : 'admin',
				password : auth.hashPassword(config.ADMIN.password)
			};
			
			var users = {};
			users[config.ADMIN.username] = adminUser;
			
			saveUsers(users).then(function() {
				defer.resolve(users);
			}, function(err) {
				defer.reject(err);
			});

		} else {
			
			fs.readFile(config.USERS_FILE, 'utf8', function(err, data) {
				if (err) {
					defer.reject(err);
				} else {
					defer.resolve(JSON.parse(data));
				}
			});
		}

	});
	
	return defer.promise;
}

function cloneProps(src) {
	var trg = {};
	
	Array.prototype.slice.call(arguments, 1).forEach(function(prop) {
		trg[prop] = src[prop];
	});
	
	return trg;
}

module.exports = {

	authenticate: function(username, password) {
		
		return loadUsers().then(function(users) {
			
			var found = users[username];

			if (found && auth.checkPassword(password, found.password)) {
				var user = cloneProps(found, 'username', 'name', 'role');
				user.token = auth.createAuthToken(username, config.SECRET_KEY);
				return user;
			} else {
				throw 'Authentication failed';
			}
		});
	},
	
	list: function() {
		return loadUsers().then(function(users) {
			var out = [];
			for (var username in users) {
				var user = users[username];
				out.push( cloneProps(user, 'username', 'name', 'role') );
			}
			return out;
		});
	},
	
	read: function(username) {
		return loadUsers().then(function(users) {
			var user = users[username];
			
			if (user) {
				return cloneProps(user, 'username', 'name', 'role');
			} else {
				return undefined;
			}
		});
	},
	
	createOrUpdate: function(username, name, role, password) {
		
		return loadUsers().then(function(users) {

			users[username] = {
				username : username,
				name     : name,
				role     : role,
				password : auth.hashPassword(password)
			};
			
			return saveUsers(users);
		});
	},
	
	update: function(username, name, role, password) {
		
		var found = users[username];
		if (!found) {
			throw 'User not found';
		}
		
		users[username] = { 
			name     : name, 
			role     : role,
			password : auth.hashPassword(password) 
		};
		
		return saveUsers(users);
	},
	
	del: function(username) {
		
		return loadUsers().then(function(users) {
			
			delete users[username];
			
			return saveUsers(users);
		});
	},

	checkAuthToken: function(token) {
		var tk = auth.checkAuthToken(token, config.SECRET_KEY);
		
		if (tk.created + config.LOGIN_REMEMBER_MILLIS < Date.now()) {
			throw "Expired";
		}

		return tk.username;
	},
};
