var fs	  = require('fs'),
	process = require('process'),
	events  = require('events');

/**
 * Asyncronously lists directory content. Callback arguments are:
 *
 *   * err   - if not null, an error was encountered. Rest of params will be undefined.
 *   * dirs  - list of directories (in the same order as readdir returns them)
 *   * files - list of files (in the same order as readdir returns them)
 *
 * Every returned Dir or File has the following structure:
 *
 *   * name	- simple name (aka basename), relative to the directory
 *   * dirname - set to the value of dir
 *   * stat	- stat structure (size, permissions, etc)
 */
function listDir(dir, callback) {
	fs.readdir(dir, function(err, list) {
		if (err) {
			setImmediate(callback, err);
			return;
		}
		var i = 0;
		var dirs = [];
		var files= [];
		(function next() {
			//console.log('next, i=', i);
			var file = list[i++];
			if (!file) {
				setImmediate(callback, null, dirs, files);
			} else {
				fs.stat(dir + '/' + file, function(err, stat) {
					if (stat) {
						var fobj = {
							dirname: dir,
							name: file, 
							stat: stat
						};

						if (stat.isDirectory()) {
							dirs.push( fobj );
						} else {
							files.push( fobj );
						}
					}
					next();
				});
			}
		})();
	});
}

function sortByName(direction) {
	return function(a, b) {
		if (a.name > b.name) {
			return direction;
		} else if(a.name < b.name) {
			return -direction;
		} else {
			return 0;
		}
	};
}

function sortByMtime(direction) {
	return function(a, b) {
		if (a.stat.mtime > b.stat.mtime) {
			return direction;
		} else if(a.stat.mtime < b.stat.mtime) {
			return -direction;
		} else {
			return 0;
		}
	};
}

function createDirectories(dir, callback) {
	var index = dir.lastIndexOf('/');

	if (index < 0) {
		callback('ERROR: datastore root must exists!');
	} else {
		var parent = dir.slice(0, index);
		fs.stat(parent, function(err) {
			if (err) {
				createDirectories(parent, function(err) {
					if (err) {
						callback(err);
					} else {
						fs.mkdir(dir, callback);
					}
				});
			} else {
				fs.mkdir(dir, callback);
			}
		});
	}
}

function rebind(target, source) {
	var methods = Array.prototype.slice.call(arguments, 2);
	
	methods.forEach(function(m) {
		target[m] = function() {
			var result = source[m].apply(source, arguments);
			
			return result === source ? target : result;
		};
	});
	
	return target;
}

function emitterWrapper() {
	var emitter = new events.EventEmitter();
	
	var feed = function() {
		
		var cleaners = [];
		
		var feeder = {};
		
		feeder.on = function(name, callback) {
			
			emitter.on(name, callback);
			
			cleaners.push(function() {
				emitter.removeEventListener(name, callback);
			});
			
			return feeder;
		};
		
		feeder.close = function() {

			cleaners.forEach(function(c) { c(); });
		};
		
		return feeder;
	};
	
	return rebind( { feed: feed }, emitter, 'emit');
}

// for angular
function $feeder(scope) {
	
	var cleaners = [];
	
	var feeder = {};
	
	feeder.$on = function(name, callback) {
		
		cleaners.push(scope.$on(name, callback));
		
		return feeder;
	};
	
	feeder.$close = function() {
		
		cleaners.forEach(function(c) { c(); });
	};
	
	return feeder;
}

function isPublic(f) {
	return 0 !== (040 & f.stat.mode);  // group read bit is used as 'public' indicator
}

/**
 * List all files in a date-structured directory. Returned array of files is unsorted.
 * 
 * @param root
 * @param year
 * @param month
 * @param day
 * @param callback
 */
function filesAtDate(root, path, callback) {
	path.replace('..', ''); // secutiry
	
	fs.stat(root + '/' + path, function(err, stat) {
		//console.log(stat);
		if (err) {
			callback(null, []);
			return;
		}

		listDir(root + '/' + path, function(err, dirs, files) {
			
			if (err) {
				callback(err);
				return;
			}
			
			var out = [];
			
			var todo = dirs.length;
			if (todo === 0) {
				callback(null, out);
				return;
			}
			
			dirs.forEach(function(owner) {

				listDir(root + '/' + path + '/' + owner.name, function(err, dirs, files) {
					if (err) {
						callback(err);
						return;
					}

					files.forEach(function(f) {

						out.push({
							fileId   : path + '/' + owner.name + '/' + f.name,
							name	 : f.name,
							size	 : f.stat.size,
							'public' : isPublic(f),
							owner    : owner.name,
							mtime    : Date.parse(f.stat.mtime)
						});
					});
					
					todo -= 1;
					if (todo === 0) {
						// all done! time to fire the answer
						callback(null, out);
					}
				});
			});
		});
	});
}

function availableDates(root, callback) {
	
	listDir(root, function(err, dirs, files) {
		
		if (err) {
			callback(err);
			return;
		}
		
		dirs = dirs.filter(function(d) { return (/\d{8,8}/).test(d.name); });
		callback(null, dirs.map(function(d) { return d.name; }));
	});
}

function readDateTree(root, callback) {
	
	var error = false;
	function onError(err) {
		if (!error) {
			error = true;
			callback(err);
		}
	}

	availableDates(root, function(err, dates) {
		
		if (err) {
			onError(err);
			return;
		}
		
		var toscan = dates.length;
		if (toscan === 0) {
			callback(null, []);
			return;
		}
		
		var out = [];
		
		dates.forEach(function(date) {
		
			filesAtDate(root, date, function(err, files) {
				
				if (err) {
					onError(err);
					return;
				}
				
				out.push({
					dirId: date,
					year : date.slice(0, 4),
					month: date.slice(4, 6),
					day  : date.slice(6, 8),
					files: files
				});
				
				toscan -= 1;
				if (toscan === 0) {
					callback(null, out);
				}
			});
		});
	});
}

function readFiles(root, olderThan, callback) {
	
	availableDates(root, function(err, dates) {
		
		if (err) {
			callback(err);
			return;
		}
		
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
		(function nextDate() {
			var date = dates[--i];
			
			if (!date) {
				callback(null, null);
				return;
			}
			
			filesAtDate(root, date, function(err, files) {
				if (err) {
					callback(err);
					return;
				}
				
				if (files.length) {
					callback(null, {
						dirId: date,
						year : date.slice(0, 4),
						month: date.slice(4, 6),
						day  : date.slice(6, 8),
						files: files
					}, nextDate);
				
				} else {
					nextDate();
				}
			});
		})();
	});
}

function stringEndsWith(s, suff) {
	if (suff.length > s.length) {
		return false;
	} else {
		return suff === s.slice(s.length - suff.length);
	}
}

exports.createDirectories = function(dir, cb) {
	fs.exists(dir, function(exists) {
		if (exists) {
			return cb();
		} else {
			createDirectories(dir, cb);
		}
	});
};
exports.stringEndsWith    = stringEndsWith;
exports.filesAtDate       = filesAtDate;
exports.readDateTree      = readDateTree;
exports.readFiles         = readFiles;