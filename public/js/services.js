(function(angular){
    'use strict';

    var module = angular.module('zuza.services', []);

    module.factory('Store', ['$window', function($window) {

        return {
            set: function(key, value) {
                $window.localStorage.setItem(key, value);
            },
            get: function(key, defaultValue) {
                var out = $window.localStorage.getItem(key);
                if (out === undefined || out === null) {
                    return defaultValue;
                }
                return out;
            }
        };
    }]);

    module.factory('UserSettings', ['Store', function(Store) {

        return {
            autoPublic: {
                get: function() {
                    return Store.get('zuza-auto-public', 'true') === 'true';
                },
                set: function(value) {
                    Store.set('zuza-auto-public', value ? 'true' : 'false');
                }
            }
        };
    }]);

    module.factory('Auth', ['$http', 'Store', function($http, Store) {
    	
        var Auth = function() {
            this._user = JSON.parse(Store.get('zuza-auth-user', '{}'));
        };

        Auth.prototype.setUser = function(value) {
            this._user = value;
            Store.set('zuza-auth-user', JSON.stringify(value));
        };

        Auth.prototype.getUser = function() {
            return this._user;
        };

        Auth.prototype.get = function(url, params) {
        	var opts = angular.extend({ headers: {'Authorization': 'Zuza ' + this._user.token } }, params);
            return $http.get(url, opts);
        };

        Auth.prototype.post = function(url, params) {
            return $http.post(url, params, {
                headers: { 'Authorization': 'Zuza ' + this._user.token }
            });
        };

        Auth.prototype.del = function(url, params) {
            return $http['delete'](url, {
                headers: { 'Authorization': 'Zuza ' + this._user.token }
            });
        };

        Auth.prototype.login = function(username, password) {
            var that = this;
            
            return $http.post('/api/login', {username: username, password: password}).then(function(response) {
                that.setUser( response.data );

                return that.getUser();
            });
        };

        return new Auth();
    }]);

    module.factory('Files', ['Auth', '$window', function(Auth, $window) {

        return {

            /**
             * Lists all user's files.
             *
             * @returns {Promise} - array of files.
             */
            list: function(info) {
                return Auth.get('/api/files', {params: {date: info.year + info.month + info.day}}).then(function(response) {
                    return response.data;
                });
            },

            /**
             * Performs update action on a set of files (identified by fileId).
             * Actions are:
             *    * makePublic  - makes all files public
             *    * makePrivate - makes all files private
             *    * delete      - deletes all files
             */
            update: function(action, fileIds) {
                return Auth.post('/api/files', {fileIds: fileIds, action: action});
            },

            /**
             * Triggers file download.
             */
            download: function(fileId) {
                $window.open('/api/download?fileId=' + encodeURIComponent(fileId) +
                                '&authorization=' + encodeURIComponent(Auth.getToken()));
            },

            /**
             * Lists all public files (relative to authenticated user)
             *
             * @returns {Promise} - list of dashboard items.
             */
            publicFiles: function(info) {
                return Auth.get('/api/files', {params: {date: info.year + info.month + info.day, 'public': true}}).then(function(response) {
                    return response.data;
                });
            },

            dashboard: function(olderThan) {
            	
            	var params = {};
            	
            	if (olderThan) {
            		params.olderThan = olderThan.year + olderThan.month + olderThan.day;
            	}
            	
                return Auth.get('/api/dashboard', {params: params}).then(function(response) {
                    return response.data;
                });
            },
            
            publicTree: function() {
                return Auth.get('/api/tree', {params: {'public': true}}).then(function(response) {
                    return response.data;
                });
            },

            tree: function() {
                return Auth.get('/api/tree').then(function(response) {
                    return response.data;
                });
            },
        };
    }]);
    
    module.factory('DashboardService', ['Store', function(Store) {
    	return {
    		since: function() {
    	    	var now   = Date.now();
    	    	var last  = +Store.get('zuza-dashboard-last', now);
    	    	var start = +Store.get('zuza-dashboard-start', 0);
    	    	
    	    	if (start === 0 && last === now) { // first time
    	    		Store.set('zuza-dashboard-last', last);
    	    	}
    	    	
    	    	if (now - last >= 1000 * 60 * 60 * 8) { // 8 hours
    	    		start = last;
    	    		last = now;
    	    		Store.set('zuza-dashboard-last', last);
    	    		Store.set('zuza-dashboard-start', start);
    	    	}

    	    	return start;
    		}
    	};
    }]);

})(angular);