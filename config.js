// port server listens on
exports.PORT = 3000;

// datastore root. Uploaded files will be stored there. Make sure 
// directory exists and initially empty.
exports.DATASTORE = __dirname + '/datastore';

// keep this secret - used to hash/salt user passwords.
exports.SECRET_KEY = 'Mombo jombo';

// upload file limit: 512Mb
exports.FILE_SIZE_LIMIT = 1024 * 1024 * 512;

// max number of files to return per server request (sort of paging)
exports.MAXFILES = 150;

// login token expiration time (millis). When login token expires user will need to re-login.
exports.LOGIN_REMEMBER_MILLIS = 1000 * 60 * 60 * 24 * 14;

// admin user attributes
exports.ADMIN = {
	username: 'admin',
	name    : 'Zuza Admin',
	password: 'password'
};

// file where users are stored (aka user database)
exports.USERS_FILE = 'users.json';
