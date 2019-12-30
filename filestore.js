const fs = require('fs');

async function listDir(dir) {
	const list = await fs.promises.readdir(dir);
	const dirs = [];
	const files = [];
	for (const file of list) {
		const stat = await fs.promises.stat(dir + '/' + file);
		if (stat.isDirectory()) {
			dirs.push({
				dirname: dir,
				name: file,
				stat: stat,
			});
		} else {
			files.push({
				dirname: dir,
				name: file,
				stat: stat,
			});
		}
	}

	return [dirs, files];
}

async function createDirectory(dir, date, owner) {
	try {
		await fs.promises.mkdir(dir + '/' + date);
	} catch (err) {
		if (err.code !== 'EEXIST') {
			throw err;
		}
	}
	try {
		await fs.promises.mkdir(dir + '/' + date + '/' + owner);
	} catch (err) {
		if (err.code !== 'EEXIST') {
			throw err;
		}
	}
}

async function exists(path) {
	try {
		await fs.promises.stat(path);
		return true;
	} catch(err) {
		if (err.code === 'ENOENT') {
			return false;
		}
		throw err;
	}
}

function allFilter() {
	return true;
}

async function filesAt(root, date, filter) {
	filter = filter || allFilter;

	let dirs = [], files = [];
	if (await exists(root + '/' + date)) {
		[ dirs, ] = await listDir(root + '/' + date);
	}

	const jobs = [];
	for (const owner of dirs) {
		const job = listDir(root + '/' + date + '/' + owner.name);
		jobs.push({job, owner});
	}
	const result = [];
	for (const job of jobs) {
		[, files] = await job.job;
		for (const f of files) {
			result.push({
				fileId: date + '/' + job.owner.name + '/' + f.name,
				name: f.name,
				size: f.stat.size,
				'public': !!(040 & f.stat.mode),
				owner: job.owner.name,
				mtime: Date.parse(f.stat.mtime)
			});
		}
	}

	return result.filter(filter).sort((a, b) => a.mtime - b.mtime);
}

async function allDates(root) {

	const [dirs, ] = await listDir(root);
	const names = dirs.filter(d => /\d{8,8}/.test(d.name)).map(d => d.name);
	return names;
}

async function dateTree(root, filter) {

	filter = filter || allFilter;

	const dates = await allDates(root);
	const jobs = [];

	for (const date of dates) {
		jobs.push({
			job: filesAt(root, date, filter),
			date
		});
	}
	const results = []
	for (const job of jobs) {
		const files = await job.job;
		if (files.length > 0) {
			results.push({
				dirId: job.date,
				year: job.date.slice(0, 4),
				month: job.date.slice(4, 6),
				day: job.date.slice(6, 8),
				files: files
			});
		}
	}

	return results;
}

function listFiles(root, limit, filter, olderThan) {

	filter = filter || allFilter;

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

				if (files.length > 0) {
					out.push({
						dirId: date,
						year : date.slice(0, 4),
						month: date.slice(4, 6),
						day  : date.slice(6, 8),
						files: files
					});

					limit -= files.length;
					if (limit <= 0) {
						return out;
					}
				}

				return nextDate();
			});
		}

		return nextDate();
	});
}

async function makePublic(root, fileId) {
	await fs.promises.chmod(root + '/' + fileId, 0640);
}

async function makePrivate(root, fileId) {
	await fs.promises.chmod(root + '/' + fileId, 0600);
}

async function deleteFile(root, fileId) {
	try {
		await fs.promises.unlink(root + '/' + fileId);
	} catch(err) {
		if (err.code !== 'ENOENT') {
			throw err;
		}
	}
}

class Writeable {
	constructor(engine) {
		this.engine = engine;
	}

	async write(chunk) {
		return new Promise((resolve, reject) => {
			this.engine.write(chunk, err => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async end() {
		return new Promise((resolve, reject) => {
			this.engine.end('', err => {
				if (err) reject(err);
				else resolve();
			});
		});
	}
}

async function saveStreamToFile(root, readStream, fileId, asPublic) {
	const name = root + '/' + fileId;
	var dirId = fileId.slice(0, fileId.lastIndexOf('/'));
	var date = dirId.slice(0, dirId.lastIndexOf('/'));
	var owner = dirId.slice(date.length + 1);

	try {
		await fs.promises.unlink(name);
	} catch(err) {
	}

	await createDirectory(root, date, owner);
	const writer = new Writeable(fs.createWriteStream(name, { mode: asPublic ? 0640 : 600 }));
	for await (const chunk of readStream) {
		await writer.write(chunk);
	}
	await writer.end();
}

async function readFileToStream(root, fileId, writeStream) {
	const readStream = fs.createReadStream(root + '/' + fileId);
	const w = new Writeable(writeStream);

	for await (const chunk of readStream) {
		await w.write(chunk);
	}
	await w.end();
}

async function statX(root, fileId) {
	const stat = await fs.promises.stat(root + '/' + fileId);
	return {
		fileId : fileId,
		size   : stat.size,
		public : !!(stat.mode & 040)
	};
}

function FileStore(root) {

	return {
		stat: function(fileId) {
			return statX(root, fileId);
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
