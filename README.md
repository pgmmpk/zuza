### Zuza

Zuza is a simple file sharing server. Registered users can upload files to the server.
Administrator can add/remove/edit users. There is no self-registration.

What user can do with his files?

* Download
* Delete
* Make public
* Make private

"Public" files are seen by other registered users (but others can only download them).

Files are organized in a tree-like structure by date they were uploaded, like this:

	2013/
		11/
			01
			02
			03

(Note: for the purposes of placing files into the tree, UTC time zone is used)

Both public and private files can be browsed using this date tree view.

Public files are also shown in a "Dashboard" view, which is a timeline of uploaded public files.
Dashboard is clever enough to not to show files that user have already seen.

## Installation

This is a (more or less) standard `node.js` project. Thus, after downloading/cloning/unpacking 
install required dependencies by running following command from the project root:

	npm install


## Configuration

All configurable parameters are in the `config.js` file in the root of the project directory tree.

Big picture: you will need to specify:

1. server port (default is 3000)
2. directory where to store uploaded files
3. admin user attributes (used only when bootstraping user database)
4. location of user database. Make sure that initially it does NOT exist - it will be lazily created and 
   populated with a single admin user.

For more, see comments in the default `config.js`.

## License
MIT
