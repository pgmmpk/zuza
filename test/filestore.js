var FileStore    = require('../filestore').FileStore,
	expect       = require('expect.js'),
	EventEmitter = require('events').EventEmitter,
	fs           = require('fs'),
	q            = require('q'),
	tmp          = require('tmp');

describe('filestore', function() {
	
	var sampleFile = null;
	var sampleFile2 = null;
	var tempDir = null;
	var store = null;
	
	beforeEach(function(done) {
		tmp.file(function(err, filename) {
			fs.writeFile(filename, 'Hello, world', function() {
				sampleFile = filename;
				done();
			});
		});
	});

	beforeEach(function(done) {
		tmp.file(function(err, filename) {
			sampleFile2 = filename;
			done();
		});
	});

	beforeEach(function(done) {
		
		tmp.dir({unsafeCleanup: true}, function(err, dirname) {
			tempDir = dirname;
			store = FileStore(tempDir);
			done();
		});
	});

	it('.saveStreamToFile should create file', function(done) {

		var stream = fs.createReadStream(sampleFile);
		
		store.saveStreamToFile(stream, 'A/mike/blah.txt').then(function() {
			
			return store.stat('A/mike/blah.txt');
		
		}).then(function(f) {
			
			expect(f.fileId).to.be('A/mike/blah.txt');
			expect(f.size).to.be(12);
			expect(f['public']).to.be(false);
			
			done();

		}).fail(function(error) {
			throw error;
		});
	});
		
	it('.saveStreamToFile with public option should create public file', function(done) {

		var stream = fs.createReadStream(sampleFile);
		
		store.saveStreamToFile(stream, 'A/mike/blah.txt', true).then(function() {
		
			return store.stat('A/mike/blah.txt');

		}).then(function(f) {
		
			expect(f.fileId).to.be('A/mike/blah.txt');
			expect(f.size).to.be(12);
			expect(f['public']).to.be(true);
			
			done();

		}).fail(function(error) {
			throw error;
		});
	});

	it('.saveStreamToFile with garbled file id should fail', function(done) {

		var stream = fs.createReadStream(sampleFile);
		
		store.saveStreamToFile(stream, 'A/B/mike/blah.txt', true).fail(function(error) {
			expect(error.code).to.be('ENOENT');
			
			done();
		});
	});

	it('.readFileToStream should read file', function(done) {
		
		fs.mkdirSync(tempDir + '/A');
		fs.mkdirSync(tempDir + '/A/mike');
		fs.writeFileSync(tempDir + '/A/mike/foo.txt', 'Hey!');
		
		store.readFileToStream('A/mike/foo.txt', fs.createWriteStream(sampleFile2)).then(function() {
			fs.stat(sampleFile2, function(err, stat) {
				if (err) throw err;
				
				expect(stat.size).to.be(4);
				done();
			});
		}).fail(function(err) {
			console.log(err);
		});
	});

	it('.readFileToStream on unknown file should fail', function(done) {
		
		store.readFileToStream('A/mike/foo.txt', fs.createWriteStream(sampleFile2)).fail(function(err) {
			
			expect(err.code).to.be('ENOENT');
			done();
		});
	});
	
	it('.makePublic and .makePrivate should work', function(done) {

		store.saveStreamToFile(fs.createReadStream(sampleFile), 'A/mike/blah.txt', false).then(function() {
			return store.stat('A/mike/blah.txt');
		}).then(function(f) {
			expect(f['public']).to.be(false);
			
			return store.makePublic('A/mike/blah.txt');
		}).then(function() {
			return store.stat('A/mike/blah.txt');
		}).then(function(f) {
			expect(f['public']).to.be(true);
			return store.makePrivate('A/mike/blah.txt');
		}).then(function() {
			return store.stat('A/mike/blah.txt');
		}).then(function(f) {
			expect(f['public']).to.be(false);
			done();
		});
		
	});
	
	it('.deleteFile should work', function(done) {

		store.saveStreamToFile(fs.createReadStream(sampleFile), 'A/mike/blah.txt', false).then(function() {
			return store.stat('A/mike/blah.txt');
		}).then(function(f) {
			return store.deleteFile('A/mike/blah.txt');
		}).then(function() {
			
			fs.exists(tempDir + '/A/mike/blah.txt', function(exists) {
				expect(exists).to.be(false);
				done();
			});
		});
	});

	it('.deleteFile on a non-existent file should also work', function(done) {
		store.deleteFile('A/mike/blah.txt').then(function() {
			done();
		}).fail(function(error) {
			console.log(error);
		});
	});
	
	it('.saveStreamToFile stress should work', function(done) {
		var promises = [];
		
		for (var i = 0; i < 10; i++) {
			var p = store.saveStreamToFile(fs.createReadStream(sampleFile), 'X/mike/blah' + i, true);
			
			promises.push(p);
		}
		
		q.all(promises).then(function() {
			return store.filesAt('X', function() { return true; });
		
		}).then(function(files) {
			
			expect(files).to.be.an('array');
			expect(files.length).to.be(10);
			
			files.forEach(function(f) {
				expect(f.owner).to.be('mike');
				expect(f['public']).to.be(true);
				expect(f.size).to.be(12);
			});
			
			done();
		});
	});
	
	it('.saveStreamToFile should be able to ovewrite file', function(done) {
		
		store.saveStreamToFile(fs.createReadStream(sampleFile), 'X/mike/blah.txt', true).then(function() {
			return store.saveStreamToFile(fs.createReadStream(sampleFile), 'X/mike/blah.txt', false);
		}).then(function() {
			return store.stat('X/mike/blah.txt');
		}).then(function(f) {
			expect(f['public']).to.be(false);
			
			done();
		});
	});

	it('.saveStreamToFile should be able to use unicode file names', function(done) {
		
		store.saveStreamToFile(fs.createReadStream(sampleFile), 'X/mike/юникод.txt').then(function() {
			return store.stat('X/mike/юникод.txt');
		}).then(function(f) {
			expect(f['public']).to.be(false);
			
			done();
		});
	});

	it('.filesAt should return files at that date', function(done) {
		var promises = [];
		var p;
		
		function all() {
			return true;
		}
		
		p = store.saveStreamToFile(fs.createReadStream(sampleFile), 'A/mike/blah.txt');
		promises.push(p);
		p = store.saveStreamToFile(fs.createReadStream(sampleFile), 'B/liza/blah.txt');
		promises.push(p);
		p = store.saveStreamToFile(fs.createReadStream(sampleFile), 'C/alice/blah.txt');
		promises.push(p);
		p = store.saveStreamToFile(fs.createReadStream(sampleFile), 'D/mike/blah.txt');
		promises.push(p);

		q.all(promises).then(function() {
			return store.filesAt('A', all);
		}).then(function(files) {
			expect(files.length).to.be(1);
			expect(files[0].owner).to.be('mike');
			expect(files[0].fileId).to.be('A/mike/blah.txt');
			
			return store.filesAt('B', all);
		}).then(function(files) {
			expect(files.length).to.be(1);
			expect(files[0].owner).to.be('liza');
			expect(files[0].fileId).to.be('B/liza/blah.txt');
			
			return store.filesAt('C', all);
		}).then(function(files) {
			expect(files.length).to.be(1);
			expect(files[0].owner).to.be('alice');
			expect(files[0].fileId).to.be('C/alice/blah.txt');
			
			return store.filesAt('D', all);
		}).then(function(files) {
			expect(files.length).to.be(1);
			expect(files[0].owner).to.be('mike');
			expect(files[0].fileId).to.be('D/mike/blah.txt');
			
			return store.filesAt('E', all);
		}).then(function(files) {
			expect(files.length).to.be(0);
			
			done();
		});
	});

	it('.filesAt should allow omition of filter', function(done) {
		store.saveStreamToFile(fs.createReadStream(sampleFile), 'A/mike/blah.txt').then(function() {
			return store.filesAt('A');
		}).then(function(files) {
			expect(files.length).to.be(1);
			done();
		});
	});

	it('.filesAt with filter should work as expected', function(done) {
	
		store.saveStreamToFile(fs.createReadStream(sampleFile), 'A/mike/blah.txt').then(function() {
			return store.filesAt('A', function(f) { return f['public'] === false; });
		}).then(function(files) {
			expect(files.length).to.be(1);

			return store.filesAt('A', function(f) { return f['public'] === true; });
		}).then(function(files) {
			expect(files.length).to.be(0);

			return store.filesAt('A', function(f) { return f.owner === 'mike'; });
		}).then(function(files) {
			expect(files.length).to.be(1);

			return store.filesAt('A', function(f) { return f.owner === 'alice'; });
		}).then(function(files) {
			expect(files.length).to.be(0);
			
			done();
		});
	});
});