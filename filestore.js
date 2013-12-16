var fs = require('fs'),
	q  = require('q');

function listDir(dir) {
	return q.nfcall(fs.readdir, dir).then(function(list) {
		
		var promises = [];
		list.forEach(function(file) {
			promises.push(q.nfcall(fs.stat, dir + '/' + file).then(function(stat) {
				return {
					dirname: dir,
					name: file, 
					stat: stat
				};
			}));
		});
		
		return q.all(promises);

	}).then(function(filesAndDirs) {
		var dirs  = filesAndDirs.filter(function(file) { return file.stat.isDirectory(); });
		var files = filesAndDirs.filter(function(file) { return !file.stat.isDirectory(); });

		return [dirs, files];

	});
}

function createDirectory(dir, date, owner) {
	return q.nfcall(fs.mkdir, dir + '/' + date).fail(function(err) {
		if (err.code !== 'EEXIST') {
			throw err;
		}
	}).then(function() {
		return q.nfcall(fs.mkdir, dir + '/' + date + '/' + owner);
	}).fail(function(err) {
		if (err.code !== 'EEXIST') {
			throw err;
		}
	});
}

function exists(path) {
	var defer = q.defer();
	
	fs.exists(path, function(existsFlag) {
		defer.resolve(existsFlag);
	});
	
	return defer.promise;
}

function filesAt(root, date, filter) {
	
	return exists(root + '/' + date).then(function(exists) {
		
		if (!exists) {
			return [ [], [] ]; // report no files if date directory does not exist
		}
		
		return listDir(root + '/' + date);
	
	}).spread(function(dirs) {

		var promises = [];
		
		dirs.forEach(function(owner) {
			promises.push( listDir( root + '/' + date + '/' + owner.name).spread(function(dirs, files) {
				
				return files.map(function(f) {
					return {
						fileId   : date + '/' + owner.name + '/' + f.name,
						name	 : f.name,
						size	 : f.stat.size,
						'public' : !!(040 & f.stat.mode),
						owner    : owner.name,
						mtime    : Date.parse(f.stat.mtime)
					};
				});
			}) );
		});
		
		return q.all(promises);
		
	}).then(function(results) {
		var allfiles = [];
		results.forEach(function(files) {
			files.filter(filter).forEach(function(f) {
				allfiles.push(f);
			});
		});
		
		return allfiles;
	});
}

function allDates(root) {
	
	return listDir(root).spread(function(dirs) {
		return dirs.filter(function(d) { 
			return (/\d{8,8}/).test(d.name); 
		}).map(function(d) {
			return d.name;
		});
	});
}

function dateTree(root, filter) {
	
	return allDates(root).then(function(dates) {
		var promises = [];
		
		dates.forEach(function(date) {
			promises.push( filesAt(root, date, filter).then(function(files) {
				return {
					dirId: date,
					year : date.slice(0, 4),
					month: date.slice(4, 6),
					day  : date.slice(6, 8),
					files: files
				};
			}) );
		});
		
		return q.all(promises).then(function(results) {

			return results;
		});

	}).then(function(results) {
		var out = [];
		
		results.forEach(function(dir) {
			out.push(dir);
		});
		
		return out;

	});
}

function listFiles(root, limit, filter, olderThan) {
	
	return allDates(root).then(function(dates) {
		
		dates.sort();
		
		if (olderThan) {
			for (var k = 0; k < dates.length; k++) {
				if (dates[k] >= olderThan) {
					dates = dates.slice(0, k);
					break;
				}
			}
		}
		
		var i = dates.length;
		var out = [];
		
		function nextDate() {
			var date = dates[--i];
			
			if (!date) {
				return out;
			}

			return filesAt(root, date, filter).then(function(files) {
				
				if (files) {
					out.push({
						dirId: date,
						year : date.slice(0, 4),
						month: date.slice(4, 6),
						day  : date.slice(6, 8),
						files: files
					});
					
					limit -= files.length;
					if (limit < 0) {
						return out;
					}
				}

				return nextDate();
			});
		}
		
		return nextDate();
	});
}

function makePublic(root, fileId) {
	return q.nfcall(fs.chmod, root + '/' + fileId, 0640);
}

function makePrivate(root, fileId) {
	return q.nfcall(fs.chmod, root + '/' + fileId, 0600);
}

function deleteFile(root, fileId) {

	return q.nfcall(fs.unlink, root + '/' + fileId);
}

function saveStreamToFile(root, readStream, fileId, asPublic) {
	var defer = q.defer();
	
	function doCreate() {
		
		var dirId = fileId.slice(0, fileId.lastIndexOf('/'));
		var date  = dirId.slice(0, dirId.lastIndexOf('/'));
		var owner = dirId.slice(date.length + 1);
		
		createDirectory(root, date, owner).then(function() {
			readStream.pipe( fs.createWriteStream(root + '/' + fileId, { mode: asPublic ? 0640 : 600 })).on('error', function(error) {
				return defer.reject(error);
				
			}).on('close', function() {
				defer.resolve();
			});
		});
	}

	fs.exists(root + '/' + fileId, function(exists) {
		if (exists) {
			fs.unlink(root + '/' + fileId, function(error) {
				if (error) {
					return defer.reject(error);
				}
				
				doCreate();
			});
		} else {
			doCreate();
		}
	});
	
	return defer.promise;
}

function readFileToStream(root, fileId, writeStream) {
	var defer = q.defer();
	
	fs.createReadStream(root + '/' + fileId).pipe(writeStream).on('error', function(error) {
		return defer.reject(error);
	}).on('end', function() {
		return defer.resolve();
	});
	
	return defer.promise;
}

function stat(root, fileId) {
	return q.nfcall(fs.stat, root + '/' + fileId).then(function(stat) {
		return {
			fileId : fileId,
			size   : stat.size,
			public : !!(stat.mode & 040) 
		};
	});
}

function FileStore(root) {
	
	return {
		stat: function(fileId) {
			return stat(root, fileId);
		},
		
		saveStreamToFile: function(stream, fileId, asPublic) {
			return saveStreamToFile(root, stream, fileId, asPublic);
		},
		
		readFileToStream: function(fileId, stream) {
			return readFileToStream(root, fileId, stream);
		},
		
		makePublic: function(fileId) {
			return makePublic(root, fileId);
		},
		
		makePrivate: function(fileId) {
			return makePrivate(root, fileId);
		},
		
		deleteFile: function(fileId) {
			return deleteFile(root, fileId);
		},
		
		dateTree: function(filter) {
			return dateTree(root, filter);
		},
		
		listFiles: function(limit, filter, olderThan) {
			return listFiles(root, limit, filter, olderThan);
		},
		
		filesAt: function(date, filter) {
			return filesAt(root, date, filter);
		}
	};
}

exports.FileStore = FileStore;
