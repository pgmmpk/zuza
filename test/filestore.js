var FileStore    = require('../filestore').FileStore,
	expect       = require('expect.js'),
	EventEmitter = require('events').EventEmitter,
	fs           = require('fs'),
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
});