var express = require('express'), 
	app     = express(), 
	http    = require('http'), 
	server  = http.createServer(app), 
	user    = require('./user'), 
	path    = require('path'), 
	q       = require('q'),
	Busboy  = require('busboy'), 
	config  = require('./config'),
	store   = require('./filestore').FileStore(config.DATASTORE);

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
			console.log('AUTHENTICATION ERROR: valid token, but user not found in the DB');
			return res.send(401);
		}
		
		next();
	}, function(error) {
		console.log('ERROR reading user DB', error);
		return res.send(500);
	});
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
app.use(express.favicon(__dirname + '/graphics/favicon.ico'));
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

/** *** API *** */

app.post('/api/login', function(req, res) {

	user.authenticate(req.body.username, req.body.password).then(function(user) {
		res.json(user);
	}, function(error) {
		res.send(403);
	}).done();
});

app.get('/api/user', ensureAuthenticated, ensureAdminRole, function(req, res) {
	
	user.list().then(function(users) {
		res.json(users);
	}).fail(function(err) {
		console.log('ERROR: failed to list users (io failed): ', err);
		res.send(500);
	}).done();
});

app.get('/api/user/:username', ensureAuthenticated, ensureAdminRole, function(req, res) {
	
	user.read(req.params.username).then(function(user) {
		res.json(user);
	
	}).fail(function(err) {
		console.log('ERROR: failed to read user (io failed): ', err);
		res.send(500);
	}).done();
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
	}).fail(function(err) {
		console.log('ERROR: failed to delete user (io failed): ', err);
		res.send(500);
	}).done();
});

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
	var promises = [];
	
	busboy.on('error', function(err) {
		console.log('ERROR in upload', err);
		res.send(500);
	
	}).on('file', function(field, stream, filename) {

		promises.push( store.saveStreamToFile(stream, idPath + '/' + filename.replace('..', ''), makePublic) );
	}).on('end', function() {
		
		q.all(promises).then(function() {
			res.send(200);
		}).fail(function(error) {
			console.log('ERROR: saving uploaded file(s)', error);
			res.send(500);
		}).done();
	});

	req.pipe(busboy);
});

app.get('/api/files', ensureAuthenticated, function(req, res) {

	var date = req.query.date;
	var wantPublic = req.query['public'];

	store.filesAt(date, function(f) {
		if (wantPublic) {
			return f['public'];
		} else {
			return f.owner === req.username;
		}
	}).then(function(files) {

		res.json(files);
	}).fail(function(error) {
		
		console.log('ERROR scanning files: ' + err);
		res.send(500);
	}).done();
});

app.post('/api/files', ensureAuthenticated, function(req, res) {

	var action = req.body.action;
	
	var promises = [];
	
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
			promises.push( store.deleteFile(fileId) );
		} else if(action === 'makePublic') {
			promises.push( store.makePublic(fileId) );
		} else if(action === 'makePrivate') {
			promises.push( store.makePrivate(fileId) );
		} else {
			console.log('ERROR: unknown action', action);
			return res.send(500);
		}
	});
	
	q.all(promises).then(function() {
		res.send(200);
	}).fail(function(error) {
		console.log('ERROR: applying file action:', error);
		return res.send(500);
	}).done();
});

app.get('/api/dashboard', ensureAuthenticated, function(req, res) {

	store.listFiles(config.MAXFILES, function(f) { return f['public']; }, req.query.olderThan).then(function(files) {
		
		res.json(files);
		
	}).fail(function(error) {
		console.log('ERROR scanning files: ' + error);
		res.send(500);
	}).done();
});

app.get('/api/tree', ensureAuthenticated, function(req, res) {
	var wantPublic = !!req.query['public'];

	store.dateTree(function(f) {
		if (wantPublic) {
			return f['public'];
		} else {
			return f.owner === req.username;
		}
	}).then(function(results) {
		res.json(results);

	}).fail(function(error) {
		console.log('ERROR scanning files: ' + err);
		res.send(500);
	}).done();
});

app.get('/api/download', ensureAuthenticated, function(req, res) {
	var fileId = req.query.fileId.replace('..', ''); // security
	var dirId = fileId.slice(0, fileId.lastIndexOf('/'));
	var fname = fileId.slice(dirId.length + 1);
	var info = parseIdPath(dirId);

	if (!info) {
		return res.send(500);
	}
	
	store.stat(fileId).then(function(f) {
		if(info.owner === req.username || f['public']) {
			res.setHeader('Content-type', 'application/octet-stream');
			res.setHeader('Content-disposition', 'attachment; filename=' + encodeURIComponent(fname));

			return store.readFileToStream(fileId, res).then(function() {
				return res.send(200);
			});

		} else {
			console.log('ERROR: denied download', req.username, fileId);
			return res.send(403);
		}
	}).fail(function(error) {
		console.log('ERROR: download failed', error);
	}).done();
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
