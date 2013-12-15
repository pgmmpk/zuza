(function(angular){
    'use strict';

    var module = angular.module('zuza', [
        'zuza.fileUpload',
        'zuza.services',
        'zuza.controllers',
        'zuza.utils',
        'zuza.tree',
        'zuza.translate'
    ]);

    module.config(['$routeProvider', '$locationProvider', '$httpProvider', function($routeProvider, $locationProvider, $httpProvider) {
        
        $routeProvider.
            when('/', {
                templateUrl: 'partials/index',
                controller: 'DashboardCtrl'
            }).
            when('/files', {
                templateUrl: 'partials/files',
                controller: 'FilesCtrl'
            }).
            when('/public', {
                templateUrl: 'partials/public',
                controller: 'PublicCtrl'
            }).
            when('/login', {
                templateUrl: 'partials/login',
                controller: 'LoginCtrl'
            }).
            when('/settings', {
                templateUrl: 'partials/settings',
                controller: 'SettingsCtrl'
            }).
            when('/user', {
                templateUrl: 'partials/userlist',
                controller: 'UserListCtrl'
            }).
            when('/user/create', {
                templateUrl: 'partials/user',
                controller: 'UserCtrl'
            }).
            when('/user/:username', {
                templateUrl: 'partials/user',
                controller: 'UserCtrl'
            }).
            otherwise({
                redirectTo: '/'
            });
        
        $locationProvider.html5Mode(true);
        
        /*
        Set up an interceptor to watch for 401 errors.
        The server, rather than redirect to a login page (or whatever), just returns  a 401 error
        if it receives a request that should have a user session going.  Angular catches the error below
        and says what happens - in this case, we just redirect to a login page.  You can get a little more
        complex with this strategy, such as queueing up failed requests and re-trying them once the user logs in.
        Read all about it here: http://www.espeo.pl/2012/02/26/authentication-in-angularjs-application
        */
       var interceptor = ['$q', '$location', '$rootScope', function ($q, $location, $rootScope) {
           function success(response) {
               return response;
           }

           function error(response) {
               var status = response.status;
               if (status == 401) {
                   $rootScope.redirect = $location.url(); // save the current url so we can redirect the user back
                   $rootScope.user = {};
                   $location.path('/login');
               }
               return $q.reject(response);
           }

           return function (promise) {
               return promise.then(success, error);
           };
       }];
       
       $httpProvider.responseInterceptors.push(interceptor);

    }]);

    module.run(['$rootScope', '$http', '$location', 'Auth', 'Store', '$translate', 
                      function ($rootScope, $http, $location, Auth, Store, $translate) {

        //global object representing the user who is logged in
        $rootScope.user = Auth.getUser();

        //global function for logging out a user
        $rootScope.logout = function () {
            $rootScope.user = {};
            Auth.setUser({});
            $location.path('/login');
        };

        $translate.uses(Store.get('zuza-lang', 'ru'));
    }]);
    
})(angular);
