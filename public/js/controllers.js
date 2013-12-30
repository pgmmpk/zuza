(function(angular) {

	var module = angular.module('zuza.controllers', ['zuza.services', 'pascalprecht.translate']);
	
	var SERVER_ERROR      = 'Server error';
	var VALIDATION_ERROR  = 'Invalid input';
	var LOGIN_ERROR       = 'Invalid password or username';
	var UPLOAD_SIZE_ERROR = 'Upload incomplete: file too big';

	module.controller('DashboardCtrl', ['$scope', 'Files', 'DashboardService', function ($scope, Files, DashboardService) {
		$scope.since = DashboardService.since();
		
		$scope.displayedFiles = [];
		$scope.oldFiles = [];
		$scope.slides = [];

		$scope.loading = true;
		$scope.error = undefined;
		Files.dashboard().then(function(collection) {
			//console.log('dashboard:', collection);
			$scope.collection = collection;
			$scope.loading = false;
			
			collection.forEach(function(data) {
				var newFiles = data.files.filter(function(f) { return f.mtime >= $scope.since; });
				var oldFiles = data.files.filter(function(f) { return f.mtime < $scope.since; });
				
				if (newFiles.length > 0) {
					$scope.displayedFiles.push({
						year : data.year,
						month: data.month,
						day  : data.day,
						files: newFiles
					});
				}
				
				if (oldFiles.length > 0) {
					$scope.oldFiles.push({
						year : data.year,
						month: data.month,
						day  : data.day,
						files: oldFiles
					});
				}
			});
			
		}, function(error) {
			console.log('ERROR:', error);
			$scope.loading = false;
			$scope.error = SERVER_ERROR;
		});

		$scope.displayMore = function() {
			
			if ($scope.oldFiles.length > 0) {
				$scope.oldFiles.forEach(function(datum) {
					$scope.displayedFiles.push(datum);
				});
				
				$scope.oldFiles.length = 0;

			} else {
				
				var last = $scope.displayedFiles[$scope.displayedFiles.length - 1];
				if (!last) {
					return;
				}
				
				$scope.loading = true;
				$scope.error = undefined;
				Files.dashboard(last).then(function(collection) {
					console.log(collection)
					$scope.loading = false;
					collection.forEach(function(datum) {
						$scope.displayedFiles.push(datum);
					});
					
					if (collection.length === 0) {
						$scope.noMoreFiles = true;
					}
					
				}, function(error) {
					console.log('ERROR:', error);

					$scope.loading = false;
					$scope.error = SERVER_ERROR;
				});
				
			}
		};
		
		$scope.$watch('displayedFiles.length', function () {
			var pictures = [];
			$scope.displayedFiles.forEach(function(d) {
				d.files.forEach(function(f) {
					var extension = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
					if ({'.jpg': true, '.jpeg': true, '.gif': true, '.png': true, 'tif': true, '.tiff': true}[extension]) {
						pictures.push(Files.downloadUrl(f.fileId));
					}
				});
			});
			
			$scope.slides = pictures;
		});
		
		$scope.slideShowActive = false;
		$scope.toggleSlideShow = function() {
			$scope.slideShowActive = !$scope.slideShowActive;
		}
	}]);

	function sortByName(order) {
		return function(a, b) { 
			if (a.name < b.name) {
				return -order;
			} else if (a.name > b.name) {
				return order;
			}
			return 0;
		};
	}
	
	module.controller('LoginCtrl', ['$scope', 'Auth', '$rootScope', '$location', 
									function ($scope, Auth, $rootScope, $location) {
		$scope.user = {};
		$scope.error = '';

		//figure out where we should redirect to once the user has logged in.
		if (!$rootScope.redirect || $rootScope.redirect == '/login') {
			$rootScope.redirect = '/';
		}

		$scope.submit = function (user) {
			$scope.error = undefined;
			Auth.login($scope.user.username, $scope.user.password).then(function(user) {
				$rootScope.user = user;
				$location.path($rootScope.redirect);
			}, function(error) {
				console.log('LOGIN ERROR:', error);
				$scope.error = LOGIN_ERROR;
			});
		};
	}]);
	
	function createTreeFileManager($scope, treeProvider, filesProvider) {

		function makeTree(collection) {

			var byYear = { children: [] };
			
			collection.forEach(function(f) {
				var byMonth = byYear[f.year];
				if (!byMonth) {
					byMonth = byYear[f.year] = { name: f.year, children: [] }; // by month index
					byYear.children.push(byMonth);
				}
				
				var byDay = byMonth[f.month];
				if (!byDay) {
					byDay = byMonth[f.month] = { name: f.month, children: [], parent: byMonth }; // by day index
					byMonth.children.push(byDay);
				}
				
				byDay.children.push(f);
				f.name = f.day;
				f.parent = byDay;
			});
			
			// now, sort: years backwards, months and days forwards
			byYear.children.sort(sortByName(-1));
			
			byYear.children.forEach(function(y) {
				y.children.sort(sortByName(1));
				
				y.children.forEach(function(m) {
					m.children.sort(sortByName(1));
				});
			});
			
			return byYear;
		}

		$scope.makeCurrent = function(f) {
			if ($scope.current === f) {
				return;
			}
			
			if ($scope.current) {
				$scope.current.selected = false;
			}
			$scope.current = f;
			$scope.current.selected = true;
			$scope.current.parent.expanded = true;
			$scope.current.parent.parent.expanded = true;
			
			if (!$scope.current.files) {
				var current = $scope.current;
				
				$scope.loading = true;
				
				$scope.error = undefined;
				filesProvider(current).then(function(files) {
					current.files = files;
					$scope.loading = false;
				}, function(error) {
					console.log('ERROR:', error);
					$scope.error = SERVER_ERROR;
					$scope.loading = false;
				});
			}
		};
		
		$scope.refreshTree = function() {
			
			$scope.loading = true;
			$scope.error = undefined;
			treeProvider().then(function(collection) {
				
				$scope.loading = false;
				
				$scope.tree = makeTree(collection);
				
				if (!$scope.current && collection.length) {
					// if we have anything at all, set the "current" date to the last one
					var latest = null;
					collection.forEach(function(d) {
						if (latest === null || latest.dirId < d.dirId) {
							latest = d;
						}
					});
					
					$scope.makeCurrent(latest);
				}
				
			}, function(error) {
				console.log('ERROR:', error);
				$scope.loading = false;
				$scope.error = SERVER_ERROR;
			});
		};
		
		$scope.refreshCurrentFiles = function() {
			
			if (!$scope.current) {
				return;
			}
			
			var current = $scope.current;
			
			filesProvider(current).then(function(files) {
				current.files = files;
				$scope.loading = false;
			
			}, function(error) {
				console.log('ERROR:', error);
				$scope.error = SERVER_ERROR;
				$scope.loading = false;
			});
		};
		
		$scope.refreshTree();
	}

	module.controller('PublicCtrl', ['$scope', 'Files', function ($scope, Files) {
		
		createTreeFileManager($scope, function() {
			return Files.publicTree();
		}, function(current) {
			return Files.publicFiles(current);
		});
		
		$scope.slides = [];

		$scope.$watch('current', function() {
			if (!$scope.current || $scope.current.files.length === 0) {
				$scope.slides.length = 0;
			} else {
				var pictures = $scope.current.files.filter(function(f) {
					var extension = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
					console.log('Extension:', f, extension);
					return {'.jpg': true, '.jpeg': true, '.gif': true, '.png': true, '.tif': true, '.tiff': true}[extension];
				});
				
				$scope.slides = pictures.map(function(f) {
					return Files.downloadUrl(f.fileId);
				});
			}
		});
		
		$scope.slideShowActive = false;
		$scope.toggleSlideShow = function() {
			$scope.slideShowActive = !$scope.slideShowActive;
		}
	}]);

	module.controller('FilesCtrl', ['$scope', 'Files', '$timeout', 'UserSettings',
									function ($scope, Files, $timeout, UserSettings) {

		$scope.uploadApi = {}; // upload directive will fill this out

		$scope.data = {
			uploadAsPublic: UserSettings.autoPublic.get()
		};
		
		$scope.$watch('data.uploadAsPublic', function() {
			UserSettings.autoPublic.set(!!$scope.data.uploadAsPublic);
			$scope.data.uploadUrl = $scope.data.uploadAsPublic ? '/api/upload?public=true' : '/api/upload';
		});
		
		$scope.refresh = function(response) {
			var result = JSON.parse(response.responseText);
			if (result.numFailed > 0) {
				$scope.error = UPLOAD_SIZE_ERROR;
			} else {
				$scope.current = undefined; // so that we jump to the current date
				$scope.refreshTree();
			}
			$scope.uploadApi.clearFiles();
		};

		createTreeFileManager($scope, function() {
			return Files.tree();
		}, function(current) {
			return Files.list(current);
		});

		$scope.updateSelection = function() {
			$timeout(function() {
				var numSelected = 0;
				
				$scope.current.files.forEach(function(f) {
					if (f.selected) {
						numSelected += 1;
					}
				});

				if (numSelected == 0) {
					$scope.selected = undefined;
					$scope.selectAll = false;
				} else if (numSelected < $scope.current.files.length) {
					$scope.selected = 'some';
				} else {
					$scope.selected = 'all';
					$scope.selectAll = true;
				}
			});
		};
		
		function updateHelper(action, filter) {
			return function() {
				var todo = $scope.current.files.filter(function(f) { return f.selected; });
				if (filter) {
					todo = todo.filter(filter);
				}

				if (todo.length === 0) {
					return;
				}

				$scope.error = undefined;
				$scope.loading = true;
				Files.update(action, todo.map(function(f) { return f.fileId; })).then(function() {
					$scope.loading = false;
					$scope.refreshCurrentFiles();
				}, function(error) {
					console.log('SERVER ERROR:', error);
					$scope.loading = false;
					$scope.error = SERVER_ERROR;
				});
			};
		}

		$scope.setPrivate = updateHelper('makePrivate', function(f) { return f.public; });
		$scope.setPublic  = updateHelper('makePublic', function(f) { return !f.public; });
		$scope['delete']  = updateHelper('delete');

		$scope.selectOrUnselectAll =function() {
			$timeout(function() {
				$scope.current.files.forEach(function(f) {
					f.selected = ($scope.selectAll == true);
				});
				if ($scope.selectAll) {
					$scope.selected = 'all';
				} else {
					$scope.selected = undefined;
				}
			});
		};
		
		$scope.$watch('current.files', function(n, o) {
			
			if (n !== o && n) {
				$scope.updateSelection();
			}
		});

		$scope.slides = [];

		$scope.$watch('current', function() {
			if (!$scope.current || $scope.current.files.length === 0) {
				$scope.slides.length = 0;
			} else {
				var pictures = $scope.current.files.filter(function(f) {
					var extension = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
					return {'.jpg': true, '.jpeg': true, '.gif': true, '.png': true, '.tif': true, '.tiff': true}[extension];
				});
				
				$scope.slides = pictures.map(function(f) {
					return Files.downloadUrl(f.fileId);
				});
			}
		});
		
		$scope.slideShowActive = false;
		$scope.toggleSlideShow = function() {
			$scope.slideShowActive = !$scope.slideShowActive;
		}
	}]);

	var suffixMap = {
		'jpg' : 'picture',
		'jpeg': 'picture',
		'png' : 'picture',
		'gif' : 'picture',
		'tif' : 'picture',
		'tiff': 'picture',
		'mov' : 'movie',
		'mpeg': 'movie',
		'mts' : 'movie'
	};

	module.controller('RootCtrl', ['$scope', '$location', 'Files', function($scope, $location, Files) {
		
		$scope.$watch(function() { return $location.path(); }, function() {
			$scope.location = $location.path().slice(1); // strip forward slash
		});

		$scope.download = function(file) {
			Files.download(file.fileId);
		};

		$scope.inferFileType = function(filename) {
			var index = filename.lastIndexOf('.');
			var suffix = (index < 0) ? '' : filename.slice(index);

			suffix = suffix.toLowerCase();

			return suffixMap[suffix] || 'other';
		};

	}]);

	module.controller('SettingsCtrl', ['$scope', '$translate', 'Store', 'UserSettings', 
										function($scope, $translate, Store, UserSettings) {
		$scope.lang = Store.get('zuza-lang', $translate.uses());

		$scope.$watch('lang', function() {
			$translate.uses($scope.lang);
			Store.set('zuza-lang', $scope.lang);
		});

		$scope.autoPublic = UserSettings.autoPublic.get();
		$scope.$watch('autoPublic', function() {
			UserSettings.autoPublic.set($scope.autoPublic);
		});
	}]);
	
	module.controller('UserListCtrl', ['$scope', 'Auth', function($scope, Auth) {
		
		function refreshUsers() {
			$scope.loading = true;
			$scope.error = undefined;
			Auth.get('/api/user').then(function(response) {
				$scope.users = response.data.sort(function(a, b) {
					return a.username < b.username ? 1 : -1;
				});
				$scope.loading = false;
			}, function(error) {
				$scope.loading = false;
				$scope.error = SERVER_ERROR;
				console.log('ERROR in UserListCtrl:', error);
			});
		}
		
		$scope.remove = function(user) {
			
			$scope.loading = true;
			$scope.error = undefined;
			Auth.del('/api/user/' + user.username).then(function() {
				refreshUsers();
			}, function(error) {
				$scope.loading = false;
				$scope.error = SERVER_ERROR;
				console.log('ERROR in UserListCtrl:', error);
			});
		};
		
		refreshUsers();
	}]);

	module.controller('UserCtrl', ['$scope', '$routeParams', 'Auth', '$location', 
	                               function($scope, $routeParams, Auth, $location) {
		
		$scope.creating = $routeParams.username === undefined;
		
		if (!$scope.creating) {
			$scope.loading = true;
			$scope.error = undefined;
			Auth.get('/api/user/' + $routeParams.username).then(function(response) {
				$scope.loading = false;
				$scope.currentUser = response.data;
			}, function(error) {
				$scope.loading = false;
				$scope.error = SERVER_ERROR;
				console.log('ERROR in UserCtrl:', error);
			});
		}
		
		function validate(user) {
			if (!user.username || !user.name || !user.password) {
				return false;
			}
			
			if ($scope.validatePassword !== user.password) {
				return false;
			}
			
			return true;
		}
		
		$scope.save = function() {
			$scope.error = '';
			
			var valid = validate($scope.currentUser);
			
			if (!valid) {
				$scope.error = VALIDATION_ERROR;
				return;
			}
			
			$scope.loading = true;
			$scope.error = undefined;
			Auth.post('/api/user/' + $scope.currentUser.username, $scope.currentUser).then(function() {
				$scope.loading = false;
				$location.path('/user');
			}, function(error) {
				$scope.loading = false;
				$scope.error = SERVER_ERROR;
				console.log('ERROR in UserCtrl:', error);
			});
		};
	}]);

})(angular);
