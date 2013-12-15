describe('services', function() {
    'use strict';

    beforeEach(module('zuza.services'));
    
    var DUMMY_USER = {};

    describe('Auth', function() {
        var Auth, rootScope, httpBackend;

        beforeEach(inject(function($injector, $rootScope, $httpBackend) {
            httpBackend = $httpBackend;

            rootScope = $rootScope;

            Auth = $injector.get('Auth');
            Auth.setUser(DUMMY_USER);
        }));

        it('should correctly instantiate Auth service', function() {
            expect(Auth).toBeDefined();
            expect(Auth.getUser()).toBe(DUMMY_USER);
            expect(Auth.get).toBeDefined();
            expect(Auth.post).toBeDefined();
        });

        it('Auth service should send "Autherization" header when user is known', function() {
            Auth.setUser({token: 'blah'});

            httpBackend.expectGET('/api/user/list', function(headers) {
                return headers['Authorization'] === 'Zuza blah';
            }).respond([]);

            Auth.get('/api/user/list');
            httpBackend.flush();
        });
    });

    describe('Files', function() {
        var Files, rootScope, httpBackend;

        beforeEach(inject(function($injector, $rootScope, $httpBackend) {
            httpBackend = $httpBackend;

            rootScope = $rootScope;

            Files = $injector.get('Files');
            $injector.get('Auth').setUser({ token : 'blah' });
        }));

        it('should correctly instantiate Files service', function() {
            expect(Files).toBeDefined();
        });

        it('list should return file list', function() {
            httpBackend.expectGET('/api/files?date=20131101', function(headers) {
                return headers['Authorization'] == 'Zuza blah';
            }).respond([]);

            Files.list({
            	year  : '2013',
            	month : '11',
            	day   : '01'
            });
            httpBackend.flush();
        });
    });
})
