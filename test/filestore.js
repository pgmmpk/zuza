const test = require('ava');
var FileStore    = require('../filestore').FileStore,
	expect       = require('expect.js'),
	EventEmitter = require('events').EventEmitter,
	fs           = require('fs'),
	q            = require('q'),
	tmp          = require('tmp-promise');
import { withFile, withDir } from 'tmp-promise';

async function setup(cb) {
	await withFile( async ({path: sampleFile}) => {
		await fs.promises.writeFile(sampleFile, 'Hello, world');
		await withFile(async ({ path: sampleFile2 }) => {
			await withDir(async ({path: tempDir}) => {
				const store = FileStore(tempDir);
				await cb({
					sampleFile, sampleFile2, tempDir, store
				});
			}, { unsafeCleanup: true });
		});
	});
}

test('filestore.saveStreamToFile should create file', async t => {
	await setup(async ({sampleFile, store}) => {
		const stream = fs.createReadStream(sampleFile);
		await store.saveStreamToFile(stream, 'A/mike/blah.txt');
		const f = await store.stat('A/mike/blah.txt')

		t.is(f.fileId, 'A/mike/blah.txt');
		t.is(f.size, 12);
		t.is(f.public, false);
	});
});

test('filestore.saveStreamToFile with public option should create public file', async t => {
	await setup(async ({ sampleFile, store }) => {
		const stream = fs.createReadStream(sampleFile);

		await store.saveStreamToFile(stream, 'A/mike/blah2.txt', true);
		const f = await store.stat('A/mike/blah2.txt');

		t.is(f.fileId, 'A/mike/blah2.txt');
		t.is(f.size, 12);
		t.is(f.public, true);
	});
});

test('filestore.saveStreamToFile with garbled file id should fail', async t => {
	await setup(async ({sampleFile, store}) => {
		const stream = fs.createReadStream(sampleFile);

		try {
			await store.saveStreamToFile(stream, 'A/B/mike/blah.txt', true);
		} catch(err) {
			t.is(err.code, 'ENOENT');
		}
	});
});

test('filestore.readFileToStream should read file', async t => {
	await setup(async ({ sampleFile2, store, tempDir }) => {
		await fs.promises.mkdir(tempDir + '/A');
		await fs.promises.mkdir(tempDir + '/A/mike');
		await fs.promises.writeFile(tempDir + '/A/mike/foo.txt', 'Hey!');

		await store.readFileToStream('A/mike/foo.txt', fs.createWriteStream(sampleFile2));
		const stat = await fs.promises.stat(sampleFile2);
		t.is(stat.size, 4)
	});
});

test('filestore.readFileToStream on unknown file should fail', async t => {
	await setup(async ({ sampleFile2, store }) => {
		try {
			await store.readFileToStream('A/mike/foo.txt', fs.createWriteStream(sampleFile2));
		} catch(err) {
			t.is(err.code, 'ENOENT');
		}
	});
});

test('filestore.makePublic and filestore.makePrivate should work', async t => {
	await setup(async ({ sampleFile, store }) => {
		await store.saveStreamToFile(fs.createReadStream(sampleFile), 'A/mike/blah.txt', false);
		const s = await store.stat('A/mike/blah.txt');
		t.is(s.public, false);

		await store.makePublic('A/mike/blah.txt');
		const s2 = await store.stat('A/mike/blah.txt');
		t.is(s2.public, true);

		await store.makePrivate('A/mike/blah.txt');
		const s3 = await store.stat('A/mike/blah.txt');
		t.is(s3.public, false);
	});
});

test('filestore.deleteFile should work', async t => {
	await setup(async ({ sampleFile, store }) => {
		await store.saveStreamToFile(fs.createReadStream(sampleFile), 'A/mike/blah.txt', false);
		await store.stat('A/mike/blah.txt');
		await store.deleteFile('A/mike/blah.txt');

		try {
			await store.stat('A/mike/blah.txt');
		} catch(err) {
			t.is(err.code, 'ENOENT');
		}
	});
});

test('filestore.deleteFile on a non-existent file should also work', async t => {
	await setup(async ({ store }) => {
		await store.deleteFile('A/mike/blah.txt');
		t.pass();
	});
});

test('filestore.saveStreamToFile stress should work', async t => {
	await setup(async ({ sampleFile, store }) => {
		const jobs = [];
		for (let i = 0; i < 10; i++) {
			const job = store.saveStreamToFile(fs.createReadStream(sampleFile), 'X/mike/blah' + i, true);
 			jobs.push(job);
		}
		for (const job of jobs) {
			await job;
		}

		const files = await store.filesAt('X', () => true);
		t.is(files.length, 10);

		for (const f of files) {
			t.is(f.owner, 'mike');
			t.is(f.public, true);
			t.is(f.size, 12)
		}
	});
});

test('filestore.saveStreamToFile should be able to ovewrite file', async t => {
	await setup(async ({ sampleFile, store }) => {
		await store.saveStreamToFile(fs.createReadStream(sampleFile), 'X/mike/blah.txt', true);
		await store.saveStreamToFile(fs.createReadStream(sampleFile), 'X/mike/blah.txt', false);
		const s = await store.stat('X/mike/blah.txt');

		t.is(s.public, false);
	});
});

test('filestore.saveStreamToFile should be able to use unicode file names', async t => {
	await setup(async ({ sampleFile, store }) => {
		await store.saveStreamToFile(fs.createReadStream(sampleFile), 'X/mike/юникод.txt');
		const s = await store.stat('X/mike/юникод.txt');

		t.is(s.public, false);
	});
});

test('filestore.filesAt should return files at that date', async t => {
	await setup(async ({ sampleFile, store }) => {
		const jobs = [];

		jobs.push(store.saveStreamToFile(fs.createReadStream(sampleFile), 'A/mike/blah.txt'));
		jobs.push(store.saveStreamToFile(fs.createReadStream(sampleFile), 'B/liza/blah.txt'));
		jobs.push(store.saveStreamToFile(fs.createReadStream(sampleFile), 'C/alice/blah.txt'));
		jobs.push(store.saveStreamToFile(fs.createReadStream(sampleFile), 'D/mike/blah.txt'));

		for (const job of jobs) {
			await job;
		}

		const a = await store.filesAt('A');
		t.is(a.length, 1);
		t.is(a[0].owner, 'mike');
		t.is(a[0].fileId, 'A/mike/blah.txt');

		const b = await store.filesAt('B');
		t.is(b.length, 1);
		t.is(b[0].owner, 'liza');
		t.is(b[0].fileId, 'B/liza/blah.txt');

		const c = await store.filesAt('C');
		t.is(c.length, 1);
		t.is(c[0].owner, 'alice');
		t.is(c[0].fileId, 'C/alice/blah.txt');

		const d = await store.filesAt('D');
		t.is(d.length, 1);
		t.is(d[0].owner, 'mike');
		t.is(d[0].fileId, 'D/mike/blah.txt');

		const e = await store.filesAt('E');
		t.is(e.length, 0);
	});
});

test('filestore.filesAt should allow omition of filter', async t => {
	await setup(async ({ sampleFile, store }) => {
		await store.saveStreamToFile(fs.createReadStream(sampleFile), 'A/mike/blah.txt');
		const a = await store.filesAt('A');

		t.is(a.length, 1);
	});
});

test('filestore.filesAt with filter should work as expected', async t => {
	await setup(async ({ sampleFile, store }) => {
		await store.saveStreamToFile(fs.createReadStream(sampleFile), 'A/mike/blah.txt');

		const a = await store.filesAt('A', f => f.public === false);
		t.is(a.length, 1);

		const b = await store.filesAt('A', f => f.public === true);
		t.is(b.length, 0);

		const c = await store.filesAt('A', f => f.owner === 'mike');
		t.is(c.length, 1);

		const d = await store.filesAt('A', f => f.owner === 'alice');
		t.is(d.length, 0);
	});
});

test('filestore.dateTree should work', async t => {
	await setup(async ({ sampleFile, store }) => {
		const jobs = [];

		jobs.push(store.saveStreamToFile(fs.createReadStream(sampleFile), '20130101/mike/blah.txt'));
		jobs.push(store.saveStreamToFile(fs.createReadStream(sampleFile), '20130102/liza/blah.txt'));
		jobs.push(store.saveStreamToFile(fs.createReadStream(sampleFile), '20130103/alice/blah.txt'));
		jobs.push(store.saveStreamToFile(fs.createReadStream(sampleFile), '20130104/mike/blah.txt'));

		for (const job of jobs) {
			await job;
		}

		const tree = await store.dateTree();
		t.is(tree.length, 4);

		const byDate = {};
		for (const dir of tree) {
			byDate[dir.dirId] = dir;
		}

		t.is(byDate['20130101'].files.length, 1);
		t.is(byDate['20130101'].year, '2013');
		t.is(byDate['20130101'].month, '01');
		t.is(byDate['20130101'].day, '01');

		t.is(byDate['20130102'].files.length, 1);
		t.is(byDate['20130102'].year, '2013');
		t.is(byDate['20130102'].month, '01');
		t.is(byDate['20130102'].day, '02');

		t.is(byDate['20130103'].files.length, 1);
		t.is(byDate['20130103'].year, '2013');
		t.is(byDate['20130103'].month, '01');
		t.is(byDate['20130103'].day, '03');

		t.is(byDate['20130104'].files.length, 1);
		t.is(byDate['20130104'].year, '2013');
		t.is(byDate['20130104'].month, '01');
		t.is(byDate['20130104'].day, '04');
	});
});

test('filestore.dateTree should not show empty directories', async t => {
	await setup(async ({ sampleFile, store }) => {
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130101/mike/blah.txt');
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130102/liza/blah.txt');
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130103/alice/blah.txt');
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130104/mike/blah.txt');

		await store.deleteFile('20130102/liza/blah.txt');

		const tree = await store.dateTree();

		t.is(tree.length, 3);

		const byDate = {};
		for (const dir of tree) {
			byDate[dir.dirId] = dir;
		}

		t.is(byDate['20130101'].files.length, 1);
		t.is(byDate['20130101'].year, '2013');
		t.is(byDate['20130101'].month, '01');
		t.is(byDate['20130101'].day, '01');

		t.is(byDate['20130103'].files.length, 1);
		t.is(byDate['20130103'].year, '2013');
		t.is(byDate['20130103'].month, '01');
		t.is(byDate['20130103'].day, '03');

		t.is(byDate['20130104'].files.length, 1);
		t.is(byDate['20130104'].year, '2013');
		t.is(byDate['20130104'].month, '01');
		t.is(byDate['20130104'].day, '04');
	});
});

test('filestore.listFiles should list files newest first', async t => {
	await setup(async ({ sampleFile, store }) => {
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130101/mike/blah.txt');
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130102/liza/blah.txt');
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130103/alice/blah.txt');
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130104/mike/blah.txt');

		{
			const dirs = await store.listFiles(1, x => true);
			t.is(dirs.length, 1);
			t.is(dirs[0].dirId, '20130104');
			t.is(dirs[0].year, '2013');
			t.is(dirs[0].month, '01');
			t.is(dirs[0].day, '04');
			t.is(dirs[0].files.length, 1);
			t.is(dirs[0].files[0].fileId, '20130104/mike/blah.txt');
		}

		{
			const dirs = await store.listFiles(1, x => true, '20130104');
			t.is(dirs.length, 1);
			t.is(dirs[0].dirId, '20130103');
			t.is(dirs[0].year, '2013');
			t.is(dirs[0].month, '01');
			t.is(dirs[0].day, '03');
			t.is(dirs[0].files.length, 1);
			t.is(dirs[0].files[0].fileId, '20130103/alice/blah.txt');
		}

		{
			const dirs = await store.listFiles(1, x => true, '20130103');
			t.is(dirs.length, 1);
			t.is(dirs[0].dirId, '20130102');
			t.is(dirs[0].year, '2013');
			t.is(dirs[0].month, '01');
			t.is(dirs[0].day, '02');
			t.is(dirs[0].files.length, 1);
			t.is(dirs[0].files[0].fileId, '20130102/liza/blah.txt');
		}

		{
			const dirs = await store.listFiles(1, x => true, '20130102');
			t.is(dirs.length, 1);
			t.is(dirs[0].dirId, '20130101');
			t.is(dirs[0].year, '2013');
			t.is(dirs[0].month, '01');
			t.is(dirs[0].day, '01');
			t.is(dirs[0].files.length, 1);
			t.is(dirs[0].files[0].fileId, '20130101/mike/blah.txt');
		}
		{
			const dirs = await store.listFiles(1, x => true, '20130101');
			t.is(dirs.length, 0);
		}
	});
});

test('filestore.listFiles should support filtering', async t => {
	await setup(async ({ sampleFile, store }) => {
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130101/mike/blah.txt');
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130102/liza/blah.txt');
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130103/alice/blah.txt');
		await store.saveStreamToFile(fs.createReadStream(sampleFile), '20130104/mike/blah.txt');

		const dirs = await store.listFiles(200, f => f.owner === 'mike');

		t.is(dirs.length, 2);
		t.is(dirs[0].files.length, 1);
		t.is(dirs[1].files.length, 1);
		t.is(dirs[0].files[0].owner, 'mike');
		t.is(dirs[1].files[0].owner, 'mike');
	});
});