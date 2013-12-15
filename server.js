var express = require('express'), 
	app     = express(), 
	http    = require('http'), 
	server  = http.createServer(app), 
	user    = require('./user'), 
	path    = require('path'), 
	fs      = require('fs'), 
	Busboy  = require('busboy'), 
	utils   = require('./utils'), 
	config  = require('./config');

function ensureAuthenticated(req, res, next) {
	var token;

	// Most requests are authenticated via headers. But download
	// requests can not be done via AJAX and therefore we have no control
	// over headers. Solution is to allow "query" form of passing auth token ---
	// as a 'authorization' query parameter.
	var postAuthorization = req.headers.authorization;
	if (postAuthorization && postAuthorization.indexOf('Zuza ') === 0) {
		token = postAuthorization.slice('Zuza '.length);
	} else if (req.query.authorization) {
		token = req.query.authorization;
	} else {
		console.log('NOT AUTHORIZED:', req);
		return res.send(401);
	}

	try {
		req.username = user.checkAuthToken(token);
	} catch (error) {
		console.log('AUTHENTICATION ERROR:', error);
		return res.send(401);
	}
	
	user.read(req.username).then(function(user) {
		if (!user) {
			return res.send(401);
		}
		
		next();
	}, function(error) {
		console.log('ERROR reading user DB', error);
		return res.send(500);
	})
}

function ensureAdminRole(req, res, next) {
	
	user.read(req.username).then(function(user) {
		if (user.role === 'admin') {
			return next();
		} else {
			res.send(403);
		}
	}).fail(function(error) {
		console.log('Error reading users DB', req.username, error);
		res.send(500);
	});
}

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon(__dirname + '/public/images/favicon.ico'));
app.use(express.json());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

function buildIdPath(date) {
	if (date === undefined) {
		date = new Date(); // now
	}

	var month = '' + (date.getUTCMonth() + 1);
	if (month.length < 2) {
		month = '0' + month;
	}
	var day = '' + date.getUTCDate();
	if (day.length < 2) {
		day = '0' + day;
	}
	return [ '' + date.getUTCFullYear(), month, day ].join('');
}

function parseIdPath(dir) {
	
	var parts = dir.split('/');
	if (parts.length !== 2) {
		return null;
	}

	return {
		year  : parts[0].slice(0, 4),
		month : parts[0].slice(4, 6),
		day   : parts[0].slice(6, 8),
		owner : parts[1]
	};
}

app.post('/api/upload', ensureAuthenticated, function(req, res) {
	var idPath = buildIdPath() + '/' + req.username;
	
	var busboy = new Busboy({ 
		headers: req.headers,
		defCharset: 'utf-8',
		limits: {
			fileSize: config.FILE_SIZE_LIMIT
		}
	});

	var makePublic = req.query['public'] === 'true';
	var infiles = 0, outfiles = 0, endSeen = false;
	
	function maybeDone() {
		if (endSeen && infiles === outfiles) {
			res.send(200);
		}
	}
	
	busboy.on('error', function(err) {
		console.log('ERROR in upload', err);
		res.send(500);
	
	}).on('file', function(field, stream, filename) {
		var mode = makePublic ? 0640 : 0600;
		
		infiles += 1;
		
		var fname = config.DATASTORE + '/' + idPath + '/' + filename.replace('..', '');
		var ostream = fs.createWriteStream(fname, {mode: mode});
		ostream.on('close', function() {
			outfiles += 1;
			maybeDone();
		});
			
		stream.pipe(ostream);

	}).on('end', function() {
		endSeen = true;
		maybeDone();
	});

	utils.createDirectories(config.DATASTORE + '/' + idPath, function(err) {
		if (err) {
			console.log('ERROR: failed to create directory', idPath, err);
			return res.send(500);
		}

		req.pipe(busboy);
	});
});

/** *** API *** */

function isPublic(f) {
	return 0 !== (040 & f.stat.mode); // group read bit is used as 'public' indicator
}

app.post('/api/login', function(req, res) {

	user.authenticate(req.body.username, req.body.password).then(function(user) {
		res.json(user);
	}, function(error) {
		res.send(403);
	});
});

app.get('/api/user', ensureAuthenticated, ensureAdminRole, function(req, res) {
	
	user.list().then(function(users) {
		res.json(users);
	}, function(err) {
		console.log('ERROR: failed to list users (io failed): ', err);
		res.send(500);
	});
});

app.get('/api/user/:username', ensureAuthenticated, ensureAdminRole, function(req, res) {
	
	user.read(req.params.username).then(function(user) {
		res.json(user);
	}, function(err) {
		console.log('ERROR: failed to read user (io failed): ', err);
		res.send(500);
	});
});

app.post('/api/user/:username', ensureAuthenticated, ensureAdminRole, function(req, res) {
	var username = req.params.username;
	var name     = req.body.name;
	var role     = req.body.role;
	var password = req.body.password;
	
	if (username && password && name) {
		user.createOrUpdate(username, name, role, password).then(function() {
			res.send(200);
		}, function(err) {
			console.log('ERROR: failed to create new user (io failed): ', err);
			res.send(500);
		});
	} else {
		console.log('ERROR: failed to create new user (bad params): ', username, req.body);
		res.send(500);
	}
});

app.del('/api/user/:username', ensureAuthenticated, ensureAdminRole, function(req, res) {
	
	user.del(req.params.username).then(function() {
		res.send(200);
	}, function(err) {
		console.log('ERROR: failed to delete user (io failed): ', err);
		res.send(500);
	});
});

app.get('/api/files', ensureAuthenticated, function(req, res) {

	var date = req.query.date;
	var wantPublic = req.query['public'];
	
	utils.filesAtDate(config.DATASTORE, date, function(err, files) {
		
		if (err) {
			console.log('ERROR scanning files: ' + err);
			res.send(500);
			return;
		}

		if (wantPublic) {
			files = files.filter(function(f) {
				return f['public'];
			});
		} else {
			files = files.filter(function(f) {
				return f.owner === req.username;
			});
		}

		res.json(files);
	});
});

app.post('/api/files', ensureAuthenticated, function(req, res) {

	var action = req.body.action;

	req.body.fileIds.forEach(function(fileId) {
		fileId = fileId.replace('..', ''); // security
		var dirId = fileId.slice(0, fileId.lastIndexOf('/'));
		var info = parseIdPath(dirId);

		if (!info) {
			console.log('ERROR: malformed path: ', dirId);
			res.send(500);
			return;
		}

		if (info.owner !== req.username) {
			res.send(403);
			return;
		}

		if (action === 'delete') {
			fs.unlink(config.DATASTORE + '/' + fileId, function(err) {

			});
		} else if (action === 'makePublic') {
			fs.chmod(config.DATASTORE + '/' + fileId, 0640, function(err) {

			});
		} else if (action === 'makePrivate') {
			fs.chmod(config.DATASTORE + '/' + fileId, 0600, function(err) {

			});
		}
	});

	res.send(200);
});

app.get('/api/dashboard', ensureAuthenticated, function(req, res) {

	var collection = [];
	var size = 0;

	utils.readFiles(config.DATASTORE, req.query.olderThan, function(err, data, next) {
		
		if (err) {
			console.log('ERROR scanning files: ' + err);
			res.send(500);
			return;
		}
		
		if (data === null) {
			// no more
			res.send(collection);
			return;
		}
		
		var files = data.files.filter(function(f) {
			return f['public'];
		});

		if (files.length > 0) {
			collection.push( {
				dirId: data.dirId,
				files: files,
				
				year : data.year,
				month : data.month,
				day : data.day
			} );
			
			size += files.length;
			
			if (size > config.MAXFILES) {
				res.send(collection);
				return;
			}
		}

		next();
	});
});

app.get('/api/tree', ensureAuthenticated, function(req, res) {
	var wantPublic = !!req.query['public'];

	utils.readDateTree(config.DATASTORE, function(err, dates) {
		
		if (err) {
			console.log('ERROR scanning files: ' + err);
			res.send(500);
			return;
		}
		
		var collection = [];

		dates.forEach(function(data) {
			var files;

			if (wantPublic) {
				files = data.files.filter(function(f) {
					return f['public'];
				});
			} else {
				files = data.files.filter(function(f) {
					return f.owner === req.username;
				});
			}
			if (files.length) {
				collection.push({
					dirId: data.dirId,
					year : data.year,
					month : data.month,
					day : data.day,
					size : files.length
				});
			}
		});
		
		res.json(collection);
	});
});

app.get('/api/download', ensureAuthenticated, function(req, res) {
	var fileId = req.query.fileId.replace('..', ''); // security
	var dirId = fileId.slice(0, fileId.lastIndexOf('/'));
	var fname = fileId.slice(dirId.length + 1);
	var info = parseIdPath(dirId);

	if (!info) {
		res.send(500);
		return;
	}

	fs.stat(config.DATASTORE + '/' + fileId, function(err, stat) {
		if (err) {
			console.log('ERROR: attempt to download non-existing file:',
					fileId, req.userid, err);
			res.send(500);
		} else if (info.owner === req.userid || 0 !== (stat.mode & 0x20)) {
			res.setHeader('Content-type', 'application/octet-stream');
			res.setHeader('Content-disposition', 'attachment; filename=' + encodeURIComponent(fname));
			fs.createReadStream(config.DATASTORE + '/' + fileId).pipe(res);
		} else {
			console.log('WARNING: attempt to download protected file:', fileId,
					req.userid);
			res.send(403); // permission denied
		}
	});
});

function renderIndex(req, res) {
	res.render('index');
}

function renderPartial(req, res) {
	res.render('partials/' + req.params.name);
}

// redirect from old location
app.get('/upload', function(req, res) {
	res.redirect('/');
});

app.get('/login', renderIndex);
app.get('/files', renderIndex);
app.get('/settings', renderIndex);
app.get('/public', renderIndex);
app.get('/tree', renderIndex);
app.get('/user', renderIndex);
app.get('/user/:username', renderIndex);
app.get('/', renderIndex);
app.get('/partials/:name', renderPartial);

server.listen(app.get('port'), function() {
	console.log('Express server listening on port ' + app.get('port'));
});
